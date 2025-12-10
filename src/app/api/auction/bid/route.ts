import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auctionState, auctionPlayers, auctionLogs, teams } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Timer constants
const BID_CONTINUE_TIME = 8000; // 8 seconds in ms (after each bid)

// Simple mutex lock for race condition protection
let bidLock = false;
const lockTimeout = 500; // ms

async function acquireLock(): Promise<boolean> {
  if (bidLock) {
    // Wait a bit and try again
    await new Promise(resolve => setTimeout(resolve, 50));
    if (bidLock) {
      return false;
    }
  }
  bidLock = true;
  // Auto-release after timeout to prevent deadlock
  setTimeout(() => { bidLock = false; }, lockTimeout);
  return true;
}

function releaseLock() {
  bidLock = false;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Try to acquire lock
    const gotLock = await acquireLock();
    if (!gotLock) {
      return NextResponse.json({ error: 'Server busy, please retry', retry: true }, { status: 429 });
    }

    try {
      // Get user's team
      const userTeams = await db.select().from(teams)
        .where(eq(teams.ownerId, session.user.id));
      
      if (userTeams.length === 0) {
        return NextResponse.json({ error: 'You do not own a team' }, { status: 403 });
      }

      const userTeam = userTeams[0];

      // Get current auction state
      const states = await db.select().from(auctionState).limit(1);
      if (states.length === 0) {
        return NextResponse.json({ error: 'No auction in progress' }, { status: 400 });
      }

      const state = states[0];

      // Check if auction is active (allow bidding even on last second)
      if (!state.isActive) {
        return NextResponse.json({ error: 'No active auction' }, { status: 400 });
      }

      if (state.isPaused) {
        return NextResponse.json({ error: 'Auction is paused' }, { status: 400 });
      }

      // Check timer - allow bidding if auction is active, even at 0 seconds
      // The timer check is more lenient - we only reject if auction has already ended
      const now = Date.now();
      const timerEndTime = Number(state.timerEndTime) || 0;
      
      // Give 500ms grace period for last-second bids
      if (timerEndTime > 0 && now > timerEndTime + 500) {
        return NextResponse.json({ error: 'Auction time expired' }, { status: 400 });
      }

      // Get current player
      if (!state.currentPlayerId) {
        return NextResponse.json({ error: 'No player being auctioned' }, { status: 400 });
      }

      const players = await db.select().from(auctionPlayers)
        .where(eq(auctionPlayers.id, state.currentPlayerId));
      
      if (players.length === 0) {
        return NextResponse.json({ error: 'Player not found' }, { status: 404 });
      }

      const player = players[0];
      const basePrice = player.basePrice;

      // Calculate bid increment based on base price
      let increment: number;
      if (basePrice >= 2000000) {
        increment = 1000000;
      } else if (basePrice >= 1000000) {
        increment = 500000;
      } else if (basePrice >= 500000) {
        increment = 250000;
      } else {
        increment = basePrice || 100000;
      }

      // Calculate new bid
      const isFirstBid = state.highestBidderId === null;
      const newBid = isFirstBid ? basePrice : (state.currentBid + increment);

      // Check if user has enough purse
      if (userTeam.purse < newBid) {
        return NextResponse.json({ 
          error: 'Insufficient funds',
          required: newBid,
          available: userTeam.purse
        }, { status: 400 });
      }

      // Check team size
      const teamPlayers = userTeam.players ? JSON.parse(userTeam.players) : [];
      if (teamPlayers.length >= (userTeam.maxSize || 20)) {
        return NextResponse.json({ error: 'Team is full' }, { status: 400 });
      }

      // Reset timer to 8 seconds from now
      const newTimerEnd = Date.now() + BID_CONTINUE_TIME;

      // Update auction state
      await db.update(auctionState)
        .set({
          currentBid: newBid,
          highestBidderId: session.user.id,
          timerEndTime: newTimerEnd
        })
        .where(eq(auctionState.id, state.id));

      // Log the bid
      await db.insert(auctionLogs).values({
        eventType: 'bid',
        playerId: state.currentPlayerId,
        playerName: player.name,
        teamId: userTeam.id,
        teamName: userTeam.name,
        userId: session.user.id,
        amount: newBid,
        roundId: state.roundId,
        timestamp: new Date()
      });

      return NextResponse.json({ 
        success: true, 
        newBid,
        teamName: userTeam.name,
        remainingTime: BID_CONTINUE_TIME / 1000 // Return 8 seconds
      });

    } finally {
      releaseLock();
    }

  } catch (error) {
    console.error('Bid error:', error);
    releaseLock();
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
