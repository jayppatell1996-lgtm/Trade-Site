import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, ADMIN_IDS } from '@/lib/auth';
import { db } from '@/db';
import { auctionRounds, auctionPlayers } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const rounds = await db.select().from(auctionRounds).orderBy(auctionRounds.roundNumber);
    
    // Get player counts for each round
    const allPlayers = await db.select().from(auctionPlayers);
    
    const roundsWithStats = rounds.map(round => {
      const roundPlayers = allPlayers.filter(p => p.roundId === round.id);
      return {
        ...round,
        totalPlayers: roundPlayers.length,
        pendingPlayers: roundPlayers.filter(p => p.status === 'pending').length,
        soldPlayers: roundPlayers.filter(p => p.status === 'sold').length,
        unsoldPlayers: roundPlayers.filter(p => p.status === 'unsold').length,
      };
    });

    return NextResponse.json(roundsWithStats);
  } catch (error) {
    console.error('Error fetching rounds:', error);
    return NextResponse.json({ error: 'Failed to fetch rounds' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.discordId || !ADMIN_IDS.includes(session.user.discordId)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { roundNumber, name, players: playersData } = body;

    // Helper to generate player ID from name
    const generatePlayerId = (playerName: string): string => {
      return playerName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
    };

    // Create the round
    const newRound = await db.insert(auctionRounds).values({
      roundNumber,
      name,
      isActive: false,
      isCompleted: false,
    }).returning();

    // Add players to the round
    if (playersData && playersData.length > 0) {
      const playerInserts = playersData.map((player: any, index: number) => {
        const playerId = player.player_id || player.playerId || generatePlayerId(player.name);
        // Debug: Log what player_id we're using
        console.log(`Adding player to round: name=${player.name}, player_id from JSON=${player.player_id}, playerId from JSON=${player.playerId}, using=${playerId}`);
        return {
          roundId: newRound[0].id,
          playerId: playerId,
          name: player.name,
          category: player.category,
          basePrice: player.base_price || player.basePrice,
          status: 'pending',
          orderIndex: index,
        };
      });

      await db.insert(auctionPlayers).values(playerInserts);
    }

    return NextResponse.json(newRound[0]);
  } catch (error) {
    console.error('Error creating round:', error);
    return NextResponse.json({ error: 'Failed to create round' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.discordId || !ADMIN_IDS.includes(session.user.discordId)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const roundId = searchParams.get('id');

    if (!roundId) {
      return NextResponse.json({ error: 'Round ID required' }, { status: 400 });
    }

    // Delete players first
    await db.delete(auctionPlayers).where(eq(auctionPlayers.roundId, parseInt(roundId)));
    
    // Delete round
    await db.delete(auctionRounds).where(eq(auctionRounds.id, parseInt(roundId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting round:', error);
    return NextResponse.json({ error: 'Failed to delete round' }, { status: 500 });
  }
}
