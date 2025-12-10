import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { teams, players } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

// GET: Fetch all teams with players and purse
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    const includePlayers = searchParams.get('includePlayers') !== 'false';

    // If specific team requested
    if (teamId) {
      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, parseInt(teamId, 10)));
      
      if (!team) {
        return NextResponse.json({ error: 'Team not found' }, { status: 404 });
      }

      const teamPlayers = await db
        .select()
        .from(players)
        .where(eq(players.teamId, team.id));
      
      return NextResponse.json({
        ...team,
        players: teamPlayers,
        playerCount: teamPlayers.length,
      });
    }

    // Fetch all teams
    const allTeams = await db.select().from(teams);
    
    const teamsWithPlayers = await Promise.all(
      allTeams.map(async (team) => {
        if (includePlayers) {
          const teamPlayers = await db
            .select()
            .from(players)
            .where(eq(players.teamId, team.id));
          
          return {
            ...team,
            players: teamPlayers,
            playerCount: teamPlayers.length,
          };
        }
        
        // Just get count
        const [countResult] = await db
          .select({ count: sql<number>`count(*)` })
          .from(players)
          .where(eq(players.teamId, team.id));
        
        return {
          ...team,
          playerCount: countResult?.count || 0,
        };
      })
    );

    return NextResponse.json(teamsWithPlayers);
  } catch (error) {
    console.error('Error fetching teams:', error);
    return NextResponse.json(
      { error: 'Failed to fetch teams' },
      { status: 500 }
    );
  }
}

// PUT: Update team (purse, owner, etc.)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { teamId, purse, ownerId, maxSize, name } = body;

    if (!teamId) {
      return NextResponse.json({ error: 'Team ID required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (purse !== undefined) updateData.purse = purse;
    if (ownerId !== undefined) updateData.ownerId = ownerId;
    if (maxSize !== undefined) updateData.maxSize = maxSize;
    if (name !== undefined) updateData.name = name;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    await db.update(teams).set(updateData).where(eq(teams.id, teamId));

    return NextResponse.json({ success: true, message: 'Team updated' });
  } catch (error) {
    console.error('Error updating team:', error);
    return NextResponse.json(
      { error: 'Failed to update team' },
      { status: 500 }
    );
  }
}

// POST: Create new team
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, ownerId, purse = 20000000, maxSize = 20 } = body;

    if (!name || !ownerId) {
      return NextResponse.json(
        { error: 'Name and owner ID required' },
        { status: 400 }
      );
    }

    const [newTeam] = await db.insert(teams).values({
      name,
      ownerId,
      purse,
      maxSize,
      createdAt: new Date().toISOString(),
    }).returning();

    return NextResponse.json({ success: true, team: newTeam });
  } catch (error) {
    console.error('Error creating team:', error);
    return NextResponse.json(
      { error: 'Failed to create team' },
      { status: 500 }
    );
  }
}
