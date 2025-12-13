import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, ADMIN_IDS } from '@/lib/auth';
import { db } from '@/db';
import { auctionState, auctionPlayers, auctionRounds, teams, players, auctionLogs, unsoldPlayers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

const BID_INCREMENT_TIME = 12; // seconds for initial timer
const BID_CONTINUE_TIME = 8; // seconds after each bid

// Simple lock to prevent concurrent control actions
let controlLock = false;
const lockTimeout = 3000;

// Track recently processed sales to prevent duplicates (in-memory cache)
const recentSales = new Map<number, number>(); // playerId -> timestamp
const SALE_CACHE_DURATION = 10000; // 10 seconds

function isRecentlySold(playerId: number): boolean {
  const saleTime = recentSales.get(playerId);
  if (!saleTime) return false;
  if (Date.now() - saleTime > SALE_CACHE_DURATION) {
    recentSales.delete(playerId);
    return false;
  }
  return true;
}

function markAsSold(playerId: number) {
  recentSales.set(playerId, Date.now());
  // Cleanup old entries periodically
  if (recentSales.size > 100) {
    const now = Date.now();
    for (const [pid, time] of recentSales.entries()) {
      if (now - time > SALE_CACHE_DURATION) {
        recentSales.delete(pid);
      }
    }
  }
}

async function acquireControlLock(): Promise<boolean> {
  if (controlLock) return false;
  controlLock = true;
  setTimeout(() => { controlLock = false; }, lockTimeout);
  return true;
}

function releaseControlLock() {
  controlLock = false;
}

// Safe helper to get or create auction state
async function getOrCreateState() {
  try {
    const states = await db.select().from(auctionState);
    if (states.length > 0) {
      return states[0];
    }
    // Create initial state if none exists
    const newState = await db.insert(auctionState).values({
      isActive: false,
      isPaused: false,
      currentBid: 0,
      currentPlayerId: null,
      currentRoundId: null,
      highestBidderId: null,
      highestBidderTeam: null,
      timerEndTime: null,
      pausedTimeRemaining: null,
      lastUpdated: new Date().toISOString(),
    }).returning();
    return newState[0];
  } catch (error) {
    console.error('Error getting/creating state:', error);
    throw error;
  }
}

async function logAction(roundId: number | null | undefined, message: string, logType: string) {
  try {
    await db.insert(auctionLogs).values({
      roundId: roundId || null,
      message,
      logType,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Failed to log action:', e);
    // Don't throw - logging failures shouldn't break the main flow
  }
}

// Safe helper to add to unsold
async function addToUnsold(player: { name: string; category?: string | null; basePrice: number }, roundId: number | null | undefined) {
  try {
    await db.insert(unsoldPlayers).values({
      name: player.name,
      category: player.category || 'Unknown',
      basePrice: player.basePrice,
      originalRoundId: roundId || null,
      addedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Failed to add to unsold:', e);
  }
}

// Helper function to finalize sale to highest bidder
async function finalizeSale(
  stateId: number, 
  currentPlayerId: number, 
  currentRoundId: number | null | undefined, 
  highestBidderId: string, 
  currentBid: number
) {
  try {
    // FIRST CHECK: In-memory cache to catch duplicates quickly
    if (isRecentlySold(currentPlayerId)) {
      console.log('Sale rejected (memory cache) - player ID:', currentPlayerId);
      return { success: false, message: 'Player already sold', alreadyProcessed: true };
    }
    
    // Get the current player info first
    const currentPlayerArr = await db.select()
      .from(auctionPlayers)
      .where(eq(auctionPlayers.id, currentPlayerId));

    const currentPlayer = currentPlayerArr[0];
    if (!currentPlayer) {
      return { success: false, message: 'Player not found' };
    }
    
    // CRITICAL CHECK: If already sold, return immediately
    if (currentPlayer.status === 'sold') {
      console.log('Sale rejected - player already has sold status:', currentPlayer.name);
      return { success: false, message: 'Player already sold', alreadyProcessed: true };
    }

    // Get the winning team
    const winningTeamArr = await db.select()
      .from(teams)
      .where(eq(teams.ownerId, highestBidderId));

    const winningTeam = winningTeamArr[0];
    if (!winningTeam) {
      return { success: false, message: 'Winning team not found' };
    }
    
    // CRITICAL CHECK: Check if player is ALREADY in the players (roster) table
    const existingPlayerArr = await db.select()
      .from(players)
      .where(eq(players.name, currentPlayer.name));
    
    if (existingPlayerArr.length > 0) {
      console.log('Sale rejected - player already in roster table:', currentPlayer.name);
      // Also mark as sold in memory cache
      markAsSold(currentPlayerId);
      return { 
        success: true, 
        message: `${currentPlayer.name} already processed`,
        alreadyProcessed: true 
      };
    }
    
    // Mark as sold in memory BEFORE database operations
    markAsSold(currentPlayerId);
    
    // ATOMIC UPDATE: Update player status to 'sold' ONLY if it's still 'current'
    await db.update(auctionPlayers)
      .set({
        status: 'sold',
        soldTo: winningTeam.name,
        soldFor: currentBid,
        soldAt: new Date().toISOString(),
      })
      .where(and(
        eq(auctionPlayers.id, currentPlayerId),
        eq(auctionPlayers.status, 'current') // Only update if status is 'current'
      ));
    
    // Verify the update worked by re-reading
    const updatedPlayerArr = await db.select()
      .from(auctionPlayers)
      .where(eq(auctionPlayers.id, currentPlayerId));
    
    const updatedPlayer = updatedPlayerArr[0];
    if (!updatedPlayer || updatedPlayer.status !== 'sold' || updatedPlayer.soldFor !== currentBid) {
      console.log('Sale likely processed by another request:', currentPlayer.name);
      return { success: false, message: 'Sale already processed', alreadyProcessed: true };
    }

    // Check if team has enough purse
    if (winningTeam.purse < currentBid) {
      return { success: false, message: 'Winner has insufficient funds' };
    }

    // Debug: Log the player data
    console.log('Finalizing sale - Player data:', {
      id: currentPlayer.id,
      name: currentPlayer.name,
      playerId: currentPlayer.playerId,
      category: currentPlayer.category,
    });

    // Deduct from team purse
    await db.update(teams)
      .set({ purse: winningTeam.purse - currentBid })
      .where(eq(teams.id, winningTeam.id));

    // Add player to team roster - generate player ID from name if not available
    const generatePlayerId = (playerName: string): string => {
      return playerName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
    };
    const playerIdToUse = currentPlayer.playerId || generatePlayerId(currentPlayer.name);
    
    // Final check before insert - make sure player wasn't added by another request
    const finalCheck = await db.select()
      .from(players)
      .where(eq(players.name, currentPlayer.name));
    
    if (finalCheck.length > 0) {
      console.log('Player inserted by another request, skipping:', currentPlayer.name);
      return { 
        success: true, 
        message: `${currentPlayer.name} sold to ${winningTeam.name} for $${currentBid.toLocaleString()}!`,
        playerName: currentPlayer.name,
        teamName: winningTeam.name,
        amount: currentBid,
        alreadyProcessed: true
      };
    }
    
    await db.insert(players).values({
      playerId: playerIdToUse,
      name: currentPlayer.name,
      teamId: winningTeam.id,
      category: currentPlayer.category || null,
      boughtFor: currentBid,
    });

    // Log the sale
    await logAction(
      currentRoundId,
      `${currentPlayer.name} sold to ${winningTeam.name} for $${currentBid.toLocaleString()}`,
      'sale'
    );

    // Update auction state - player sold, waiting for admin to click Next
    await db.update(auctionState)
      .set({
        isActive: true,
        isPaused: false,
        currentPlayerId: null,
        currentBid: 0,
        highestBidderId: null,
        highestBidderTeam: null,
        timerEndTime: null,
        pausedTimeRemaining: null,
        lastUpdated: new Date().toISOString(),
      })
      .where(eq(auctionState.id, stateId));

    return { 
      success: true, 
      message: `${currentPlayer.name} sold to ${winningTeam.name} for $${currentBid.toLocaleString()}!`,
      playerName: currentPlayer.name,
      teamName: winningTeam.name,
      amount: currentBid
    };
  } catch (error) {
    console.error('Error in finalizeSale:', error);
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, message: `Sale failed: ${errMsg}` };
  }
}

export async function POST(request: NextRequest) {
  const gotLock = await acquireControlLock();
  if (!gotLock) {
    return NextResponse.json({ error: 'Action in progress, please wait' }, { status: 429 });
  }

  try {
    const session = await getServerSession(authOptions);
    
    let body;
    try {
      body = await request.json();
    } catch (e) {
      releaseControlLock();
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    
    const { action, roundId } = body;
    console.log('Auction control action:', action, 'roundId:', roundId);

    // timer_expired doesn't need admin (called by client)
    if (action !== 'timer_expired') {
      const discordId = session?.user?.discordId;
      if (!discordId || !ADMIN_IDS.includes(discordId)) {
        releaseControlLock();
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }
    }

    // Get current state safely
    let state;
    try {
      state = await getOrCreateState();
    } catch (e) {
      releaseControlLock();
      console.error('Failed to get auction state:', e);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    console.log('Current state:', JSON.stringify(state));

    switch (action) {
      case 'start': {
        if (!roundId) {
          releaseControlLock();
          return NextResponse.json({ error: 'Round ID required' }, { status: 400 });
        }

        // Get first pending player in the round
        const pendingPlayers = await db.select()
          .from(auctionPlayers)
          .where(and(
            eq(auctionPlayers.roundId, roundId),
            eq(auctionPlayers.status, 'pending')
          ))
          .orderBy(auctionPlayers.orderIndex);

        if (pendingPlayers.length === 0) {
          releaseControlLock();
          return NextResponse.json({ error: 'No players available in this round' }, { status: 400 });
        }

        const firstPlayer = pendingPlayers[0];

        // Update player status to current
        await db.update(auctionPlayers)
          .set({ status: 'current' })
          .where(eq(auctionPlayers.id, firstPlayer.id));

        // Update auction state
        await db.update(auctionState)
          .set({
            isActive: true,
            isPaused: false,
            currentRoundId: roundId,
            currentPlayerId: firstPlayer.id,
            currentBid: firstPlayer.basePrice,
            highestBidderId: null,
            highestBidderTeam: null,
            timerEndTime: Date.now() + (BID_INCREMENT_TIME * 1000),
            pausedTimeRemaining: null,
            lastUpdated: new Date().toISOString(),
          })
          .where(eq(auctionState.id, state.id));

        // Mark round as active
        await db.update(auctionRounds)
          .set({ isActive: true })
          .where(eq(auctionRounds.id, roundId));

        await logAction(roundId, `Auction started for ${firstPlayer.name}`, 'start');

        releaseControlLock();
        return NextResponse.json({ success: true, message: `Started auction for ${firstPlayer.name}` });
      }

      case 'next': {
        // Check if we have a valid round
        const currentRoundId = state.currentRoundId;
        if (!currentRoundId) {
          releaseControlLock();
          return NextResponse.json({ error: 'No active round. Please start an auction first.' }, { status: 400 });
        }

        // If there's a current player that wasn't sold, mark as unsold
        if (state.currentPlayerId) {
          try {
            const currentPlayerArr = await db.select()
              .from(auctionPlayers)
              .where(eq(auctionPlayers.id, state.currentPlayerId));

            if (currentPlayerArr[0] && currentPlayerArr[0].status === 'current') {
              await db.update(auctionPlayers)
                .set({ status: 'unsold' })
                .where(eq(auctionPlayers.id, state.currentPlayerId));

              await addToUnsold(currentPlayerArr[0], currentRoundId);
              await logAction(currentRoundId, `${currentPlayerArr[0].name} went unsold`, 'unsold');
            }
          } catch (e) {
            console.error('Error handling unsold player:', e);
            // Continue anyway
          }
        }

        // Get next pending player
        let pendingPlayers;
        try {
          pendingPlayers = await db.select()
            .from(auctionPlayers)
            .where(and(
              eq(auctionPlayers.roundId, currentRoundId),
              eq(auctionPlayers.status, 'pending')
            ))
            .orderBy(auctionPlayers.orderIndex);
        } catch (e) {
          releaseControlLock();
          console.error('Error getting pending players:', e);
          return NextResponse.json({ error: 'Failed to get players' }, { status: 500 });
        }

        console.log('Pending players:', pendingPlayers.length);

        if (pendingPlayers.length === 0) {
          // No more players, end the round
          await db.update(auctionState)
            .set({
              isActive: false,
              isPaused: false,
              currentPlayerId: null,
              currentBid: 0,
              highestBidderId: null,
              highestBidderTeam: null,
              timerEndTime: null,
              pausedTimeRemaining: null,
              lastUpdated: new Date().toISOString(),
            })
            .where(eq(auctionState.id, state.id));

          await db.update(auctionRounds)
            .set({ isActive: false, isCompleted: true })
            .where(eq(auctionRounds.id, currentRoundId));

          await logAction(currentRoundId, 'Round completed - no more players', 'complete');

          releaseControlLock();
          return NextResponse.json({ success: true, message: 'Round completed', roundCompleted: true });
        }

        const nextPlayer = pendingPlayers[0];

        // Update next player status to current
        await db.update(auctionPlayers)
          .set({ status: 'current' })
          .where(eq(auctionPlayers.id, nextPlayer.id));

        // Update auction state
        await db.update(auctionState)
          .set({
            isActive: true,
            isPaused: false,
            currentPlayerId: nextPlayer.id,
            currentBid: nextPlayer.basePrice,
            highestBidderId: null,
            highestBidderTeam: null,
            timerEndTime: Date.now() + (BID_INCREMENT_TIME * 1000),
            pausedTimeRemaining: null,
            lastUpdated: new Date().toISOString(),
          })
          .where(eq(auctionState.id, state.id));

        await logAction(currentRoundId, `Now auctioning: ${nextPlayer.name}`, 'start');

        releaseControlLock();
        return NextResponse.json({ success: true, message: `Now auctioning: ${nextPlayer.name}` });
      }

      case 'sold': {
        if (!state.currentPlayerId || !state.highestBidderId) {
          releaseControlLock();
          return NextResponse.json({ error: 'No valid bid to finalize' }, { status: 400 });
        }

        // Save the data before clearing state
        const savedPlayerId = state.currentPlayerId;
        const savedRoundId = state.currentRoundId;
        const savedBidderId = state.highestBidderId;
        const savedBid = state.currentBid || 0;
        
        // Clear state FIRST to prevent duplicate processing
        await db.update(auctionState)
          .set({
            currentPlayerId: null,
            currentBid: 0,
            highestBidderId: null,
            highestBidderTeam: null,
            timerEndTime: null,
            pausedTimeRemaining: null,
            lastUpdated: new Date().toISOString(),
          })
          .where(eq(auctionState.id, state.id));

        const result = await finalizeSale(
          state.id,
          savedPlayerId,
          savedRoundId,
          savedBidderId,
          savedBid
        );
        
        releaseControlLock();
        
        if (!result.success && !result.alreadyProcessed) {
          return NextResponse.json({ error: result.message }, { status: 400 });
        }

        return NextResponse.json(result);
      }

      case 'timer_expired': {
        if (!state.currentPlayerId) {
          releaseControlLock();
          return NextResponse.json({ error: 'No active auction' }, { status: 400 });
        }

        // CRITICAL: Check if timer has ACTUALLY expired on the server
        // This prevents race conditions when bids reset the timer but stale clients still call timer_expired
        const now = Date.now();
        const timerEnd = state.timerEndTime ? Number(state.timerEndTime) : 0;
        const timeRemaining = timerEnd - now;
        
        // Allow 500ms grace period for network latency, but reject if timer is clearly not expired
        if (timeRemaining > 500) {
          releaseControlLock();
          console.log(`Timer expiry rejected: ${timeRemaining}ms remaining (bid likely just placed)`);
          return NextResponse.json({ 
            error: 'Timer not expired yet - a bid may have just been placed',
            rejected: true,
            timeRemaining: Math.ceil(timeRemaining / 1000)
          }, { status: 409 }); // 409 Conflict
        }

        if (state.highestBidderId) {
          // CRITICAL: Re-read state IMMEDIATELY before sale to catch any last-second bids
          // This is needed because the bid API uses a different lock
          const freshStates = await db.select().from(auctionState);
          const freshState = freshStates[0];
          
          if (!freshState || !freshState.currentPlayerId) {
            releaseControlLock();
            console.log('Timer expiry rejected - no current player (already processed)');
            return NextResponse.json({ 
              success: true, 
              message: 'Already processed',
              alreadyProcessed: true 
            });
          }
          
          // Re-check timer with fresh state
          const freshTimerEnd = freshState.timerEndTime ? Number(freshState.timerEndTime) : 0;
          const freshTimeRemaining = freshTimerEnd - Date.now();
          
          if (freshTimeRemaining > 500) {
            releaseControlLock();
            console.log(`Timer expiry rejected on re-check: ${freshTimeRemaining}ms remaining`);
            return NextResponse.json({ 
              error: 'A bid was placed - timer reset',
              rejected: true,
              timeRemaining: Math.ceil(freshTimeRemaining / 1000)
            }, { status: 409 });
          }
          
          // CRITICAL: Clear currentPlayerId FIRST to prevent duplicate processing
          // This acts as a lock - any other request will see currentPlayerId as null
          const savedPlayerId = freshState.currentPlayerId;
          const savedRoundId = freshState.currentRoundId;
          const savedBidderId = freshState.highestBidderId!;
          const savedBid = freshState.currentBid || 0;
          
          await db.update(auctionState)
            .set({
              currentPlayerId: null,
              currentBid: 0,
              highestBidderId: null,
              highestBidderTeam: null,
              timerEndTime: null,
              pausedTimeRemaining: null,
              lastUpdated: new Date().toISOString(),
            })
            .where(eq(auctionState.id, freshState.id));
          
          // Now process the sale with saved data
          const result = await finalizeSale(
            freshState.id,
            savedPlayerId,
            savedRoundId,
            savedBidderId,
            savedBid
          );
          
          // If already processed, that's fine - just return success
          if (result.alreadyProcessed) {
            releaseControlLock();
            return NextResponse.json({ 
              success: true, 
              message: 'Already processed',
              alreadyProcessed: true 
            });
          }
          
          releaseControlLock();
          return NextResponse.json(result);
        } else {
          // No bidder - mark as unsold and wait for Next button
          // CRITICAL: Clear state FIRST
          const savedPlayerId = state.currentPlayerId;
          
          await db.update(auctionState)
            .set({
              isActive: true,
              isPaused: false,
              currentPlayerId: null,
              currentBid: 0,
              highestBidderId: null,
              highestBidderTeam: null,
              timerEndTime: null,
              pausedTimeRemaining: null,
              lastUpdated: new Date().toISOString(),
            })
            .where(eq(auctionState.id, state.id));
          
          try {
            const currentPlayerArr = await db.select()
              .from(auctionPlayers)
              .where(eq(auctionPlayers.id, savedPlayerId));

            if (currentPlayerArr[0] && currentPlayerArr[0].status !== 'unsold') {
              await db.update(auctionPlayers)
                .set({ status: 'unsold' })
                .where(eq(auctionPlayers.id, savedPlayerId));

              await addToUnsold(currentPlayerArr[0], state.currentRoundId);
              await logAction(state.currentRoundId, `${currentPlayerArr[0].name} went unsold (no bids)`, 'unsold');
            }

            releaseControlLock();
            return NextResponse.json({ 
              success: true, 
              message: `${currentPlayerArr[0]?.name || 'Player'} went unsold. Click Next for next player.` 
            });
          } catch (e) {
            releaseControlLock();
            console.error('Error handling unsold:', e);
            return NextResponse.json({ error: 'Failed to process unsold player' }, { status: 500 });
          }
        }
      }

      case 'pause': {
        if (state.isPaused) {
          releaseControlLock();
          return NextResponse.json({ error: 'Auction is already paused' }, { status: 400 });
        }
        
        // Calculate remaining time and store it
        const now = Date.now();
        const timerEnd = state.timerEndTime ? Number(state.timerEndTime) : now;
        const remainingMs = Math.max(0, timerEnd - now);
        
        await db.update(auctionState)
          .set({
            isPaused: true,
            pausedTimeRemaining: remainingMs,
            lastUpdated: new Date().toISOString(),
          })
          .where(eq(auctionState.id, state.id));

        await logAction(state.currentRoundId, 'Auction paused', 'pause');

        releaseControlLock();
        return NextResponse.json({ success: true, message: 'Auction paused' });
      }

      case 'resume': {
        if (!state.isPaused) {
          releaseControlLock();
          return NextResponse.json({ error: 'Auction is not paused' }, { status: 400 });
        }

        // Resume with FULL 12 seconds (reset the timer as requested)
        const newEndTime = Date.now() + (BID_INCREMENT_TIME * 1000);
        
        await db.update(auctionState)
          .set({
            isPaused: false,
            timerEndTime: newEndTime,
            pausedTimeRemaining: null,
            lastUpdated: new Date().toISOString(),
          })
          .where(eq(auctionState.id, state.id));

        await logAction(state.currentRoundId, 'Auction resumed (timer reset to 12s)', 'resume');

        releaseControlLock();
        return NextResponse.json({ 
          success: true, 
          message: 'Auction resumed',
          remainingTime: BID_INCREMENT_TIME
        });
      }

      case 'stop': {
        // Stop auction and return current player to unsold
        if (state.currentPlayerId) {
          try {
            const currentPlayerArr = await db.select()
              .from(auctionPlayers)
              .where(eq(auctionPlayers.id, state.currentPlayerId));

            if (currentPlayerArr[0]) {
              await db.update(auctionPlayers)
                .set({ status: 'unsold' })
                .where(eq(auctionPlayers.id, state.currentPlayerId));

              await addToUnsold(currentPlayerArr[0], state.currentRoundId);
              await logAction(state.currentRoundId, `Auction stopped. ${currentPlayerArr[0].name} returned to unsold.`, 'stop');
            }
          } catch (e) {
            console.error('Error handling stop:', e);
            // Continue anyway
          }
        }

        await db.update(auctionState)
          .set({
            isActive: false,
            isPaused: false,
            currentPlayerId: null,
            currentBid: 0,
            highestBidderId: null,
            highestBidderTeam: null,
            timerEndTime: null,
            pausedTimeRemaining: null,
            lastUpdated: new Date().toISOString(),
          })
          .where(eq(auctionState.id, state.id));

        releaseControlLock();
        return NextResponse.json({ success: true, message: 'Auction stopped', redirect: true });
      }

      case 'end_round': {
        // End round early and return to round selection
        if (state.currentPlayerId) {
          try {
            const currentPlayerArr = await db.select()
              .from(auctionPlayers)
              .where(eq(auctionPlayers.id, state.currentPlayerId));

            if (currentPlayerArr[0] && currentPlayerArr[0].status === 'current') {
              // Return to pending, not unsold
              await db.update(auctionPlayers)
                .set({ status: 'pending' })
                .where(eq(auctionPlayers.id, state.currentPlayerId));
            }
          } catch (e) {
            console.error('Error handling end_round:', e);
          }
        }

        // Mark round as inactive but not completed
        if (state.currentRoundId) {
          await db.update(auctionRounds)
            .set({ isActive: false })
            .where(eq(auctionRounds.id, state.currentRoundId));
        }

        await db.update(auctionState)
          .set({
            isActive: false,
            isPaused: false,
            currentPlayerId: null,
            currentRoundId: null, // Clear round selection
            currentBid: 0,
            highestBidderId: null,
            highestBidderTeam: null,
            timerEndTime: null,
            pausedTimeRemaining: null,
            lastUpdated: new Date().toISOString(),
          })
          .where(eq(auctionState.id, state.id));

        await logAction(state.currentRoundId, 'Round ended - returning to round selection', 'stop');

        releaseControlLock();
        return NextResponse.json({ success: true, message: 'Round ended', redirect: true });
      }

      case 'clear_round': {
        // Clear round selection after round completed - allows selecting new round
        await db.update(auctionState)
          .set({
            isActive: false,
            isPaused: false,
            currentPlayerId: null,
            currentRoundId: null,
            currentBid: 0,
            highestBidderId: null,
            highestBidderTeam: null,
            timerEndTime: null,
            pausedTimeRemaining: null,
            lastUpdated: new Date().toISOString(),
          })
          .where(eq(auctionState.id, state.id));

        releaseControlLock();
        return NextResponse.json({ success: true, message: 'Ready to select new round' });
      }

      default:
        releaseControlLock();
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    releaseControlLock();
    console.error('Error in auction control:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to execute action: ${errorMessage}` }, { status: 500 });
  }
}
