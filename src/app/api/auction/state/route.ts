import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { auctionState, auctionPlayers, auctionRounds, teams, auctionLogs } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET() {
  try {
    // Get current auction state (there should only be one row)
    const states = await db.select().from(auctionState);
    let state = states[0];

    // If no state exists, create one
    if (!state) {
      const newState = await db.insert(auctionState).values({
        isActive: false,
        isPaused: false,
      }).returning();
      state = newState[0];
    }

    // Get current player details if there's an active auction
    let currentPlayer = null;
    if (state.currentPlayerId) {
      const players = await db.select().from(auctionPlayers).where(eq(auctionPlayers.id, state.currentPlayerId));
      currentPlayer = players[0] || null;
    }

    // Get current round details
    let currentRound = null;
    if (state.currentRoundId) {
      const rounds = await db.select().from(auctionRounds).where(eq(auctionRounds.id, state.currentRoundId));
      currentRound = rounds[0] || null;
    }

    // Get all teams for purse display
    const allTeams = await db.select().from(teams);

    // Get pending players count for current round
    let pendingPlayers: any[] = [];
    if (state.currentRoundId) {
      pendingPlayers = await db.select()
        .from(auctionPlayers)
        .where(eq(auctionPlayers.roundId, state.currentRoundId));
    }

    // Get recent logs
    const recentLogs = await db.select()
      .from(auctionLogs)
      .orderBy(desc(auctionLogs.id))
      .limit(10);

    // Calculate remaining time
    let remainingTime = 0;
    if (state.timerEndTime && state.isActive && !state.isPaused) {
      remainingTime = Math.max(0, Math.floor((state.timerEndTime - Date.now()) / 1000));
    }

    return NextResponse.json({
      ...state,
      currentPlayer,
      currentRound,
      teams: allTeams,
      pendingPlayers: pendingPlayers.filter(p => p.status === 'pending'),
      recentLogs,
      remainingTime,
    });
  } catch (error) {
    console.error('Error fetching auction state:', error);
    return NextResponse.json({ error: 'Failed to fetch auction state' }, { status: 500 });
  }
}
