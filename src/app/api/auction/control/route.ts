import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auctionState, auctionPlayers, auctionLogs, unsoldPlayers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Timer constants
const BID_INCREMENT_TIME = 12000; // 12 seconds in ms (initial)
const BID_CONTINUE_TIME = 8000;   // 8 seconds in ms (after bid)

const ADMIN_IDS = ['256972361918578688', '1111497896018313268'];

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !ADMIN_IDS.includes(session.user.id)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, playerId, roundId } = body;

    const states = await db.select().from(auctionState).limit(1);
    const currentState = states[0];

    switch (action) {
      case 'start': {
        if (!playerId) {
          return NextResponse.json({ error: 'Player ID required' }, { status: 400 });
        }

        // Get player details
        const players = await db.select().from(auctionPlayers)
          .where(eq(auctionPlayers.id, playerId));
        
        if (players.length === 0) {
          return NextResponse.json({ error: 'Player not found' }, { status: 404 });
        }

        const player = players[0];
        const timerEnd = Date.now() + BID_INCREMENT_TIME;

        if (currentState) {
          await db.update(auctionState)
            .set({
              isActive: true,
              currentPlayerId: playerId,
              currentBid: player.basePrice,
              highestBidderId: null,
              timerEndTime: timerEnd,
              isPaused: false,
              roundId: roundId || currentState.roundId
            })
            .where(eq(auctionState.id, currentState.id));
        } else {
          await db.insert(auctionState).values({
            isActive: true,
            currentPlayerId: playerId,
            currentBid: player.basePrice,
            highestBidderId: null,
            timerEndTime: timerEnd,
            isPaused: false,
            roundId: roundId || null
          });
        }

        // Log the start
        await db.insert(auctionLogs).values({
          eventType: 'start',
          playerId: playerId,
          playerName: player.name,
          amount: player.basePrice,
          roundId: roundId || currentState?.roundId || null,
          timestamp: new Date()
        });

        return NextResponse.json({ success: true, action: 'started' });
      }

      case 'pause': {
        if (!currentState || !currentState.isActive) {
          return NextResponse.json({ error: 'No active auction' }, { status: 400 });
        }

        // Calculate remaining time and store it
        const now = Date.now();
        const timerEndTime = Number(currentState.timerEndTime) || 0;
        const remainingMs = Math.max(0, timerEndTime - now);

        await db.update(auctionState)
          .set({
            isPaused: true,
            timerEndTime: remainingMs // Store remaining ms when paused
          })
          .where(eq(auctionState.id, currentState.id));

        // Log the pause
        if (currentState.currentPlayerId) {
          const players = await db.select().from(auctionPlayers)
            .where(eq(auctionPlayers.id, currentState.currentPlayerId));
          
          await db.insert(auctionLogs).values({
            eventType: 'pause',
            playerId: currentState.currentPlayerId,
            playerName: players[0]?.name || 'Unknown',
            roundId: currentState.roundId,
            timestamp: new Date()
          });
        }

        return NextResponse.json({ success: true, action: 'paused', remainingMs });
      }

      case 'resume': {
        if (!currentState || !currentState.isPaused) {
          return NextResponse.json({ error: 'Auction not paused' }, { status: 400 });
        }

        // Resume resets timer to full 12 seconds
        const newTimerEnd = Date.now() + BID_INCREMENT_TIME;

        await db.update(auctionState)
          .set({
            isPaused: false,
            timerEndTime: newTimerEnd
          })
          .where(eq(auctionState.id, currentState.id));

        // Log the resume
        if (currentState.currentPlayerId) {
          const players = await db.select().from(auctionPlayers)
            .where(eq(auctionPlayers.id, currentState.currentPlayerId));
          
          await db.insert(auctionLogs).values({
            eventType: 'resume',
            playerId: currentState.currentPlayerId,
            playerName: players[0]?.name || 'Unknown',
            roundId: currentState.roundId,
            timestamp: new Date()
          });
        }

        return NextResponse.json({ success: true, action: 'resumed' });
      }

      case 'stop': {
        if (!currentState || !currentState.isActive) {
          return NextResponse.json({ error: 'No active auction' }, { status: 400 });
        }

        // Add current player to unsold if exists
        if (currentState.currentPlayerId) {
          const players = await db.select().from(auctionPlayers)
            .where(eq(auctionPlayers.id, currentState.currentPlayerId));
          
          if (players.length > 0) {
            const player = players[0];
            await db.insert(unsoldPlayers).values({
              playerId: player.id,
              name: player.name,
              category: player.category,
              basePrice: player.basePrice,
              roundId: currentState.roundId
            });

            // Log the stop
            await db.insert(auctionLogs).values({
              eventType: 'stop',
              playerId: player.id,
              playerName: player.name,
              roundId: currentState.roundId,
              timestamp: new Date()
            });
          }
        }

        await db.update(auctionState)
          .set({
            isActive: false,
            currentPlayerId: null,
            currentBid: 0,
            highestBidderId: null,
            timerEndTime: 0,
            isPaused: false
          })
          .where(eq(auctionState.id, currentState.id));

        return NextResponse.json({ success: true, action: 'stopped' });
      }

      case 'skip': {
        if (!currentState || !currentState.isActive) {
          return NextResponse.json({ error: 'No active auction' }, { status: 400 });
        }

        // Add current player to unsold
        if (currentState.currentPlayerId) {
          const players = await db.select().from(auctionPlayers)
            .where(eq(auctionPlayers.id, currentState.currentPlayerId));
          
          if (players.length > 0) {
            const player = players[0];
            await db.insert(unsoldPlayers).values({
              playerId: player.id,
              name: player.name,
              category: player.category,
              basePrice: player.basePrice,
              roundId: currentState.roundId
            });

            // Mark as auctioned
            await db.update(auctionPlayers)
              .set({ status: 'unsold' })
              .where(eq(auctionPlayers.id, player.id));

            // Log the skip
            await db.insert(auctionLogs).values({
              eventType: 'unsold',
              playerId: player.id,
              playerName: player.name,
              roundId: currentState.roundId,
              timestamp: new Date()
            });
          }
        }

        // Reset state but keep roundId
        await db.update(auctionState)
          .set({
            isActive: false,
            currentPlayerId: null,
            currentBid: 0,
            highestBidderId: null,
            timerEndTime: 0,
            isPaused: false
          })
          .where(eq(auctionState.id, currentState.id));

        return NextResponse.json({ success: true, action: 'skipped' });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Auction control error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
