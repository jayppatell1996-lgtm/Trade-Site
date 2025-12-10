import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, ADMIN_IDS } from '@/lib/auth';
import { db } from '@/db';
import { unsoldPlayers } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const players = await db.select().from(unsoldPlayers);
    return NextResponse.json(players);
  } catch (error) {
    console.error('Error fetching unsold players:', error);
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
    const { name, category, basePrice, originalRoundId } = body;

    const newPlayer = await db.insert(unsoldPlayers).values({
      name,
      category,
      basePrice,
      originalRoundId,
      addedAt: new Date().toISOString(),
    }).returning();

    return NextResponse.json(newPlayer[0]);
  } catch (error) {
    console.error('Error adding unsold player:', error);
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
    const clearAll = searchParams.get('clearAll');

    if (clearAll === 'true') {
      await db.delete(unsoldPlayers);
      return NextResponse.json({ success: true, message: 'All unsold players cleared' });
    }

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 });
    }

    await db.delete(unsoldPlayers).where(eq(unsoldPlayers.id, parseInt(playerId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting unsold player:', error);
    return NextResponse.json({ error: 'Failed to delete player' }, { status: 500 });
  }
}
