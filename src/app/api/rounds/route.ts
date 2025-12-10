import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { auctionRounds, auctionPlayers } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

// GET: Fetch all rounds with player counts
export async function GET() {
  try {
    const rounds = await db.select().from(auctionRounds).orderBy(auctionRounds.roundNumber);
    
    const roundsWithCounts = await Promise.all(
      rounds.map(async (round) => {
        const [counts] = await db
          .select({
            total: sql<number>`count(*)`,
            pending: sql<number>`sum(case when status = 'pending' then 1 else 0 end)`,
            sold: sql<number>`sum(case when status = 'sold' then 1 else 0 end)`,
            unsold: sql<number>`sum(case when status = 'unsold' then 1 else 0 end)`,
          })
          .from(auctionPlayers)
          .where(eq(auctionPlayers.roundId, round.id));

        return {
          ...round,
          totalPlayers: counts?.total || 0,
          pendingPlayers: counts?.pending || 0,
          soldPlayers: counts?.sold || 0,
          unsoldPlayers: counts?.unsold || 0,
        };
      })
    );

    return NextResponse.json(roundsWithCounts);
  } catch (error) {
    console.error('Error fetching rounds:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rounds' },
      { status: 500 }
    );
  }
}

// POST: Create new round or add players to round
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, roundId, roundNumber, name, players: playersList } = body;

    if (action === 'createRound') {
      // Create new round
      const [newRound] = await db.insert(auctionRounds).values({
        roundNumber,
        name,
        status: 'pending',
        createdAt: new Date().toISOString(),
      }).returning();

      return NextResponse.json({ success: true, round: newRound });
    }

    if (action === 'addPlayers' && roundId && playersList) {
      // Add players to existing round
      const playersToInsert = playersList.map((player: { name: string; category: string; basePrice: number }, index: number) => ({
        roundId,
        name: player.name,
        category: player.category,
        basePrice: player.basePrice,
        status: 'pending',
        orderIndex: index,
      }));

      await db.insert(auctionPlayers).values(playersToInsert);

      return NextResponse.json({ 
        success: true, 
        message: `Added ${playersList.length} players to round` 
      });
    }

    if (action === 'importJSON' && roundId) {
      // Import players from JSON structure
      const playersToInsert = playersList.map((player: { name: string; category: string; base_price: number }, index: number) => ({
        roundId,
        name: player.name,
        category: player.category,
        basePrice: player.base_price,
        status: 'pending',
        orderIndex: index,
      }));

      await db.insert(auctionPlayers).values(playersToInsert);

      return NextResponse.json({ 
        success: true, 
        message: `Imported ${playersList.length} players` 
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in rounds POST:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
