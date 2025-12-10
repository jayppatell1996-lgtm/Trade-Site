import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { auctionState, auctionPlayers, auctionRounds, teams, auctionLogs, players } from '@/db/schema';
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
      const auctionPlayerList = await db.select().from(auctionPlayers).where(eq(auctionPlayers.id, state.currentPlayerId));
      currentPlayer = auctionPlayerList[0] || null;
    }

    // Get current round details
    let currentRound = null;
    if (state.currentRoundId) {
      const rounds = await db.select().from(auctionRounds).where(eq(auctionRounds.id, state.currentRoundId));
      currentRound = rounds[0] || null;
    }

    // Get all teams for purse display with player counts
    const allTeams = await db.select().from(teams);
    const allPlayers = await db.select().from(players);
    
    const teamsWithCount = allTeams.map(team => ({
      ...team,
      playerCount: allPlayers.filter(p => p.teamId === team.id).length,
    }));

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
    if (state.timerEndTime && state.isActive) {
      if (state.isPaused) {
        // When paused, timerEndTime stores the remaining milliseconds (should be < 60000)
        if (state.timerEndTime < 60000) {
          remainingTime = Math.max(0, Math.floor(state.timerEndTime / 1000));
        } else {
          // Fallback - might be corrupted, use default
          remainingTime = 10;
        }
      } else {
        // When active, timerEndTime is the actual end timestamp
        // Validate it's a reasonable timestamp (within last hour to next hour)
        const now = Date.now();
        if (state.timerEndTime > now - 3600000 && state.timerEndTime < now + 3600000) {
          remainingTime = Math.max(0, Math.floor((state.timerEndTime - now) / 1000));
        } else {
          // Corrupted timestamp - show 0
          remainingTime = 0;
        }
      }
    }

    // Get last sale from logs
    let lastSale = null;
    const saleLog = recentLogs.find(log => log.logType === 'sale');
    if (saleLog) {
      // Parse the sale log message: "Player Name sold to Team for $Amount"
      const match = saleLog.message.match(/(.+) sold to (.+) for \$(.+)/);
      if (match) {
        lastSale = {
          playerName: match[1],
          teamName: match[2],
          amount: parseFloat(match[3].replace(/,/g, '')),
        };
      }
    }

    return NextResponse.json({
      ...state,
      currentPlayer,
      currentRound,
      teams: teamsWithCount,
      pendingPlayers: pendingPlayers.filter(p => p.status === 'pending'),
      recentLogs,
      remainingTime,
      lastSale,
    });
  } catch (error) {
    console.error('Error fetching auction state:', error);
    return NextResponse.json({ error: 'Failed to fetch auction state' }, { status: 500 });
  }
}
