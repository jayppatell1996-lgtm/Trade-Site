import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, ADMIN_IDS } from '@/lib/auth';
import { db } from '@/db';
import { teams, players, auctionRounds, auctionPlayers, unsoldPlayers } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.discordId || !ADMIN_IDS.includes(session.user.discordId)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'import_teams': {
        // Import teams from JSON
        const teamsData = data.teams || data;
        
        for (const [teamName, teamInfo] of Object.entries(teamsData as Record<string, any>)) {
          // Check if team exists
          const existing = await db.select().from(teams).where(eq(teams.name, teamName));
          
          if (existing.length > 0) {
            // Update existing team
            await db.update(teams)
              .set({
                ownerId: String(teamInfo.owner),
                maxSize: teamInfo.max_size || 20,
                purse: teamInfo.purse || 50000000,
              })
              .where(eq(teams.name, teamName));

            // Update players
            await db.delete(players).where(eq(players.teamId, existing[0].id));
            
            if (teamInfo.players && teamInfo.players.length > 0) {
              const playerInserts = teamInfo.players.map((playerName: string) => ({
                playerId: `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: playerName,
                teamId: existing[0].id,
              }));
              await db.insert(players).values(playerInserts);
            }
          } else {
            // Create new team
            const newTeam = await db.insert(teams).values({
              name: teamName,
              ownerId: String(teamInfo.owner),
              maxSize: teamInfo.max_size || 20,
              purse: teamInfo.purse || 50000000,
            }).returning();

            if (teamInfo.players && teamInfo.players.length > 0) {
              const playerInserts = teamInfo.players.map((playerName: string) => ({
                playerId: `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: playerName,
                teamId: newTeam[0].id,
              }));
              await db.insert(players).values(playerInserts);
            }
          }
        }

        return NextResponse.json({ success: true, message: 'Teams imported successfully' });
      }

      case 'import_auction_round': {
        // Import auction round from JSON
        const { roundNumber, name, players: playersData } = data;

        // Check if round exists
        const existing = await db.select()
          .from(auctionRounds)
          .where(eq(auctionRounds.roundNumber, roundNumber));

        let roundId: number;

        if (existing.length > 0) {
          // Delete existing players for this round
          await db.delete(auctionPlayers).where(eq(auctionPlayers.roundId, existing[0].id));
          roundId = existing[0].id;
          
          // Update round name
          await db.update(auctionRounds)
            .set({ name })
            .where(eq(auctionRounds.id, roundId));
        } else {
          // Create new round
          const newRound = await db.insert(auctionRounds).values({
            roundNumber,
            name,
            isActive: false,
            isCompleted: false,
          }).returning();
          roundId = newRound[0].id;
        }

        // Add players
        if (playersData && playersData.length > 0) {
          const playerInserts = playersData.map((player: any, index: number) => ({
            roundId,
            name: player.name,
            category: player.category,
            basePrice: player.base_price || player.basePrice,
            status: 'pending',
            orderIndex: index,
          }));
          await db.insert(auctionPlayers).values(playerInserts);
        }

        return NextResponse.json({ 
          success: true, 
          message: `Round ${roundNumber} imported with ${playersData?.length || 0} players` 
        });
      }

      case 'update_team': {
        // Update single team
        const { id, name, ownerId, ownerName, maxSize, purse } = data;

        await db.update(teams)
          .set({ name, ownerId, ownerName, maxSize, purse })
          .where(eq(teams.id, id));

        return NextResponse.json({ success: true, message: 'Team updated' });
      }

      case 'add_player': {
        // Add player to team
        const { teamId, playerName, category } = data;

        await db.insert(players).values({
          playerId: `manual-${Date.now()}`,
          name: playerName,
          teamId,
          category,
        });

        return NextResponse.json({ success: true, message: 'Player added' });
      }

      case 'remove_player': {
        // Remove player from team
        const { playerId } = data;

        await db.delete(players).where(eq(players.id, playerId));

        return NextResponse.json({ success: true, message: 'Player removed' });
      }

      case 'clear_unsold': {
        // Clear unsold players list
        await db.delete(unsoldPlayers);

        return NextResponse.json({ success: true, message: 'Unsold players cleared' });
      }

      case 'import_unsold': {
        // Import unsold players
        const unsoldData = data.unsold || data;

        for (const player of unsoldData) {
          await db.insert(unsoldPlayers).values({
            name: player.name,
            category: player.category,
            basePrice: player.base_price || player.basePrice,
            addedAt: new Date().toISOString(),
          });
        }

        return NextResponse.json({ 
          success: true, 
          message: `${unsoldData.length} unsold players imported` 
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in admin action:', error);
    return NextResponse.json({ error: 'Failed to execute action' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.discordId || !ADMIN_IDS.includes(session.user.discordId)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all data for admin view
    const allTeams = await db.select().from(teams);
    const allPlayers = await db.select().from(players);
    const allRounds = await db.select().from(auctionRounds);
    const allAuctionPlayers = await db.select().from(auctionPlayers);
    const allUnsold = await db.select().from(unsoldPlayers);

    return NextResponse.json({
      teams: allTeams,
      players: allPlayers,
      rounds: allRounds,
      auctionPlayers: allAuctionPlayers,
      unsoldPlayers: allUnsold,
    });
  } catch (error) {
    console.error('Error fetching admin data:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
