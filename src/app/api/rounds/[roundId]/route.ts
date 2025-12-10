import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { auctionRounds, auctionPlayers, teams } from '@/db/schema';
import { eq } from 'drizzle-orm';

// GET: Fetch players in a specific round
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roundId: string }> }
) {
  try {
    const { roundId } = await params;
    const roundIdNum = parseInt(roundId, 10);

    // Get round info
    const [round] = await db
      .select()
      .from(auctionRounds)
      .where(eq(auctionRounds.id, roundIdNum));

    if (!round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 });
    }

    // Get all players in round with sold team info
    const roundPlayers = await db
      .select({
        id: auctionPlayers.id,
        name: auctionPlayers.name,
        category: auctionPlayers.category,
        basePrice: auctionPlayers.basePrice,
        status: auctionPlayers.status,
        soldPrice: auctionPlayers.soldPrice,
        soldAt: auctionPlayers.soldAt,
        orderIndex: auctionPlayers.orderIndex,
        soldToTeamId: auctionPlayers.soldToTeamId,
      })
      .from(auctionPlayers)
      .where(eq(auctionPlayers.roundId, roundIdNum))
      .orderBy(auctionPlayers.orderIndex);

    // Get team names for sold players
    const playersWithTeams = await Promise.all(
      roundPlayers.map(async (player) => {
        let soldToTeamName = null;
        if (player.soldToTeamId) {
          const [team] = await db
            .select({ name: teams.name })
            .from(teams)
            .where(eq(teams.id, player.soldToTeamId));
          soldToTeamName = team?.name || null;
        }
        return {
          ...player,
          soldToTeamName,
        };
      })
    );

    return NextResponse.json({
      round,
      players: playersWithTeams,
    });
  } catch (error) {
    console.error('Error fetching round players:', error);
    return NextResponse.json(
      { error: 'Failed to fetch round players' },
      { status: 500 }
    );
  }
}

// DELETE: Remove a player from round
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roundId: string }> }
) {
  try {
    const { roundId } = await params;
    const { playerId } = await request.json();

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 });
    }

    await db.delete(auctionPlayers).where(eq(auctionPlayers.id, playerId));

    return NextResponse.json({ success: true, message: 'Player removed' });
  } catch (error) {
    console.error('Error removing player:', error);
    return NextResponse.json(
      { error: 'Failed to remove player' },
      { status: 500 }
    );
  }
}
