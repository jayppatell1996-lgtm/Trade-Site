import { NextResponse } from 'next/server';
import { db } from '@/db';
import { auctionLogs, auctionRounds, auctionPlayers } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';

export async function GET() {
  try {
    // Get all logs
    const logs = await db.select()
      .from(auctionLogs)
      .orderBy(desc(auctionLogs.id));

    // Get all rounds
    const rounds = await db.select()
      .from(auctionRounds)
      .orderBy(auctionRounds.roundNumber);

    // Get all auction players for stats
    const allAuctionPlayers = await db.select().from(auctionPlayers);

    // Calculate round-level stats
    const roundStats = rounds.map(round => {
      const roundPlayers = allAuctionPlayers.filter(p => p.roundId === round.id);
      return {
        ...round,
        totalPlayers: roundPlayers.length,
        soldPlayers: roundPlayers.filter(p => p.status === 'sold').length,
        unsoldPlayers: roundPlayers.filter(p => p.status === 'unsold').length,
        pendingPlayers: roundPlayers.filter(p => p.status === 'pending').length,
      };
    });

    return NextResponse.json({
      logs,
      rounds: roundStats,
      totalLogs: logs.length,
    });
  } catch (error) {
    console.error('Error fetching auction summary:', error);
    return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 });
  }
}
