import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { auctionLogs } from '@/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  try {
    const logs = await db.select()
      .from(auctionLogs)
      .orderBy(desc(auctionLogs.timestamp))
      .limit(1000);

    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Error fetching auction logs:', error);
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roundId, message, logType } = body;

    const newLog = await db.insert(auctionLogs).values({
      roundId,
      message,
      logType,
      timestamp: new Date().toISOString(),
    }).returning();

    return NextResponse.json(newLog[0]);
  } catch (error) {
    console.error('Error creating log:', error);
    return NextResponse.json({ error: 'Failed to create log' }, { status: 500 });
  }
}
