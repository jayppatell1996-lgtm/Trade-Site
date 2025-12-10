import { NextResponse } from 'next/server';
import { db } from '@/db';
import { auctionLogs, auctionPlayers, auctionRounds, teams, players, unsoldPlayers } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

export async function GET() {
  try {
    // Get all logs
    const logs = await db.select()
      .from(auctionLogs)
      .orderBy(desc(auctionLogs.timestamp))
      .limit(500);

    // Get all auction players (sold ones)
    const soldPlayers = await db.select()
      .from(auctionPlayers)
      .where(eq(auctionPlayers.status, 'sold'));

    // Get all rounds
    const rounds = await db.select().from(auctionRounds);

    // Get all teams with players
    const allTeams = await db.select().from(teams);
    const allPlayers = await db.select().from(players);
    const allUnsold = await db.select().from(unsoldPlayers);

    // Calculate stats
    const totalSales = soldPlayers.reduce((sum, p) => sum + (p.soldFor || 0), 0);
    const averageSalePrice = soldPlayers.length > 0 ? totalSales / soldPlayers.length : 0;
    
    // Find highest sale
    const highestSale = soldPlayers.reduce((max, p) => {
      if ((p.soldFor || 0) > (max?.soldFor || 0)) return p;
      return max;
    }, soldPlayers[0]);

    // Team spending
    const teamSpending = allTeams.map(team => {
      const teamPlayers = allPlayers.filter(p => p.teamId === team.id);
      const spent = teamPlayers.reduce((sum, p) => sum + (p.boughtFor || 0), 0);
      return {
        name: team.name,
        spent,
        remaining: team.purse,
        playerCount: teamPlayers.length,
        maxSize: team.maxSize,
      };
    }).sort((a, b) => b.spent - a.spent);

    // Most expensive players
    const topSales = soldPlayers
      .sort((a, b) => (b.soldFor || 0) - (a.soldFor || 0))
      .slice(0, 10)
      .map(p => ({
        name: p.name,
        team: p.soldTo,
        amount: p.soldFor,
        category: p.category,
      }));

    // Category breakdown
    const categoryStats = soldPlayers.reduce((acc, p) => {
      const cat = p.category || 'Unknown';
      if (!acc[cat]) {
        acc[cat] = { count: 0, total: 0 };
      }
      acc[cat].count++;
      acc[cat].total += p.soldFor || 0;
      return acc;
    }, {} as Record<string, { count: number; total: number }>);

    // Round stats
    const roundStats = rounds.map(round => {
      const roundPlayers = soldPlayers.filter(p => p.roundId === round.id);
      const roundTotal = roundPlayers.reduce((sum, p) => sum + (p.soldFor || 0), 0);
      return {
        id: round.id,
        name: round.name,
        roundNumber: round.roundNumber,
        isCompleted: round.isCompleted,
        soldCount: roundPlayers.length,
        totalSpent: roundTotal,
        avgPrice: roundPlayers.length > 0 ? roundTotal / roundPlayers.length : 0,
      };
    });

    return NextResponse.json({
      logs,
      stats: {
        totalSales,
        totalPlayersSold: soldPlayers.length,
        averageSalePrice,
        highestSale: highestSale ? {
          player: highestSale.name,
          team: highestSale.soldTo,
          amount: highestSale.soldFor,
        } : null,
        unsoldCount: allUnsold.length,
      },
      teamSpending,
      topSales,
      categoryStats: Object.entries(categoryStats).map(([cat, data]) => ({
        category: cat,
        count: data.count,
        total: data.total,
        average: data.count > 0 ? data.total / data.count : 0,
      })),
      roundStats,
    });
  } catch (error) {
    console.error('Error fetching auction summary:', error);
    return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 });
  }
}
