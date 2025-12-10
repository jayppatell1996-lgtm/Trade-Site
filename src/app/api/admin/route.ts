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
        // Import teams from JSON - OVERWRITES existing data
        const teamsData = data.teams || data;
        let importedCount = 0;
        let updatedCount = 0;
        
        for (const [teamName, teamInfo] of Object.entries(teamsData as Record<string, any>)) {
          // Check if team exists
          const existing = await db.select().from(teams).where(eq(teams.name, teamName));
          
          if (existing.length > 0) {
            // OVERWRITE existing team - update all fields
            await db.update(teams)
              .set({
                ownerId: String(teamInfo.owner),
                maxSize: teamInfo.max_size || 20,
                purse: teamInfo.purse || 50000000,
              })
              .where(eq(teams.name, teamName));

            // DELETE all existing players for this team
            await db.delete(players).where(eq(players.teamId, existing[0].id));
            
            // Add new players from import
            if (teamInfo.players && teamInfo.players.length > 0) {
              const playerInserts = teamInfo.players.map((player: any) => {
                // Handle both object format and string format
                if (typeof player === 'string') {
                  return {
                    playerId: `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    name: player,
                    teamId: existing[0].id,
                  };
                } else {
                  return {
                    playerId: player.player_id || player.playerId || `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    name: player.name,
                    teamId: existing[0].id,
                    category: player.category,
                  };
                }
              });
              await db.insert(players).values(playerInserts);
            }
            updatedCount++;
          } else {
            // Create new team
            const newTeam = await db.insert(teams).values({
              name: teamName,
              ownerId: String(teamInfo.owner),
              maxSize: teamInfo.max_size || 20,
              purse: teamInfo.purse || 50000000,
            }).returning();

            if (teamInfo.players && teamInfo.players.length > 0) {
              const playerInserts = teamInfo.players.map((player: any) => {
                if (typeof player === 'string') {
                  return {
                    playerId: `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    name: player,
                    teamId: newTeam[0].id,
                  };
                } else {
                  return {
                    playerId: player.player_id || player.playerId || `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    name: player.name,
                    teamId: newTeam[0].id,
                    category: player.category,
                  };
                }
              });
              await db.insert(players).values(playerInserts);
            }
            importedCount++;
          }
        }

        return NextResponse.json({ 
          success: true, 
          message: `Teams imported: ${importedCount} new, ${updatedCount} overwritten` 
        });
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
            .set({ name, isActive: false, isCompleted: false })
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
            playerId: player.player_id || player.playerId || null,
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

      case 'delete_round': {
        // Delete an auction round and all its players
        const { roundId } = data;

        if (!roundId) {
          return NextResponse.json({ error: 'Round ID required' }, { status: 400 });
        }

        // Get round info
        const round = await db.select().from(auctionRounds).where(eq(auctionRounds.id, roundId));
        
        if (round.length === 0) {
          return NextResponse.json({ error: 'Round not found' }, { status: 404 });
        }

        // Check if round is currently active
        if (round[0].isActive) {
          return NextResponse.json({ error: 'Cannot delete an active round. Stop the auction first.' }, { status: 400 });
        }

        const roundName = round[0].name;

        // Delete all players in this round
        await db.delete(auctionPlayers).where(eq(auctionPlayers.roundId, roundId));

        // Delete the round
        await db.delete(auctionRounds).where(eq(auctionRounds.id, roundId));

        return NextResponse.json({ 
          success: true, 
          message: `Round "${roundName}" and all its players have been deleted` 
        });
      }

      case 'reset_round': {
        // Reset a round's status and all players to pending
        const { roundId } = data;

        if (!roundId) {
          return NextResponse.json({ error: 'Round ID required' }, { status: 400 });
        }

        // Reset round status
        await db.update(auctionRounds)
          .set({ isActive: false, isCompleted: false })
          .where(eq(auctionRounds.id, roundId));

        // Reset all players to pending
        await db.update(auctionPlayers)
          .set({ status: 'pending', soldTo: null, soldFor: null, soldAt: null })
          .where(eq(auctionPlayers.roundId, roundId));

        return NextResponse.json({ 
          success: true, 
          message: 'Round has been reset' 
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

      case 'delete_team': {
        // FULLY DELETE a team and all its players
        const { teamId } = data;

        if (!teamId) {
          return NextResponse.json({ error: 'Team ID required' }, { status: 400 });
        }

        // Get team info for confirmation message
        const team = await db.select().from(teams).where(eq(teams.id, teamId));
        
        if (team.length === 0) {
          return NextResponse.json({ error: 'Team not found' }, { status: 404 });
        }

        const teamName = team[0].name;

        // Delete all players belonging to this team
        await db.delete(players).where(eq(players.teamId, teamId));

        // Delete the team
        await db.delete(teams).where(eq(teams.id, teamId));

        return NextResponse.json({ 
          success: true, 
          message: `Team "${teamName}" and all its players have been deleted` 
        });
      }

      case 'add_player': {
        // Add player to team with manual player ID
        const { teamId, playerId, playerName, category } = data;

        await db.insert(players).values({
          playerId: playerId || `manual-${Date.now()}`,
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

      case 'create_team': {
        // Create a new team from admin panel
        const { name, ownerId, maxSize, purse } = data;

        if (!name || !ownerId) {
          return NextResponse.json({ error: 'Team name and owner ID required' }, { status: 400 });
        }

        // Check if team already exists
        const existing = await db.select().from(teams).where(eq(teams.name, name));
        if (existing.length > 0) {
          return NextResponse.json({ error: 'Team with this name already exists' }, { status: 400 });
        }

        await db.insert(teams).values({
          name,
          ownerId: String(ownerId),
          maxSize: maxSize || 20,
          purse: purse || 50000000,
        });

        return NextResponse.json({ success: true, message: `Team "${name}" created` });
      }

      case 'delete_round': {
        // Delete an auction round and all its players
        const { roundId } = data;

        if (!roundId) {
          return NextResponse.json({ error: 'Round ID required' }, { status: 400 });
        }

        // Get round info
        const round = await db.select().from(auctionRounds).where(eq(auctionRounds.id, roundId));
        
        if (round.length === 0) {
          return NextResponse.json({ error: 'Round not found' }, { status: 404 });
        }

        // Don't allow deleting active rounds
        if (round[0].isActive) {
          return NextResponse.json({ error: 'Cannot delete an active round. Stop the auction first.' }, { status: 400 });
        }

        const roundName = round[0].name;
        const roundNumber = round[0].roundNumber;

        // Delete all players in this round
        await db.delete(auctionPlayers).where(eq(auctionPlayers.roundId, roundId));

        // Delete the round
        await db.delete(auctionRounds).where(eq(auctionRounds.id, roundId));

        return NextResponse.json({ 
          success: true, 
          message: `Round ${roundNumber} "${roundName}" and all its players have been deleted` 
        });
      }

      case 'reset_round': {
        // Reset a round - mark all players as pending again
        const { roundId } = data;

        if (!roundId) {
          return NextResponse.json({ error: 'Round ID required' }, { status: 400 });
        }

        // Reset all players in this round to pending
        await db.update(auctionPlayers)
          .set({ status: 'pending', soldTo: null, soldFor: null, soldAt: null })
          .where(eq(auctionPlayers.roundId, roundId));

        // Reset round status
        await db.update(auctionRounds)
          .set({ isActive: false, isCompleted: false })
          .where(eq(auctionRounds.id, roundId));

        return NextResponse.json({ success: true, message: 'Round has been reset' });
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
