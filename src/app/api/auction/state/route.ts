import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { auctionState, auctionPlayers, auctionRounds, teams, auctionLogs, players, unsoldPlayers } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

// Simple lock to prevent concurrent auto-expiry processing
let autoExpiryLock = false;

export async function GET() {
  try {
    // Get current auction state (there should only be one row)
    const states = await db.select().from(auctionState);
    let state = states[0];

    // If no state exists, create one
    if (!state) {
      const newState = await db.insert(auctionState).values({
        isActive: false,
        isPaused: false,
      }).returning();
      state = newState[0];
    }

    // Auto-process expired auction if needed (server-side backup)
    if (
      state.isActive && 
      state.currentPlayerId && 
      !state.isPaused && 
      state.timerEndTime &&
      !autoExpiryLock
    ) {
      const timerEnd = Number(state.timerEndTime);
      const now = Date.now();
      // Timer expired more than 2 seconds ago
      if (timerEnd > 1000000000000 && now - timerEnd > 2000) {
        autoExpiryLock = true;
        try {
          console.log('Server auto-processing expired auction');
          
          if (state.highestBidderId) {
            // Auto-sell to highest bidder
            const currentPlayer = await db.select()
              .from(auctionPlayers)
              .where(eq(auctionPlayers.id, state.currentPlayerId));
            
            const winningTeam = await db.select()
              .from(teams)
              .where(eq(teams.ownerId, state.highestBidderId));
            
            if (currentPlayer[0] && winningTeam[0] && winningTeam[0].purse >= (state.currentBid || 0)) {
              // Update player as sold
              await db.update(auctionPlayers)
                .set({
                  status: 'sold',
                  soldTo: winningTeam[0].name,
                  soldFor: state.currentBid,
                  soldAt: new Date().toISOString(),
                })
                .where(eq(auctionPlayers.id, state.currentPlayerId));

              // Deduct from team purse
              await db.update(teams)
                .set({ purse: winningTeam[0].purse - (state.currentBid || 0) })
                .where(eq(teams.id, winningTeam[0].id));

              // Add player to team roster
              const playerIdToUse = currentPlayer[0].playerId || `auction-${Date.now()}`;
              await db.insert(players).values({
                playerId: playerIdToUse,
                name: currentPlayer[0].name,
                teamId: winningTeam[0].id,
                category: currentPlayer[0].category || null,
                boughtFor: state.currentBid,
              });

              // Log the sale
              await db.insert(auctionLogs).values({
                roundId: state.currentRoundId,
                message: `${currentPlayer[0].name} sold to ${winningTeam[0].name} for $${(state.currentBid || 0).toLocaleString()}`,
                logType: 'sale',
                timestamp: new Date().toISOString(),
              });

              console.log(`Auto-sold ${currentPlayer[0].name} to ${winningTeam[0].name}`);
            }
          } else {
            // No bidder - mark as unsold
            const currentPlayer = await db.select()
              .from(auctionPlayers)
              .where(eq(auctionPlayers.id, state.currentPlayerId));
            
            if (currentPlayer[0]) {
              await db.update(auctionPlayers)
                .set({ status: 'unsold' })
                .where(eq(auctionPlayers.id, state.currentPlayerId));

              await db.insert(unsoldPlayers).values({
                name: currentPlayer[0].name,
                category: currentPlayer[0].category || 'Unknown',
                basePrice: currentPlayer[0].basePrice,
                originalRoundId: state.currentRoundId,
                addedAt: new Date().toISOString(),
              });

              await db.insert(auctionLogs).values({
                roundId: state.currentRoundId,
                message: `${currentPlayer[0].name} went unsold (auto-expired)`,
                logType: 'unsold',
                timestamp: new Date().toISOString(),
              });

              console.log(`Auto-marked ${currentPlayer[0].name} as unsold`);
            }
          }

          // Update state
          await db.update(auctionState)
            .set({
              currentPlayerId: null,
              currentBid: 0,
              highestBidderId: null,
              highestBidderTeam: null,
              timerEndTime: null,
              pausedTimeRemaining: null,
              lastUpdated: new Date().toISOString(),
            })
            .where(eq(auctionState.id, state.id));

          // Refresh state after processing
          const updatedStates = await db.select().from(auctionState);
          state = updatedStates[0];
        } finally {
          setTimeout(() => { autoExpiryLock = false; }, 1000);
        }
      }
    }

    // Get current player details if there's an active auction
    let currentPlayer = null;
    if (state.currentPlayerId) {
      const auctionPlayerList = await db.select().from(auctionPlayers).where(eq(auctionPlayers.id, state.currentPlayerId));
      currentPlayer = auctionPlayerList[0] || null;
    }

    // Get current round details
    let currentRound = null;
    if (state.currentRoundId) {
      const rounds = await db.select().from(auctionRounds).where(eq(auctionRounds.id, state.currentRoundId));
      currentRound = rounds[0] || null;
    }

    // Get all teams for purse display with player counts
    const allTeams = await db.select().from(teams);
    const allPlayers = await db.select().from(players);
    
    const teamsWithCount = allTeams.map(team => ({
      ...team,
      playerCount: allPlayers.filter(p => p.teamId === team.id).length,
    }));

    // Get pending players count for current round
    let pendingPlayers: any[] = [];
    if (state.currentRoundId) {
      pendingPlayers = await db.select()
        .from(auctionPlayers)
        .where(eq(auctionPlayers.roundId, state.currentRoundId));
    }

    // Get recent logs
    const recentLogs = await db.select()
      .from(auctionLogs)
      .orderBy(desc(auctionLogs.id))
      .limit(10);

    // Calculate remaining time with robust type handling
    let remainingTime = 0;
    if (state.isActive && state.timerEndTime) {
      const timerEnd = Number(state.timerEndTime);
      const now = Date.now();
      
      if (state.isPaused && state.pausedTimeRemaining) {
        // When paused, show the remaining time that was stored
        remainingTime = Math.ceil(Number(state.pausedTimeRemaining) / 1000);
      } else if (state.isPaused) {
        // Fallback if no pausedTimeRemaining stored
        remainingTime = 12;
      } else if (!isNaN(timerEnd) && timerEnd > 0) {
        // Check if it's a valid timestamp in milliseconds (13+ digits, within reasonable range)
        if (timerEnd > 1000000000000 && timerEnd < 2000000000000) {
          // Valid millisecond timestamp
          remainingTime = Math.max(0, Math.floor((timerEnd - now) / 1000));
        } else if (timerEnd > 1000000000 && timerEnd < 2000000000) {
          // Looks like seconds timestamp, convert to ms calculation
          remainingTime = Math.max(0, Math.floor((timerEnd * 1000 - now) / 1000));
        }
        // Cap at reasonable max (60 seconds)
        remainingTime = Math.min(60, remainingTime);
      }
    }

    // Get last sale from logs
    let lastSale = null;
    const saleLog = recentLogs.find(log => log.logType === 'sale');
    if (saleLog) {
      // Parse the sale log message: "Player Name sold to Team for $Amount"
      const match = saleLog.message.match(/(.+) sold to (.+) for \$(.+)/);
      if (match) {
        lastSale = {
          playerName: match[1],
          teamName: match[2],
          amount: parseFloat(match[3].replace(/,/g, '')),
        };
      }
    }

    return NextResponse.json({
      ...state,
      currentPlayer,
      currentRound,
      teams: teamsWithCount,
      pendingPlayers: pendingPlayers.filter(p => p.status === 'pending'),
      recentLogs,
      remainingTime,
      lastSale,
    });
  } catch (error) {
    console.error('Error fetching auction state:', error);
    return NextResponse.json({ error: 'Failed to fetch auction state' }, { status: 500 });
  }
}
