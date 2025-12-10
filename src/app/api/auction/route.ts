import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { 
  auctionState, 
  auctionPlayers, 
  auctionRounds, 
  teams, 
  auctionLogs,
  auctionHistory,
  authorizedAdmins,
  players
} from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { 
  isAuthorizedAdmin, 
  calculateBidIncrement, 
  BID_INCREMENT_TIME, 
  BID_CONTINUE_TIME 
} from '@/lib/auction';

// GET: Fetch current auction state
export async function GET() {
  try {
    // Get auction state
    const [state] = await db.select().from(auctionState).limit(1);
    
    if (!state) {
      return NextResponse.json({ 
        status: 'idle',
        message: 'No auction state found' 
      });
    }

    // Get current player if exists
    let currentPlayer = null;
    if (state.currentPlayerId) {
      const [player] = await db
        .select()
        .from(auctionPlayers)
        .where(eq(auctionPlayers.id, state.currentPlayerId));
      currentPlayer = player;
    }

    // Get current round if exists
    let currentRound = null;
    if (state.roundId) {
      const [round] = await db
        .select()
        .from(auctionRounds)
        .where(eq(auctionRounds.id, state.roundId));
      currentRound = round;
    }

    // Get all teams with their purse and roster size
    const allTeams = await db
      .select({
        id: teams.id,
        name: teams.name,
        ownerId: teams.ownerId,
        purse: teams.purse,
        maxSize: teams.maxSize,
      })
      .from(teams);

    // Get player counts for each team
    const teamPlayers = await db
      .select({
        teamId: players.teamId,
        count: sql<number>`count(*)`,
      })
      .from(players)
      .groupBy(players.teamId);

    const teamPlayerMap = new Map(teamPlayers.map(tp => [tp.teamId, tp.count]));

    const teamsWithCounts = allTeams.map(team => ({
      ...team,
      playerCount: teamPlayerMap.get(team.id) || 0,
    }));

    // Get queue - players remaining in current round
    let queue: typeof auctionPlayers.$inferSelect[] = [];
    if (state.roundId) {
      queue = await db
        .select()
        .from(auctionPlayers)
        .where(and(
          eq(auctionPlayers.roundId, state.roundId),
          eq(auctionPlayers.status, 'pending')
        ))
        .orderBy(auctionPlayers.orderIndex);
    }

    // Get all rounds
    const rounds = await db
      .select()
      .from(auctionRounds)
      .orderBy(auctionRounds.roundNumber);

    // Calculate remaining time if timer is active
    let remainingTime = state.remainingTime || 0;
    if (state.status === 'active' && state.timerStartedAt) {
      const elapsed = Math.floor((Date.now() - new Date(state.timerStartedAt).getTime()) / 1000);
      remainingTime = Math.max(0, (state.remainingTime || 10) - elapsed);
    }

    return NextResponse.json({
      state: {
        ...state,
        remainingTime,
      },
      currentPlayer,
      currentRound,
      teams: teamsWithCounts,
      queue,
      rounds,
      nextPlayer: queue[0] || null,
      queueCount: queue.length,
    });
  } catch (error) {
    console.error('Error fetching auction state:', error);
    return NextResponse.json(
      { error: 'Failed to fetch auction state' },
      { status: 500 }
    );
  }
}

// POST: Auction actions (start, bid, sold, next, pause, resume, stop)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, discordId, teamId, roundId } = body;

    // Validate action
    const adminActions = ['start', 'next', 'sold', 'pause', 'resume', 'stop'];
    const bidActions = ['bid'];
    
    if (!action) {
      return NextResponse.json({ error: 'Action required' }, { status: 400 });
    }

    // Check authorization for admin actions
    if (adminActions.includes(action)) {
      // Check if user is authorized admin
      const [admin] = await db
        .select()
        .from(authorizedAdmins)
        .where(eq(authorizedAdmins.discordId, discordId || ''));
      
      if (!admin && !isAuthorizedAdmin(discordId)) {
        return NextResponse.json(
          { error: 'Permission denied. Only authorized admins can perform this action.' },
          { status: 403 }
        );
      }
    }

    // Handle different actions
    switch (action) {
      case 'start':
        return await handleStart(roundId, discordId);
      case 'bid':
        return await handleBid(discordId, teamId);
      case 'sold':
        return await handleSold(discordId);
      case 'next':
        return await handleNext(discordId);
      case 'pause':
        return await handlePause(discordId);
      case 'resume':
        return await handleResume(discordId);
      case 'stop':
        return await handleStop(discordId);
      case 'moveUnsoldToRound':
        return await handleMoveUnsoldToRound(discordId);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Auction action error:', error);
    return NextResponse.json(
      { error: 'Failed to process auction action' },
      { status: 500 }
    );
  }
}

// ==========================================
// ACTION HANDLERS
// ==========================================

async function handleStart(roundId: number, discordId: string) {
  // Get or create round
  const [round] = await db
    .select()
    .from(auctionRounds)
    .where(eq(auctionRounds.id, roundId));

  if (!round) {
    return NextResponse.json({ error: 'Round not found' }, { status: 404 });
  }

  // Get first pending player in round
  const [firstPlayer] = await db
    .select()
    .from(auctionPlayers)
    .where(and(
      eq(auctionPlayers.roundId, roundId),
      eq(auctionPlayers.status, 'pending')
    ))
    .orderBy(auctionPlayers.orderIndex)
    .limit(1);

  if (!firstPlayer) {
    return NextResponse.json(
      { error: 'No players available in this round' },
      { status: 400 }
    );
  }

  // Update player status to current
  await db
    .update(auctionPlayers)
    .set({ status: 'current' })
    .where(eq(auctionPlayers.id, firstPlayer.id));

  // Update auction state
  const [existingState] = await db.select().from(auctionState).limit(1);
  
  const newState = {
    roundId,
    currentPlayerId: firstPlayer.id,
    currentBid: firstPlayer.basePrice,
    highestBidderId: null,
    highestBidderName: null,
    highestBidderTeamId: null,
    status: 'active' as const,
    remainingTime: BID_INCREMENT_TIME,
    timerStartedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (existingState) {
    await db.update(auctionState).set(newState).where(eq(auctionState.id, existingState.id));
  } else {
    await db.insert(auctionState).values(newState);
  }

  // Update round status
  await db
    .update(auctionRounds)
    .set({ status: 'active' })
    .where(eq(auctionRounds.id, roundId));

  // Log
  await db.insert(auctionLogs).values({
    roundId,
    message: `Auction started for ${firstPlayer.name}`,
    type: 'info',
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, message: 'Auction started' });
}

async function handleBid(discordId: string, teamId: number) {
  // Get current state
  const [state] = await db.select().from(auctionState).limit(1);
  
  if (!state || state.status !== 'active') {
    return NextResponse.json({ error: 'No active auction' }, { status: 400 });
  }

  if ((state.status as string) === 'paused') {
    return NextResponse.json({ error: 'Auction is paused' }, { status: 400 });
  }

  // Get team
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
  
  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  // Verify team ownership
  if (team.ownerId !== discordId) {
    return NextResponse.json(
      { error: 'You do not own this team' },
      { status: 403 }
    );
  }

  // Check team roster size
  const teamPlayers = await db
    .select()
    .from(players)
    .where(eq(players.teamId, teamId));

  if (teamPlayers.length >= team.maxSize) {
    return NextResponse.json(
      { error: 'Team is at maximum capacity' },
      { status: 400 }
    );
  }

  // Get current player
  const [currentPlayer] = await db
    .select()
    .from(auctionPlayers)
    .where(eq(auctionPlayers.id, state.currentPlayerId!));

  if (!currentPlayer) {
    return NextResponse.json({ error: 'No current player' }, { status: 400 });
  }

  // Calculate bid
  const isFirstBid = !state.highestBidderId;
  const increment = calculateBidIncrement(currentPlayer.basePrice);
  const newBid = isFirstBid ? currentPlayer.basePrice : (state.currentBid || 0) + increment;

  // Check purse
  if (team.purse < newBid) {
    return NextResponse.json(
      { 
        error: `Insufficient funds. Required: $${newBid.toLocaleString()}, Your purse: $${team.purse.toLocaleString()}` 
      },
      { status: 400 }
    );
  }

  // Update state
  await db.update(auctionState).set({
    currentBid: newBid,
    highestBidderId: discordId,
    highestBidderName: team.name,
    highestBidderTeamId: teamId,
    remainingTime: isFirstBid ? BID_INCREMENT_TIME : BID_CONTINUE_TIME,
    timerStartedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }).where(eq(auctionState.id, state.id));

  // Log bid
  await db.insert(auctionLogs).values({
    roundId: state.roundId,
    message: `${team.name} bid $${newBid.toLocaleString()} for ${currentPlayer.name}`,
    type: 'bid',
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ 
    success: true, 
    newBid, 
    message: `Bid placed: $${newBid.toLocaleString()}` 
  });
}

async function handleSold(discordId: string) {
  const [state] = await db.select().from(auctionState).limit(1);
  
  if (!state || !state.currentPlayerId || !state.highestBidderId) {
    return NextResponse.json({ error: 'No bids to finalize' }, { status: 400 });
  }

  // Get current player
  const [currentPlayer] = await db
    .select()
    .from(auctionPlayers)
    .where(eq(auctionPlayers.id, state.currentPlayerId));

  // Get winning team
  const [winningTeam] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, state.highestBidderTeamId!));

  if (!winningTeam) {
    return NextResponse.json({ error: 'Winning team not found' }, { status: 404 });
  }

  // Deduct from purse
  const newPurse = winningTeam.purse - (state.currentBid || 0);
  await db.update(teams).set({ purse: newPurse }).where(eq(teams.id, winningTeam.id));

  // Add player to team roster
  const playerId = `auction_${currentPlayer.id}_${Date.now()}`;
  await db.insert(players).values({
    playerId,
    name: currentPlayer.name,
    teamId: winningTeam.id,
    purchasePrice: state.currentBid,
  });

  // Update auction player status
  await db.update(auctionPlayers).set({
    status: 'sold',
    soldToTeamId: winningTeam.id,
    soldPrice: state.currentBid,
    soldAt: new Date().toISOString(),
  }).where(eq(auctionPlayers.id, currentPlayer.id));

  // Add to auction history
  await db.insert(auctionHistory).values({
    playerName: currentPlayer.name,
    teamId: winningTeam.id,
    teamName: winningTeam.name,
    winningBid: state.currentBid || 0,
    winnerDiscordId: state.highestBidderId || '',
    winnerDisplayName: state.highestBidderName,
    newBalance: newPurse,
    roundId: state.roundId,
    createdAt: new Date().toISOString(),
  });

  // Log sale
  await db.insert(auctionLogs).values({
    roundId: state.roundId,
    message: `${currentPlayer.name} sold to ${winningTeam.name} for $${(state.currentBid || 0).toLocaleString()}`,
    type: 'sale',
    createdAt: new Date().toISOString(),
  });

  // Reset state for next player
  await db.update(auctionState).set({
    currentPlayerId: null,
    currentBid: 0,
    highestBidderId: null,
    highestBidderName: null,
    highestBidderTeamId: null,
    status: 'idle',
    remainingTime: BID_INCREMENT_TIME,
    timerStartedAt: null,
    lastSalePlayer: currentPlayer.name,
    lastSaleTeam: winningTeam.name,
    lastSaleAmount: state.currentBid,
    lastUnsoldPlayer: null,
    updatedAt: new Date().toISOString(),
  }).where(eq(auctionState.id, state.id));

  return NextResponse.json({ 
    success: true, 
    message: `${currentPlayer.name} sold to ${winningTeam.name} for $${(state.currentBid || 0).toLocaleString()}` 
  });
}

async function handleNext(discordId: string) {
  const [state] = await db.select().from(auctionState).limit(1);
  
  if (!state || !state.roundId) {
    return NextResponse.json({ error: 'No active auction round' }, { status: 400 });
  }

  // If there's a current player with no bids, mark as unsold
  if (state.currentPlayerId && !state.highestBidderId) {
    const [currentPlayer] = await db
      .select()
      .from(auctionPlayers)
      .where(eq(auctionPlayers.id, state.currentPlayerId));

    if (currentPlayer) {
      await db.update(auctionPlayers).set({ status: 'unsold' })
        .where(eq(auctionPlayers.id, currentPlayer.id));

      await db.insert(auctionLogs).values({
        roundId: state.roundId,
        message: `${currentPlayer.name} went unsold`,
        type: 'unsold',
        createdAt: new Date().toISOString(),
      });

      await db.update(auctionState).set({
        lastUnsoldPlayer: currentPlayer.name,
        lastSalePlayer: null,
        lastSaleTeam: null,
        lastSaleAmount: null,
      }).where(eq(auctionState.id, state.id));
    }
  }

  // Get next pending player
  const [nextPlayer] = await db
    .select()
    .from(auctionPlayers)
    .where(and(
      eq(auctionPlayers.roundId, state.roundId),
      eq(auctionPlayers.status, 'pending')
    ))
    .orderBy(auctionPlayers.orderIndex)
    .limit(1);

  if (!nextPlayer) {
    // No more players - end auction
    await db.update(auctionState).set({
      currentPlayerId: null,
      currentBid: 0,
      highestBidderId: null,
      highestBidderName: null,
      highestBidderTeamId: null,
      status: 'idle',
      remainingTime: 0,
      timerStartedAt: null,
      updatedAt: new Date().toISOString(),
    }).where(eq(auctionState.id, state.id));

    await db.update(auctionRounds).set({ status: 'completed' })
      .where(eq(auctionRounds.id, state.roundId));

    return NextResponse.json({ 
      success: true, 
      message: 'Auction complete - no more players in this round',
      complete: true 
    });
  }

  // Set up next player
  await db.update(auctionPlayers).set({ status: 'current' })
    .where(eq(auctionPlayers.id, nextPlayer.id));

  await db.update(auctionState).set({
    currentPlayerId: nextPlayer.id,
    currentBid: nextPlayer.basePrice,
    highestBidderId: null,
    highestBidderName: null,
    highestBidderTeamId: null,
    status: 'active',
    remainingTime: BID_INCREMENT_TIME,
    timerStartedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }).where(eq(auctionState.id, state.id));

  await db.insert(auctionLogs).values({
    roundId: state.roundId,
    message: `Now auctioning: ${nextPlayer.name}`,
    type: 'info',
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, message: `Now auctioning: ${nextPlayer.name}` });
}

async function handlePause(discordId: string) {
  const [state] = await db.select().from(auctionState).limit(1);
  
  if (!state) {
    return NextResponse.json({ error: 'No auction state' }, { status: 400 });
  }

  const newStatus = state.status === 'paused' ? 'active' : 'paused';
  const action = newStatus === 'paused' ? 'paused' : 'resumed';

  await db.update(auctionState).set({
    status: newStatus,
    timerStartedAt: newStatus === 'active' ? new Date().toISOString() : state.timerStartedAt,
    updatedAt: new Date().toISOString(),
  }).where(eq(auctionState.id, state.id));

  await db.insert(auctionLogs).values({
    roundId: state.roundId,
    message: `Auction ${action}`,
    type: action === 'paused' ? 'pause' : 'resume',
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, message: `Auction ${action}` });
}

async function handleResume(discordId: string) {
  return handlePause(discordId); // Toggle behavior
}

async function handleStop(discordId: string) {
  const [state] = await db.select().from(auctionState).limit(1);
  
  if (!state) {
    return NextResponse.json({ error: 'No auction state' }, { status: 400 });
  }

  // If there's a current player, mark as unsold
  if (state.currentPlayerId) {
    const [currentPlayer] = await db
      .select()
      .from(auctionPlayers)
      .where(eq(auctionPlayers.id, state.currentPlayerId));

    if (currentPlayer) {
      await db.update(auctionPlayers).set({ status: 'unsold' })
        .where(eq(auctionPlayers.id, currentPlayer.id));

      await db.insert(auctionLogs).values({
        roundId: state.roundId,
        message: `Auction stopped. ${currentPlayer.name} returned to unsold`,
        type: 'stop',
        createdAt: new Date().toISOString(),
      });
    }
  }

  await db.update(auctionState).set({
    currentPlayerId: null,
    currentBid: 0,
    highestBidderId: null,
    highestBidderName: null,
    highestBidderTeamId: null,
    status: 'stopped',
    remainingTime: 0,
    timerStartedAt: null,
    updatedAt: new Date().toISOString(),
  }).where(eq(auctionState.id, state.id));

  return NextResponse.json({ success: true, message: 'Auction stopped' });
}

// Move all unsold players to Round 0 (Unsold Players round) for re-auction
async function handleMoveUnsoldToRound(discordId: string) {
  // Get Round 0 (Unsold Players round)
  const [unsoldRound] = await db
    .select()
    .from(auctionRounds)
    .where(eq(auctionRounds.roundNumber, 0));

  if (!unsoldRound) {
    return NextResponse.json({ error: 'Unsold Players round not found' }, { status: 404 });
  }

  // Get all unsold players
  const unsoldPlayers = await db
    .select()
    .from(auctionPlayers)
    .where(eq(auctionPlayers.status, 'unsold'));

  if (unsoldPlayers.length === 0) {
    return NextResponse.json({ message: 'No unsold players to move' });
  }

  // Move each unsold player to Round 0 and reset status to pending
  for (const player of unsoldPlayers) {
    await db.update(auctionPlayers).set({
      roundId: unsoldRound.id,
      status: 'pending',
    }).where(eq(auctionPlayers.id, player.id));
  }

  await db.insert(auctionLogs).values({
    roundId: unsoldRound.id,
    message: `Moved ${unsoldPlayers.length} unsold players to Unsold Players round for re-auction`,
    type: 'info',
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ 
    success: true, 
    message: `Moved ${unsoldPlayers.length} unsold players to re-auction pool` 
  });
}
