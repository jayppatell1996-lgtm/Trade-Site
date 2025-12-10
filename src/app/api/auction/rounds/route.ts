import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auctionRounds, auctionPlayers } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const ADMIN_IDS = ['256972361918578688', '1111497896018313268'];

// GET - List all auction rounds
export async function GET() {
  try {
    const rounds = await db.select().from(auctionRounds).orderBy(desc(auctionRounds.createdAt));
    return NextResponse.json({ rounds });
  } catch (error) {
    console.error('Error fetching rounds:', error);
    return NextResponse.json({ error: 'Failed to fetch rounds' }, { status: 500 });
  }
}

// POST - Create a new auction round
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !ADMIN_IDS.includes(session.user.id)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, players } = body;

    if (!name) {
      return NextResponse.json({ error: 'Round name required' }, { status: 400 });
    }

    // Create the round
    const [round] = await db.insert(auctionRounds).values({
      name,
      status: 'pending',
      createdAt: new Date()
    }).returning();

    // Add players if provided
    if (players && Array.isArray(players)) {
      for (const player of players) {
        await db.insert(auctionPlayers).values({
          roundId: round.id,
          playerId: player.id || null, // Original player ID from import
          name: player.name,
          category: player.category || 'Unknown',
          basePrice: player.base_price || player.basePrice || 100000,
          status: 'pending'
        });
      }
    }

    return NextResponse.json({ success: true, round });
  } catch (error) {
    console.error('Error creating round:', error);
    return NextResponse.json({ error: 'Failed to create round' }, { status: 500 });
  }
}

// DELETE - Delete an auction round
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !ADMIN_IDS.includes(session.user.id)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const roundId = searchParams.get('id');

    if (!roundId) {
      return NextResponse.json({ error: 'Round ID required' }, { status: 400 });
    }

    const id = parseInt(roundId, 10);

    // Delete all players in the round first
    await db.delete(auctionPlayers).where(eq(auctionPlayers.roundId, id));
    
    // Delete the round
    await db.delete(auctionRounds).where(eq(auctionRounds.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting round:', error);
    return NextResponse.json({ error: 'Failed to delete round' }, { status: 500 });
  }
}
