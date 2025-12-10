import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auctionState, auctionPlayers, teams } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Timer constants
const BID_INCREMENT_TIME = 12; // Initial timer (seconds)
const BID_CONTINUE_TIME = 8;   // Timer after bid (seconds)

export async function GET() {
  try {
    const states = await db.select().from(auctionState).limit(1);
    
    if (states.length === 0) {
      return NextResponse.json({
        isActive: false,
        currentPlayerId: null,
        currentPlayer: null,
        currentBid: 0,
        highestBidderId: null,
        highestBidderName: null,
        remainingTime: 0,
        isPaused: false,
        roundId: null
      });
    }

    const state = states[0];
    
    // Get current player details if there's an active auction
    let currentPlayer = null;
    if (state.currentPlayerId) {
      const players = await db.select().from(auctionPlayers)
        .where(eq(auctionPlayers.id, state.currentPlayerId));
      if (players.length > 0) {
        currentPlayer = players[0];
      }
    }

    // Get highest bidder team name
    let highestBidderName = null;
    if (state.highestBidderId) {
      const teamResults = await db.select().from(teams)
        .where(eq(teams.ownerId, state.highestBidderId));
      if (teamResults.length > 0) {
        highestBidderName = teamResults[0].name;
      }
    }

    // Calculate remaining time properly
    let remainingTime = 0;
    const timerEndTime = state.timerEndTime ? Number(state.timerEndTime) : 0;
    
    if (state.isActive && timerEndTime > 0) {
      if (state.isPaused) {
        // When paused, timerEndTime stores remaining milliseconds directly
        // But we need to check if it's a reasonable value (not a timestamp)
        if (timerEndTime < 100000) {
          // It's stored as milliseconds remaining
          remainingTime = Math.max(0, Math.ceil(timerEndTime / 1000));
        } else {
          // It's a timestamp - calculate remaining time from when it was paused
          // This shouldn't happen with our new logic, default to 12s
          remainingTime = BID_INCREMENT_TIME;
        }
      } else {
        // When active, timerEndTime is the Unix timestamp when auction ends
        const now = Date.now();
        remainingTime = Math.max(0, Math.ceil((timerEndTime - now) / 1000));
      }
    }

    // Ensure remainingTime is a valid number
    if (!Number.isFinite(remainingTime) || remainingTime < 0) {
      remainingTime = 0;
    }
    
    // Cap at maximum reasonable value
    if (remainingTime > BID_INCREMENT_TIME) {
      remainingTime = BID_INCREMENT_TIME;
    }

    return NextResponse.json({
      isActive: state.isActive,
      currentPlayerId: state.currentPlayerId,
      currentPlayer,
      currentBid: state.currentBid || 0,
      highestBidderId: state.highestBidderId,
      highestBidderName,
      remainingTime,
      isPaused: state.isPaused,
      roundId: state.roundId
    });
  } catch (error) {
    console.error('Error fetching auction state:', error);
    return NextResponse.json({ error: 'Failed to fetch auction state' }, { status: 500 });
  }
}
