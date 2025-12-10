import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { 
  authorizedAdmins, 
  teams, 
  players, 
  auctionRounds, 
  auctionPlayers,
  auctionState 
} from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { isAuthorizedAdmin, AUTHORIZED_ADMIN_IDS } from '@/lib/auction';

// GET: Check if user is admin and get admin list
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const discordId = searchParams.get('discordId');

    // Get all admins
    const admins = await db.select().from(authorizedAdmins);

    // Check if requesting user is admin
    let isAdmin = false;
    if (discordId) {
      isAdmin = AUTHORIZED_ADMIN_IDS.includes(discordId) || 
                admins.some(admin => admin.discordId === discordId);
    }

    return NextResponse.json({
      isAdmin,
      admins,
      hardcodedAdmins: AUTHORIZED_ADMIN_IDS,
    });
  } catch (error) {
    console.error('Error in admin GET:', error);
    return NextResponse.json(
      { error: 'Failed to fetch admin data' },
      { status: 500 }
    );
  }
}

// POST: Admin actions (add admin, import data, etc.)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, discordId, requestingUser } = body;

    // Verify requester is admin
    if (!isAuthorizedAdmin(requestingUser)) {
      const [dbAdmin] = await db
        .select()
        .from(authorizedAdmins)
        .where(eq(authorizedAdmins.discordId, requestingUser || ''));
      
      if (!dbAdmin) {
        return NextResponse.json(
          { error: 'Permission denied' },
          { status: 403 }
        );
      }
    }

    switch (action) {
      case 'removeAdmin': {
        const { adminDiscordId } = body;
        const targetDiscordId = adminDiscordId || discordId;
        
        if (!targetDiscordId) {
          return NextResponse.json({ error: 'Discord ID required' }, { status: 400 });
        }
        
        // Cannot remove hardcoded admins
        if (AUTHORIZED_ADMIN_IDS.includes(targetDiscordId)) {
          return NextResponse.json(
            { error: 'Cannot remove hardcoded admin' },
            { status: 400 }
          );
        }
        
        await db.delete(authorizedAdmins).where(eq(authorizedAdmins.discordId, targetDiscordId));
        return NextResponse.json({ success: true, message: 'Admin removed' });
      }

      case 'importTeams': {
        const { teamsData } = body;
        // teamsData format: { teamName: { owner: discordId, purse: number, max_size: number, players: [...] } }
        
        for (const [teamName, teamData] of Object.entries(teamsData as Record<string, { owner: string; purse: number; max_size: number; players: string[] }>)) {
          // Check if team exists
          const [existingTeam] = await db
            .select()
            .from(teams)
            .where(eq(teams.name, teamName));

          if (existingTeam) {
            // Update existing team
            await db.update(teams).set({
              ownerId: String(teamData.owner),
              purse: teamData.purse,
              maxSize: teamData.max_size || 20,
            }).where(eq(teams.id, existingTeam.id));

            // Update players - remove existing and add new
            await db.delete(players).where(eq(players.teamId, existingTeam.id));
            
            if (teamData.players && teamData.players.length > 0) {
              const playerInserts = teamData.players.map((playerName: string, idx: number) => ({
                playerId: `${teamName.toLowerCase()}_${idx}_${Date.now()}`,
                name: playerName,
                teamId: existingTeam.id,
              }));
              await db.insert(players).values(playerInserts);
            }
          } else {
            // Create new team
            const [newTeam] = await db.insert(teams).values({
              name: teamName,
              ownerId: String(teamData.owner),
              purse: teamData.purse,
              maxSize: teamData.max_size || 20,
              createdAt: new Date().toISOString(),
            }).returning();

            if (teamData.players && teamData.players.length > 0) {
              const playerInserts = teamData.players.map((playerName: string, idx: number) => ({
                playerId: `${teamName.toLowerCase()}_${idx}_${Date.now()}`,
                name: playerName,
                teamId: newTeam.id,
              }));
              await db.insert(players).values(playerInserts);
            }
          }
        }

        return NextResponse.json({ success: true, message: 'Teams imported' });
      }

      case 'importAuctionPlayers': {
        const { roundId, playersData } = body;
        // playersData format: [{ name, category, base_price }]
        
        if (!roundId) {
          return NextResponse.json({ error: 'Round ID required' }, { status: 400 });
        }

        const playerInserts = playersData.map((player: { name: string; category: string; base_price: number }, idx: number) => ({
          roundId,
          name: player.name,
          category: player.category,
          basePrice: player.base_price,
          status: 'pending',
          orderIndex: idx,
        }));

        await db.insert(auctionPlayers).values(playerInserts);

        return NextResponse.json({ 
          success: true, 
          message: `Imported ${playersData.length} players` 
        });
      }

      case 'clearRoundPlayers':
      case 'clearRound': {
        const { roundId } = body;
        if (!roundId) {
          return NextResponse.json({ error: 'Round ID required' }, { status: 400 });
        }
        
        await db.delete(auctionPlayers).where(eq(auctionPlayers.roundId, roundId));
        return NextResponse.json({ success: true, message: 'Round players cleared' });
      }

      case 'importRounds': {
        const { roundsData } = body;
        // roundsData format: [{ round_number, name, status }]
        
        if (!Array.isArray(roundsData)) {
          return NextResponse.json({ error: 'Invalid rounds data' }, { status: 400 });
        }

        for (const round of roundsData) {
          const roundNumber = round.round_number || round.roundNumber || round.number;
          const name = round.name || round.round_name || `Round ${roundNumber}`;
          const status = round.status || 'pending';

          // Check if round exists
          const [existingRound] = await db
            .select()
            .from(auctionRounds)
            .where(eq(auctionRounds.roundNumber, roundNumber));

          if (existingRound) {
            // Update existing round
            await db.update(auctionRounds).set({ name, status })
              .where(eq(auctionRounds.id, existingRound.id));
          } else {
            // Create new round
            await db.insert(auctionRounds).values({
              roundNumber,
              name,
              status,
              createdAt: new Date().toISOString(),
            });
          }
        }

        return NextResponse.json({ 
          success: true, 
          message: `Imported ${roundsData.length} rounds` 
        });
      }

      case 'removePlayerFromTeam': {
        const { playerId } = body;
        if (!playerId) {
          return NextResponse.json({ error: 'Player ID required' }, { status: 400 });
        }

        await db.delete(players).where(eq(players.id, playerId));
        return NextResponse.json({ success: true, message: 'Player removed from team' });
      }

      case 'addAuctionPlayer': {
        const { roundId, playerName, category, basePrice } = body;
        if (!roundId || !playerName) {
          return NextResponse.json({ error: 'Round ID and player name required' }, { status: 400 });
        }

        // Get current max order index
        const existingPlayers = await db
          .select()
          .from(auctionPlayers)
          .where(eq(auctionPlayers.roundId, roundId));
        
        const maxOrder = existingPlayers.length > 0 
          ? Math.max(...existingPlayers.map(p => p.orderIndex || 0)) + 1 
          : 0;

        await db.insert(auctionPlayers).values({
          roundId,
          name: playerName,
          category: category || 'Unknown',
          basePrice: basePrice || 500000,
          status: 'pending',
          orderIndex: maxOrder,
        });

        return NextResponse.json({ success: true, message: 'Player added to auction' });
      }

      case 'removeAuctionPlayer': {
        const { playerId } = body;
        if (!playerId) {
          return NextResponse.json({ error: 'Player ID required' }, { status: 400 });
        }

        await db.delete(auctionPlayers).where(eq(auctionPlayers.id, playerId));
        return NextResponse.json({ success: true, message: 'Auction player removed' });
      }

      case 'addAdmin': {
        const { adminDiscordId, adminName, role = 'admin' } = body;
        const targetDiscordId = adminDiscordId || discordId;
        
        if (!targetDiscordId) {
          return NextResponse.json({ error: 'Discord ID required' }, { status: 400 });
        }
        
        // Check if admin already exists
        const [existing] = await db
          .select()
          .from(authorizedAdmins)
          .where(eq(authorizedAdmins.discordId, targetDiscordId));
        
        if (existing) {
          return NextResponse.json({ error: 'Admin already exists' }, { status: 400 });
        }
        
        await db.insert(authorizedAdmins).values({
          discordId: targetDiscordId,
          name: adminName,
          role,
          createdAt: new Date().toISOString(),
        });
        
        return NextResponse.json({ success: true, message: 'Admin added' });
      }

      case 'resetAuction': {
        // Reset auction state
        await db.update(auctionState).set({
          roundId: null,
          currentPlayerId: null,
          currentBid: 0,
          highestBidderId: null,
          highestBidderName: null,
          highestBidderTeamId: null,
          status: 'idle',
          remainingTime: 10,
          timerStartedAt: null,
          lastSalePlayer: null,
          lastSaleTeam: null,
          lastSaleAmount: null,
          lastUnsoldPlayer: null,
          updatedAt: new Date().toISOString(),
        });

        // Reset all auction players to pending
        await db.update(auctionPlayers).set({ 
          status: 'pending',
          soldToTeamId: null,
          soldPrice: null,
          soldAt: null,
        });

        // Reset round statuses
        await db.update(auctionRounds).set({ status: 'pending' });

        return NextResponse.json({ success: true, message: 'Auction reset' });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in admin POST:', error);
    return NextResponse.json(
      { error: 'Failed to process admin action' },
      { status: 500 }
    );
  }
}
