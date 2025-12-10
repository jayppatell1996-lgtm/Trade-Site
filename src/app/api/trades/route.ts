import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { trades, teams, players } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const allTrades = await db.select().from(trades).orderBy(trades.id);
    return NextResponse.json(allTrades);
  } catch (error) {
    console.error('Error fetching trades:', error);
    return NextResponse.json({ error: 'Failed to fetch trades' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.discordId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { team1Name, team2Name, players1, players2 } = body;

    // Verify user owns team1
    const allTeams = await db.select().from(teams);
    const team1 = allTeams.find(t => t.name === team1Name);
    const team2 = allTeams.find(t => t.name === team2Name);

    if (!team1 || !team2) {
      return NextResponse.json({ error: 'Invalid teams' }, { status: 400 });
    }

    if (team1.ownerId !== session.user.discordId) {
      return NextResponse.json({ error: 'You do not own this team' }, { status: 403 });
    }

    // Execute the trade
    const timestamp = new Date().toISOString();

    // Move players from team1 to team2
    for (const playerName of players1) {
      await db.update(players)
        .set({ teamId: team2.id })
        .where(eq(players.name, playerName));
    }

    // Move players from team2 to team1
    for (const playerName of players2) {
      await db.update(players)
        .set({ teamId: team1.id })
        .where(eq(players.name, playerName));
    }

    // Record the trade
    const newTrade = await db.insert(trades).values({
      timestamp,
      team1Name,
      team2Name,
      players1: JSON.stringify(players1),
      players2: JSON.stringify(players2),
    }).returning();

    return NextResponse.json(newTrade[0]);
  } catch (error) {
    console.error('Error creating trade:', error);
    return NextResponse.json({ error: 'Failed to create trade' }, { status: 500 });
  }
}
