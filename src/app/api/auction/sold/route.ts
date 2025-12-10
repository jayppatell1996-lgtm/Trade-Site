import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, ADMIN_IDS } from '@/lib/auth';
import { db } from '@/db';
import { auctionState, auctionPlayers, teams, players, auctionLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Use discordId, not id
    if (!session?.user?.discordId || !ADMIN_IDS.includes(session.user.discordId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current auction state
    const states = await db.select().from(auctionState);
    const state = states[0];

    if (!state || !state.isActive || !state.currentPlayerId) {
      return NextResponse.json({ error: 'No active auction' }, { status: 400 });
    }

    if (!state.highestBidderId) {
      return NextResponse.json({ error: 'No bids to finalize' }, { status: 400 });
    }

    // Get current player
    const currentPlayers = await db.select()
      .from(auctionPlayers)
      .where(eq(auctionPlayers.id, state.currentPlayerId));

    const currentPlayer = currentPlayers[0];
    if (!currentPlayer) {
      return NextResponse.json({ error: 'Player not found' }, { status: 400 });
    }

    // Get winning team
    const winningTeams = await db.select()
      .from(teams)
      .where(eq(teams.ownerId, state.highestBidderId));

    const winningTeam = winningTeams[0];
    if (!winningTeam) {
      return NextResponse.json({ error: 'Winning team not found' }, { status: 400 });
    }

    // Check purse
    if (winningTeam.purse < (state.currentBid || 0)) {
      return NextResponse.json({ error: 'Winner has insufficient funds' }, { status: 400 });
    }

    // Update player as sold
    await db.update(auctionPlayers)
      .set({
        status: 'sold',
        soldTo: winningTeam.name,
        soldFor: state.currentBid,
        soldAt: new Date().toISOString(),
      })
      .where(eq(auctionPlayers.id, state.currentPlayerId));

    // Deduct from team purse
    await db.update(teams)
      .set({ purse: winningTeam.purse - (state.currentBid || 0) })
      .where(eq(teams.id, winningTeam.id));

    // Add player to team roster
    const playerIdToUse = currentPlayer.playerId || `auction-${Date.now()}`;
    await db.insert(players).values({
      playerId: playerIdToUse,
      name: currentPlayer.name,
      teamId: winningTeam.id,
      category: currentPlayer.category,
      boughtFor: state.currentBid,
    });

    // Log the sale
    await db.insert(auctionLogs).values({
      roundId: state.currentRoundId,
      message: `${currentPlayer.name} sold to ${winningTeam.name} for $${(state.currentBid || 0).toLocaleString()}`,
      logType: 'sale',
      timestamp: new Date().toISOString(),
    });

    // Update auction state - waiting for next
    await db.update(auctionState)
      .set({
        isActive: true,
        currentPlayerId: null,
        currentBid: 0,
        highestBidderId: null,
        highestBidderTeam: null,
        timerEndTime: null,
        pausedTimeRemaining: null,
        lastUpdated: new Date().toISOString(),
      })
      .where(eq(auctionState.id, state.id));

    return NextResponse.json({
      success: true,
      message: `${currentPlayer.name} sold to ${winningTeam.name} for $${(state.currentBid || 0).toLocaleString()}!`,
      playerName: currentPlayer.name,
      teamName: winningTeam.name,
      amount: state.currentBid,
    });
  } catch (error) {
    console.error('Error in sold route:', error);
    return NextResponse.json({ error: 'Failed to finalize sale' }, { status: 500 });
  }
}
