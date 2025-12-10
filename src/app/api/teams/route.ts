import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { teams, players } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const allTeams = await db.select().from(teams);
    const allPlayers = await db.select().from(players);

    return NextResponse.json({
      teams: allTeams,
      players: allPlayers,
    });
  } catch (error) {
    console.error('Error fetching teams:', error);
    return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, ownerId, ownerName, maxSize, purse } = body;

    const newTeam = await db.insert(teams).values({
      name,
      ownerId,
      ownerName,
      maxSize: maxSize || 20,
      purse: purse || 50000000,
    }).returning();

    return NextResponse.json(newTeam[0]);
  } catch (error) {
    console.error('Error creating team:', error);
    return NextResponse.json({ error: 'Failed to create team' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, ownerId, ownerName, maxSize, purse } = body;

    const updated = await db.update(teams)
      .set({ name, ownerId, ownerName, maxSize, purse })
      .where(eq(teams.id, id))
      .returning();

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error('Error updating team:', error);
    return NextResponse.json({ error: 'Failed to update team' }, { status: 500 });
  }
}
