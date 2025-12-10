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
const lockTimeout = 2000;

async function acquireControlLock(): Promise<boolean> {
  if (controlLock) return false;
  controlLock = true;
  setTimeout(() => { controlLock = false; }, lockTimeout);
  return true;
}

function releaseControlLock() {
  controlLock = false;
}

async function logAction(roundId: number | null, message: string, logType: string) {
  await db.insert(auctionLogs).values({
    roundId,
    message,
    logType,
    timestamp: new Date().toISOString(),
  });
}

// Helper function to finalize sale to highest bidder
async function finalizeSale(state: any) {
  if (!state.highestBidderId || !state.currentPlayerId) {
    return { success: false, message: 'No valid bid to finalize' };
  }

  const currentPlayer = await db.select()
    .from(auctionPlayers)
    .where(eq(auctionPlayers.id, state.currentPlayerId));

  if (!currentPlayer[0]) {
    return { success: false, message: 'Player not found' };
  }

  // Get the winning team
  const winningTeam = await db.select()
    .from(teams)
    .where(eq(teams.ownerId, state.highestBidderId));

  if (!winningTeam[0]) {
    return { success: false, message: 'Winning team not found' };
  }

  // Check if team has enough purse
  if (winningTeam[0].purse < (state.currentBid || 0)) {
    return { success: false, message: 'Winner has insufficient funds' };
  }

  // Update player as sold
  await db.update(auctionPlayers)
    .set({
      status: 'sold',
      soldTo: winningTeam[0].name,
      soldFor: state.currentBid,
      soldAt: new Date().toISOString(),
    })
    .where(eq(auctionPlayers.id, state.currentPlayerId));

  // Deduct from team purse
  await db.update(teams)
    .set({ purse: winningTeam[0].purse - (state.currentBid || 0) })
    .where(eq(teams.id, winningTeam[0].id));

  // Add player to team roster - use playerId from auction data if available
  const playerIdToUse = currentPlayer[0].playerId || `auction-${Date.now()}`;
  await db.insert(players).values({
    playerId: playerIdToUse,
    name: currentPlayer[0].name,
    teamId: winningTeam[0].id,
    category: currentPlayer[0].category,
    boughtFor: state.currentBid,
  });

  await logAction(
    state.currentRoundId,
    `${currentPlayer[0].name} sold to ${winningTeam[0].name} for $${(state.currentBid || 0).toLocaleString()}`,
    'sale'
  );

  // Update auction state - player sold, waiting for admin to click Next
  await db.update(auctionState)
    .set({
      isActive: true, // Still active, but waiting for next
      currentPlayerId: null, // No current player
      currentBid: 0,
      highestBidderId: null,
      highestBidderTeam: null,
      timerEndTime: null,
      pausedTimeRemaining: null,
      lastUpdated: new Date().toISOString(),
    })
    .where(eq(auctionState.id, state.id));

  return { 
    success: true, 
    message: `${currentPlayer[0].name} sold to ${winningTeam[0].name} for $${(state.currentBid || 0).toLocaleString()}!`,
    playerName: currentPlayer[0].name,
    teamName: winningTeam[0].name,
    amount: state.currentBid
  };
}

export async function POST(request: NextRequest) {
  const gotLock = await acquireControlLock();
  if (!gotLock) {
    return NextResponse.json({ error: 'Action in progress, please wait' }, { status: 429 });
  }

  try {
    const session = await getServerSession(authOptions);
    const body = await request.json();
    const { action, roundId } = body;

    // timer_expired doesn't need admin (called by client)
    if (action !== 'timer_expired') {
      if (!session?.user?.discordId || !ADMIN_IDS.includes(session.user.discordId)) {
        releaseControlLock();
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }
    }

    // Get current state
    const states = await db.select().from(auctionState);
    let state = states[0];

    if (!state) {
      const newState = await db.insert(auctionState).values({
        isActive: false,
        isPaused: false,
      }).returning();
      state = newState[0];
    }

    switch (action) {
      case 'start': {
        // Start auction with a specific round
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
        // Move to next player (current player goes unsold if not already sold)
        if (state.currentPlayerId) {
          const currentPlayer = await db.select()
            .from(auctionPlayers)
            .where(eq(auctionPlayers.id, state.currentPlayerId));

          if (currentPlayer[0] && currentPlayer[0].status === 'current') {
            // Move to unsold
            await db.update(auctionPlayers)
              .set({ status: 'unsold' })
              .where(eq(auctionPlayers.id, state.currentPlayerId));

            await db.insert(unsoldPlayers).values({
              name: currentPlayer[0].name,
              category: currentPlayer[0].category,
              basePrice: currentPlayer[0].basePrice,
              originalRoundId: state.currentRoundId,
              addedAt: new Date().toISOString(),
            });

            await logAction(state.currentRoundId, `${currentPlayer[0].name} went unsold`, 'unsold');
          }
        }

        // Get next pending player
        const pendingPlayers = await db.select()
          .from(auctionPlayers)
          .where(and(
            eq(auctionPlayers.roundId, state.currentRoundId!),
            eq(auctionPlayers.status, 'pending')
          ))
          .orderBy(auctionPlayers.orderIndex);

        if (pendingPlayers.length === 0) {
          // No more players, end the round
          await db.update(auctionState)
            .set({
              isActive: false,
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
            .where(eq(auctionRounds.id, state.currentRoundId!));

          await logAction(state.currentRoundId, 'Round completed - no more players', 'complete');

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
            currentPlayerId: nextPlayer.id,
            currentBid: nextPlayer.basePrice,
            highestBidderId: null,
            highestBidderTeam: null,
            timerEndTime: Date.now() + (BID_INCREMENT_TIME * 1000),
            pausedTimeRemaining: null,
            lastUpdated: new Date().toISOString(),
          })
          .where(eq(auctionState.id, state.id));

        await logAction(state.currentRoundId, `Now auctioning: ${nextPlayer.name}`, 'start');

        releaseControlLock();
        return NextResponse.json({ success: true, message: `Now auctioning: ${nextPlayer.name}` });
      }

      case 'sold': {
        // Manually finalize sale to highest bidder
        const result = await finalizeSale(state);
        releaseControlLock();
        
        if (!result.success) {
          return NextResponse.json({ error: result.message }, { status: 400 });
        }

        return NextResponse.json(result);
      }

      case 'timer_expired': {
        // Called when timer runs out - auto-sell if there's a bidder
        if (!state.currentPlayerId) {
          releaseControlLock();
          return NextResponse.json({ error: 'No active auction' }, { status: 400 });
        }

        if (state.highestBidderId) {
          // There's a highest bidder - auto sell
          const result = await finalizeSale(state);
          releaseControlLock();
          return NextResponse.json(result);
        } else {
          // No bidder - mark as unsold and wait for Next button
          const currentPlayer = await db.select()
            .from(auctionPlayers)
            .where(eq(auctionPlayers.id, state.currentPlayerId));

          if (currentPlayer[0]) {
            await db.update(auctionPlayers)
              .set({ status: 'unsold' })
              .where(eq(auctionPlayers.id, state.currentPlayerId));

            await db.insert(unsoldPlayers).values({
              name: currentPlayer[0].name,
              category: currentPlayer[0].category,
              basePrice: currentPlayer[0].basePrice,
              originalRoundId: state.currentRoundId,
              addedAt: new Date().toISOString(),
            });

            await logAction(state.currentRoundId, `${currentPlayer[0].name} went unsold (no bids)`, 'unsold');
          }

          // Update state - waiting for Next button
          await db.update(auctionState)
            .set({
              isActive: true,
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
          return NextResponse.json({ 
            success: true, 
            message: `${currentPlayer[0]?.name || 'Player'} went unsold. Click Next for next player.` 
          });
        }
      }

      case 'pause': {
        // Check if already paused
        if (state.isPaused) {
          releaseControlLock();
          return NextResponse.json({ error: 'Auction is already paused' }, { status: 400 });
        }
        
        // Calculate remaining time and store it
        const now = Date.now();
        const remainingMs = state.timerEndTime ? Math.max(0, state.timerEndTime - now) : 0;
        
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
        // Check if actually paused
        if (!state.isPaused) {
          releaseControlLock();
          return NextResponse.json({ error: 'Auction is not paused' }, { status: 400 });
        }

        // Resume with the remaining time that was stored when paused
        const remainingMs = state.pausedTimeRemaining || (BID_INCREMENT_TIME * 1000);
        const newEndTime = Date.now() + remainingMs;
        
        await db.update(auctionState)
          .set({
            isPaused: false,
            timerEndTime: newEndTime,
            pausedTimeRemaining: null,
            lastUpdated: new Date().toISOString(),
          })
          .where(eq(auctionState.id, state.id));

        await logAction(state.currentRoundId, 'Auction resumed', 'resume');

        releaseControlLock();
        return NextResponse.json({ 
          success: true, 
          message: 'Auction resumed',
          remainingTime: Math.ceil(remainingMs / 1000)
        });
      }

      case 'stop': {
        // Stop auction and return current player to unsold
        if (state.currentPlayerId) {
          const currentPlayer = await db.select()
            .from(auctionPlayers)
            .where(eq(auctionPlayers.id, state.currentPlayerId));

          if (currentPlayer[0]) {
            await db.update(auctionPlayers)
              .set({ status: 'unsold' })
              .where(eq(auctionPlayers.id, state.currentPlayerId));

            await db.insert(unsoldPlayers).values({
              name: currentPlayer[0].name,
              category: currentPlayer[0].category,
              basePrice: currentPlayer[0].basePrice,
              originalRoundId: state.currentRoundId,
              addedAt: new Date().toISOString(),
            });

            await logAction(state.currentRoundId, `Auction stopped. ${currentPlayer[0].name} returned to unsold.`, 'stop');
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
        return NextResponse.json({ success: true, message: 'Auction stopped' });
      }

      case 'end_round': {
        // End round early and return to round selection
        if (state.currentPlayerId) {
          const currentPlayer = await db.select()
            .from(auctionPlayers)
            .where(eq(auctionPlayers.id, state.currentPlayerId));

          if (currentPlayer[0] && currentPlayer[0].status === 'current') {
            await db.update(auctionPlayers)
              .set({ status: 'pending' }) // Return to pending, not unsold
              .where(eq(auctionPlayers.id, state.currentPlayerId));
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

      default:
        releaseControlLock();
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    releaseControlLock();
    console.error('Error in auction control:', error);
    return NextResponse.json({ error: 'Failed to execute action' }, { status: 500 });
  }
}
