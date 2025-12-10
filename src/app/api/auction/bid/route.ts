import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { auctionState, auctionPlayers, teams, players } from '@/db/schema';
import { eq } from 'drizzle-orm';

const BID_INCREMENT_TIME = 10; // seconds for first bid
const BID_CONTINUE_TIME = 6; // seconds for subsequent bids

function getBidIncrement(basePrice: number): number {
  if (basePrice >= 2000000) return 1000000;
  if (basePrice >= 1000000) return 500000;
  if (basePrice >= 500000) return 250000;
  return basePrice;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.discordId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user's team
    const userTeams = await db.select()
      .from(teams)
      .where(eq(teams.ownerId, session.user.discordId));

    if (userTeams.length === 0) {
      return NextResponse.json({ error: 'You do not own a team' }, { status: 403 });
    }

    const userTeam = userTeams[0];

    // Get current auction state
    const states = await db.select().from(auctionState);
    const state = states[0];

    if (!state || !state.isActive) {
      return NextResponse.json({ error: 'No active auction' }, { status: 400 });
    }

    if (state.isPaused) {
      return NextResponse.json({ error: 'Auction is paused' }, { status: 400 });
    }

    if (!state.currentPlayerId) {
      return NextResponse.json({ error: 'No player being auctioned' }, { status: 400 });
    }

    // Get current player
    const currentPlayers = await db.select()
      .from(auctionPlayers)
      .where(eq(auctionPlayers.id, state.currentPlayerId));

    const currentPlayer = currentPlayers[0];
    if (!currentPlayer) {
      return NextResponse.json({ error: 'Player not found' }, { status: 400 });
    }

    // Check team roster size
    const teamPlayers = await db.select()
      .from(players)
      .where(eq(players.teamId, userTeam.id));

    if (teamPlayers.length >= userTeam.maxSize) {
      return NextResponse.json({ error: 'Your team is at maximum capacity' }, { status: 400 });
    }

    // Calculate new bid
    const basePrice = currentPlayer.basePrice;
    const increment = getBidIncrement(basePrice);
    const isFirstBid = !state.highestBidderId;
    
    let newBid: number;
    if (isFirstBid) {
      newBid = basePrice;
    } else {
      newBid = (state.currentBid || 0) + increment;
    }

    // Check if user has enough purse
    if (userTeam.purse < newBid) {
      return NextResponse.json({ 
        error: `Insufficient funds. Need $${newBid.toLocaleString()}, you have $${userTeam.purse.toLocaleString()}` 
      }, { status: 400 });
    }

    // Update auction state
    const timerDuration = isFirstBid ? BID_INCREMENT_TIME : BID_CONTINUE_TIME;
    
    await db.update(auctionState)
      .set({
        currentBid: newBid,
        highestBidderId: session.user.discordId,
        highestBidderTeam: userTeam.name,
        timerEndTime: Date.now() + (timerDuration * 1000),
        lastUpdated: new Date().toISOString(),
      })
      .where(eq(auctionState.id, state.id));

    return NextResponse.json({ 
      success: true, 
      newBid,
      team: userTeam.name,
      message: `Bid placed: $${newBid.toLocaleString()} by ${userTeam.name}`
    });
  } catch (error) {
    console.error('Error placing bid:', error);
    return NextResponse.json({ error: 'Failed to place bid' }, { status: 500 });
  }
}
