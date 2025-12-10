import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auctionState, auctionPlayers, auctionLogs, teams, players } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const ADMIN_IDS = ['256972361918578688', '1111497896018313268'];

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !ADMIN_IDS.includes(session.user.id)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current auction state
    const states = await db.select().from(auctionState).limit(1);
    if (states.length === 0 || !states[0].isActive) {
      return NextResponse.json({ error: 'No active auction' }, { status: 400 });
    }

    const state = states[0];

    // Must have a highest bidder to sell
    if (!state.highestBidderId) {
      return NextResponse.json({ error: 'No bids placed' }, { status: 400 });
    }

    // Get the player being auctioned
    if (!state.currentPlayerId) {
      return NextResponse.json({ error: 'No player being auctioned' }, { status: 400 });
    }

    const auctionPlayerResults = await db.select().from(auctionPlayers)
      .where(eq(auctionPlayers.id, state.currentPlayerId));
    
    if (auctionPlayerResults.length === 0) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const auctionPlayer = auctionPlayerResults[0];

    // Get the winning team
    const winningTeams = await db.select().from(teams)
      .where(eq(teams.ownerId, state.highestBidderId));
    
    if (winningTeams.length === 0) {
      return NextResponse.json({ error: 'Winning team not found' }, { status: 404 });
    }

    const winningTeam = winningTeams[0];
    const salePrice = state.currentBid;

    // Check team has enough purse
    if (winningTeam.purse < salePrice) {
      return NextResponse.json({ error: 'Insufficient funds' }, { status: 400 });
    }

    // Parse current team players
    let teamPlayers: Array<{id: number, name: string, category?: string, purchasePrice?: number}> = [];
    try {
      teamPlayers = winningTeam.players ? JSON.parse(winningTeam.players) : [];
    } catch {
      teamPlayers = [];
    }

    // Check team size
    if (teamPlayers.length >= (winningTeam.maxSize || 20)) {
      return NextResponse.json({ error: 'Team is full' }, { status: 400 });
    }

    // Add player to team WITH their player ID from auction round
    // The auctionPlayer.playerId is the original player ID if it was imported with one
    const playerEntry = {
      id: auctionPlayer.playerId || auctionPlayer.id, // Use original playerId if available
      auctionPlayerId: auctionPlayer.id, // Also store the auction player ID
      name: auctionPlayer.name,
      category: auctionPlayer.category,
      purchasePrice: salePrice,
      purchasedAt: new Date().toISOString(),
      roundId: state.roundId
    };

    teamPlayers.push(playerEntry);

    // Update team: add player, deduct purse
    await db.update(teams)
      .set({
        players: JSON.stringify(teamPlayers),
        purse: winningTeam.purse - salePrice
      })
      .where(eq(teams.id, winningTeam.id));

    // Mark auction player as sold
    await db.update(auctionPlayers)
      .set({ 
        status: 'sold',
        soldTo: winningTeam.id,
        soldPrice: salePrice
      })
      .where(eq(auctionPlayers.id, auctionPlayer.id));

    // Also add to the main players table if it exists
    try {
      await db.insert(players).values({
        name: auctionPlayer.name,
        teamId: winningTeam.id,
        category: auctionPlayer.category,
        purchasePrice: salePrice
      }).onConflictDoNothing();
    } catch (e) {
      // Players table might have different schema, ignore errors
      console.log('Could not insert into players table:', e);
    }

    // Log the sale
    await db.insert(auctionLogs).values({
      eventType: 'sale',
      playerId: auctionPlayer.id,
      playerName: auctionPlayer.name,
      teamId: winningTeam.id,
      teamName: winningTeam.name,
      userId: state.highestBidderId,
      amount: salePrice,
      roundId: state.roundId,
      timestamp: new Date()
    });

    // Reset auction state
    await db.update(auctionState)
      .set({
        isActive: false,
        currentPlayerId: null,
        currentBid: 0,
        highestBidderId: null,
        timerEndTime: 0,
        isPaused: false
      })
      .where(eq(auctionState.id, state.id));

    return NextResponse.json({ 
      success: true, 
      sale: {
        playerName: auctionPlayer.name,
        playerId: playerEntry.id,
        teamName: winningTeam.name,
        amount: salePrice,
        newPurse: winningTeam.purse - salePrice
      }
    });

  } catch (error) {
    console.error('Sold error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
