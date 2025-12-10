import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { auctionState, auctionPlayers, teams, players, auctionLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';

const BID_INCREMENT_TIME = 12; // seconds for first bid
const BID_CONTINUE_TIME = 8; // seconds for subsequent bids
const TIMER_BUFFER_MS = 1000; // Allow bids up to 1 second after timer "expires"

// Robust lock with queue for concurrent bids
let bidLock = false;
let lockQueue: (() => void)[] = [];
const lockTimeout = 800; // ms - reduced for faster processing

async function acquireLock(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!bidLock) {
      bidLock = true;
      // Auto-release after timeout to prevent deadlock
      setTimeout(() => {
        releaseLock();
      }, lockTimeout);
      resolve(true);
    } else {
      // Queue the request with timeout
      const timeoutId = setTimeout(() => {
        const idx = lockQueue.indexOf(tryAcquire);
        if (idx > -1) lockQueue.splice(idx, 1);
        resolve(false);
      }, 200); // Wait max 200ms - faster retry

      const tryAcquire = () => {
        clearTimeout(timeoutId);
        bidLock = true;
        setTimeout(() => { releaseLock(); }, lockTimeout);
        resolve(true);
      };

      lockQueue.push(tryAcquire);
    }
  });
}

function releaseLock() {
  if (lockQueue.length > 0) {
    const next = lockQueue.shift();
    if (next) next();
  } else {
    bidLock = false;
  }
}

function getBidIncrement(basePrice: number): number {
  if (basePrice >= 2000000) return 1000000;
  if (basePrice >= 1000000) return 500000;
  if (basePrice >= 500000) return 250000;
  return basePrice;
}

export async function POST(request: NextRequest) {
  // Try to acquire lock
  const gotLock = await acquireLock();
  if (!gotLock) {
    return NextResponse.json({ 
      error: 'Another bid is being processed, please try again',
      retry: true 
    }, { status: 429 });
  }

  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.discordId) {
      releaseLock();
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user's team
    const userTeams = await db.select()
      .from(teams)
      .where(eq(teams.ownerId, session.user.discordId));

    if (userTeams.length === 0) {
      releaseLock();
      return NextResponse.json({ error: 'You do not own a team' }, { status: 403 });
    }

    const userTeam = userTeams[0];

    // Get current auction state (fresh read)
    const states = await db.select().from(auctionState);
    const state = states[0];

    if (!state || !state.isActive) {
      releaseLock();
      return NextResponse.json({ error: 'No active auction' }, { status: 400 });
    }

    if (state.isPaused) {
      releaseLock();
      return NextResponse.json({ error: 'Auction is paused' }, { status: 400 });
    }

    if (!state.currentPlayerId) {
      releaseLock();
      return NextResponse.json({ error: 'No player being auctioned' }, { status: 400 });
    }

    // Get current player
    const currentPlayers = await db.select()
      .from(auctionPlayers)
      .where(eq(auctionPlayers.id, state.currentPlayerId));

    const currentPlayer = currentPlayers[0];
    if (!currentPlayer) {
      releaseLock();
      return NextResponse.json({ error: 'Player not found' }, { status: 400 });
    }

    // Check team roster size
    const teamPlayers = await db.select()
      .from(players)
      .where(eq(players.teamId, userTeam.id));

    if (teamPlayers.length >= userTeam.maxSize) {
      releaseLock();
      return NextResponse.json({ error: 'Your team is at maximum capacity' }, { status: 400 });
    }

    // Calculate new bid based on CURRENT state (not stale)
    const basePrice = currentPlayer.basePrice;
    const increment = getBidIncrement(basePrice);
    const isFirstBid = !state.highestBidderId;
    
    let newBid: number;
    if (isFirstBid) {
      newBid = basePrice;
    } else {
      newBid = (state.currentBid || 0) + increment;
    }

    // Check if user has enough purse
    if (userTeam.purse < newBid) {
      releaseLock();
      return NextResponse.json({ 
        error: `Insufficient funds. Need $${newBid.toLocaleString()}, you have $${userTeam.purse.toLocaleString()}` 
      }, { status: 400 });
    }

    // Calculate new timer end time
    const timerDuration = isFirstBid ? BID_INCREMENT_TIME : BID_CONTINUE_TIME;
    const newTimerEndTime = Date.now() + (timerDuration * 1000);

    // Update auction state atomically
    await db.update(auctionState)
      .set({
        currentBid: newBid,
        highestBidderId: session.user.discordId,
        highestBidderTeam: userTeam.name,
        timerEndTime: newTimerEndTime,
        pausedTimeRemaining: null, // Clear any paused time
        lastUpdated: new Date().toISOString(),
      })
      .where(eq(auctionState.id, state.id));

    // Log the bid (async, don't wait)
    db.insert(auctionLogs).values({
      roundId: state.currentRoundId,
      message: `${userTeam.name} bid $${newBid.toLocaleString()} for ${currentPlayer.name}`,
      logType: 'bid',
      timestamp: new Date().toISOString(),
    }).catch(console.error);

    releaseLock();

    return NextResponse.json({ 
      success: true, 
      newBid,
      team: userTeam.name,
      timerEndTime: newTimerEndTime,
      remainingTime: timerDuration,
      message: `Bid placed: $${newBid.toLocaleString()} by ${userTeam.name}`
    });
  } catch (error) {
    releaseLock();
    console.error('Error placing bid:', error);
    return NextResponse.json({ error: 'Failed to place bid' }, { status: 500 });
  }
}
