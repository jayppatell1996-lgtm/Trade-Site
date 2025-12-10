import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, ADMIN_IDS } from '@/lib/auth';
import { db } from '@/db';
import { auctionState, auctionPlayers, auctionRounds, teams, players, auctionLogs, unsoldPlayers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

const BID_INCREMENT_TIME = 10; // seconds
const BID_CONTINUE_TIME = 6; // seconds

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

  // Add player to team roster
  await db.insert(players).values({
    playerId: `auction-${Date.now()}`,
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
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.discordId || !ADMIN_IDS.includes(session.user.discordId)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { action, roundId } = body;

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
            lastUpdated: new Date().toISOString(),
          })
          .where(eq(auctionState.id, state.id));

        // Mark round as active
        await db.update(auctionRounds)
          .set({ isActive: true })
          .where(eq(auctionRounds.id, roundId));

        await logAction(roundId, `Auction started for ${firstPlayer.name}`, 'start');

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
              lastUpdated: new Date().toISOString(),
            })
            .where(eq(auctionState.id, state.id));

          await db.update(auctionRounds)
            .set({ isActive: false, isCompleted: true })
            .where(eq(auctionRounds.id, state.currentRoundId!));

          await logAction(state.currentRoundId, 'Round completed - no more players', 'stop');

          return NextResponse.json({ success: true, message: 'Round completed' });
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
            lastUpdated: new Date().toISOString(),
          })
          .where(eq(auctionState.id, state.id));

        await logAction(state.currentRoundId, `Now auctioning: ${nextPlayer.name}`, 'start');

        return NextResponse.json({ success: true, message: `Now auctioning: ${nextPlayer.name}` });
      }

      case 'sold': {
        // Manually finalize sale to highest bidder
        const result = await finalizeSale(state);
        
        if (!result.success) {
          return NextResponse.json({ error: result.message }, { status: 400 });
        }

        return NextResponse.json(result);
      }

      case 'timer_expired': {
        // Called when timer runs out - auto-sell if there's a bidder
        if (!state.currentPlayerId) {
          return NextResponse.json({ error: 'No active auction' }, { status: 400 });
        }

        if (state.highestBidderId) {
          // There's a highest bidder - auto sell
          const result = await finalizeSale(state);
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
              lastUpdated: new Date().toISOString(),
            })
            .where(eq(auctionState.id, state.id));

          return NextResponse.json({ 
            success: true, 
            message: `${currentPlayer[0]?.name || 'Player'} went unsold. Click Next for next player.` 
          });
        }
      }

      case 'pause': {
        // Check if already paused
        if (state.isPaused) {
          return NextResponse.json({ error: 'Auction is already paused' }, { status: 400 });
        }

        // Calculate remaining time and store it
        // Only calculate from timestamp if it looks like a valid future timestamp
        let remainingMs = BID_INCREMENT_TIME * 1000; // Default 10 seconds
        if (state.timerEndTime && state.timerEndTime > Date.now() - 60000) {
          // timerEndTime is a valid future timestamp (within reason)
          remainingMs = Math.max(1000, state.timerEndTime - Date.now()); // At least 1 second
        }
        
        await db.update(auctionState)
          .set({
            isPaused: true,
            // Store remaining time in timerEndTime (will be < 60000 typically)
            timerEndTime: remainingMs,
            lastUpdated: new Date().toISOString(),
          })
          .where(eq(auctionState.id, state.id));

        await logAction(state.currentRoundId, 'Auction paused', 'pause');

        return NextResponse.json({ success: true, message: 'Auction paused', remainingTime: Math.ceil(remainingMs / 1000) });
      }

      case 'resume': {
        // Check if actually paused
        if (!state.isPaused) {
          return NextResponse.json({ error: 'Auction is not paused' }, { status: 400 });
        }

        // Resume with the remaining time that was stored when paused
        let storedRemainingMs = state.timerEndTime || (BID_INCREMENT_TIME * 1000);
        
        // Validate - remaining time should be reasonable (< 1 minute = 60000ms)
        // If it's larger, it's probably a corrupted timestamp
        if (storedRemainingMs > 60000) {
          storedRemainingMs = BID_INCREMENT_TIME * 1000; // Default to 10 seconds
        }
        
        const newEndTime = Date.now() + storedRemainingMs;
        
        await db.update(auctionState)
          .set({
            isPaused: false,
            timerEndTime: newEndTime,
            lastUpdated: new Date().toISOString(),
          })
          .where(eq(auctionState.id, state.id));

        await logAction(state.currentRoundId, 'Auction resumed', 'resume');

        return NextResponse.json({ success: true, message: 'Auction resumed' });
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
            lastUpdated: new Date().toISOString(),
          })
          .where(eq(auctionState.id, state.id));

        return NextResponse.json({ success: true, message: 'Auction stopped' });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in auction control:', error);
    return NextResponse.json({ error: 'Failed to execute action' }, { status: 500 });
  }
}
