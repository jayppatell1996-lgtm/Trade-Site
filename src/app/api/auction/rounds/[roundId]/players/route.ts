import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auctionPlayers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { roundId: string } }
) {
  try {
    const roundId = parseInt(params.roundId, 10);
    
    if (isNaN(roundId)) {
      return NextResponse.json({ error: 'Invalid round ID' }, { status: 400 });
    }

    const players = await db.select().from(auctionPlayers)
      .where(eq(auctionPlayers.roundId, roundId));

    return NextResponse.json({ players });
  } catch (error) {
    console.error('Error fetching players:', error);
    return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 });
  }
}
