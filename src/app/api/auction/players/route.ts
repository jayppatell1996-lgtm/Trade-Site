import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, ADMIN_IDS } from '@/lib/auth';
import { db } from '@/db';
import { auctionPlayers, auctionRounds } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roundId = searchParams.get('roundId');

    if (roundId) {
      const players = await db.select()
        .from(auctionPlayers)
        .where(eq(auctionPlayers.roundId, parseInt(roundId)))
        .orderBy(auctionPlayers.orderIndex);
      return NextResponse.json(players);
    }

    const allPlayers = await db.select().from(auctionPlayers);
    return NextResponse.json(allPlayers);
  } catch (error) {
    console.error('Error fetching auction players:', error);
    return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.discordId || !ADMIN_IDS.includes(session.user.discordId)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { roundId, name, category, basePrice } = body;

    // Get max order index for this round
    const existingPlayers = await db.select()
      .from(auctionPlayers)
      .where(eq(auctionPlayers.roundId, roundId));
    
    const maxOrder = existingPlayers.reduce((max, p) => Math.max(max, p.orderIndex || 0), -1);

    const newPlayer = await db.insert(auctionPlayers).values({
      roundId,
      name,
      category,
      basePrice,
      status: 'pending',
      orderIndex: maxOrder + 1,
    }).returning();

    return NextResponse.json(newPlayer[0]);
  } catch (error) {
    console.error('Error adding auction player:', error);
    return NextResponse.json({ error: 'Failed to add player' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.discordId || !ADMIN_IDS.includes(session.user.discordId)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const playerId = searchParams.get('id');

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 });
    }

    await db.delete(auctionPlayers).where(eq(auctionPlayers.id, parseInt(playerId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting auction player:', error);
    return NextResponse.json({ error: 'Failed to delete player' }, { status: 500 });
  }
}
