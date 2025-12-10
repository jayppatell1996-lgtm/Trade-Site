import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { auctionPlayers } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Next.js 16+ requires params to be awaited
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roundId: string }> }
) {
  try {
    const { roundId } = await params;
    
    const players = await db.select()
      .from(auctionPlayers)
      .where(eq(auctionPlayers.roundId, parseInt(roundId)))
      .orderBy(auctionPlayers.orderIndex);
    
    return NextResponse.json(players);
  } catch (error) {
    console.error('Error fetching round players:', error);
    return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 });
  }
}
