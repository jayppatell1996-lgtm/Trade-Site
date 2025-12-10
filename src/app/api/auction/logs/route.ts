import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { auctionLogs, auctionHistory, auctionPlayers, auctionRounds, teams } from '@/db/schema';
import { eq, desc, sql, and } from 'drizzle-orm';

// GET: Fetch auction logs, history, and summary
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Fetch auction history (sales)
    const history = await db
      .select({
        id: auctionHistory.id,
        playerName: auctionHistory.playerName,
        teamName: auctionHistory.teamName,
        winningBid: auctionHistory.winningBid,
        winnerDiscordId: auctionHistory.winnerDiscordId,
        winnerDisplayName: auctionHistory.winnerDisplayName,
        newBalance: auctionHistory.newBalance,
        roundId: auctionHistory.roundId,
        createdAt: auctionHistory.createdAt,
      })
      .from(auctionHistory)
      .orderBy(desc(auctionHistory.createdAt))
      .limit(limit);

    // Fetch auction logs
    const logs = await db
      .select({
        id: auctionLogs.id,
        message: auctionLogs.message,
        type: auctionLogs.type,
        roundId: auctionLogs.roundId,
        createdAt: auctionLogs.createdAt,
      })
      .from(auctionLogs)
      .orderBy(desc(auctionLogs.createdAt))
      .limit(limit);

    // Fetch unsold players
    const unsoldPlayers = await db
      .select({
        id: auctionPlayers.id,
        name: auctionPlayers.name,
        category: auctionPlayers.category,
        basePrice: auctionPlayers.basePrice,
        roundId: auctionPlayers.roundId,
      })
      .from(auctionPlayers)
      .where(eq(auctionPlayers.status, 'unsold'))
      .orderBy(auctionPlayers.name);

    // Calculate summary statistics
    const [summaryStats] = await db
      .select({
        totalSold: sql<number>`count(*)`,
        totalSpent: sql<number>`sum(${auctionHistory.winningBid})`,
        highestBid: sql<number>`max(${auctionHistory.winningBid})`,
        avgBid: sql<number>`avg(${auctionHistory.winningBid})`,
      })
      .from(auctionHistory);

    // Get highest sale details
    const [highestSale] = await db
      .select()
      .from(auctionHistory)
      .orderBy(desc(auctionHistory.winningBid))
      .limit(1);

    // Count players by status
    const [playerCounts] = await db
      .select({
        total: sql<number>`count(*)`,
        pending: sql<number>`sum(case when ${auctionPlayers.status} = 'pending' then 1 else 0 end)`,
        sold: sql<number>`sum(case when ${auctionPlayers.status} = 'sold' then 1 else 0 end)`,
        unsold: sql<number>`sum(case when ${auctionPlayers.status} = 'unsold' then 1 else 0 end)`,
      })
      .from(auctionPlayers);

    // Get team spending summary
    const teamSpending = await db
      .select({
        teamName: auctionHistory.teamName,
        playersBought: sql<number>`count(*)`,
        totalSpent: sql<number>`sum(${auctionHistory.winningBid})`,
      })
      .from(auctionHistory)
      .groupBy(auctionHistory.teamName)
      .orderBy(desc(sql`sum(${auctionHistory.winningBid})`));

    return NextResponse.json({
      history,
      logs,
      unsoldPlayers,
      summary: {
        totalPlayersSold: summaryStats?.totalSold || 0,
        totalAmountSpent: summaryStats?.totalSpent || 0,
        highestBid: summaryStats?.highestBid || 0,
        averageBid: summaryStats?.avgBid || 0,
        highestSale: highestSale || null,
        playersRemaining: playerCounts?.pending || 0,
        playersUnsold: playerCounts?.unsold || 0,
        totalPlayers: playerCounts?.total || 0,
        teamSpending,
      },
    });
  } catch (error) {
    console.error('Error fetching auction logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch auction data' },
      { status: 500 }
    );
  }
}
