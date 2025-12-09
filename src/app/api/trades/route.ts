import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getRecentTrades, executeTrade, getTeamByName } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    
    const trades = await getRecentTrades(limit);
    return NextResponse.json(trades);
  } catch (error) {
    console.error('Error fetching trades:', error);
    return NextResponse.json({ error: 'Failed to fetch trades' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'You must be signed in to make trades' },
        { status: 401 }
      );
    }

    const userDiscordId = (session.user as any)?.discordId;
    
    if (!userDiscordId) {
      return NextResponse.json(
        { success: false, message: 'Could not verify your Discord identity' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { team1Name, team2Name, player1Ids, player2Ids } = body;

    // Basic validation
    if (!team1Name || !team2Name) {
      return NextResponse.json(
        { success: false, message: 'Both teams must be specified' },
        { status: 400 }
      );
    }

    if (!player1Ids?.length || !player2Ids?.length) {
      return NextResponse.json(
        { success: false, message: 'Both teams must offer at least one player' },
        { status: 400 }
      );
    }

    if (player1Ids.length > 5 || player2Ids.length > 5) {
      return NextResponse.json(
        { success: false, message: 'Maximum 5 players per side in a trade' },
        { status: 400 }
      );
    }

    if (team1Name === team2Name) {
      return NextResponse.json(
        { success: false, message: 'Cannot trade with yourself' },
        { status: 400 }
      );
    }

    // Verify the user owns team1 (the proposing team)
    const team1 = await getTeamByName(team1Name);
    
    if (!team1) {
      return NextResponse.json(
        { success: false, message: `Team "${team1Name}" not found` },
        { status: 404 }
      );
    }

    if (team1.ownerId !== userDiscordId) {
      return NextResponse.json(
        { success: false, message: `You don't own ${team1Name}. Only team owners can trade their players.` },
        { status: 403 }
      );
    }

    // Execute the trade
    const result = await executeTrade(team1Name, team2Name, player1Ids, player2Ids);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error executing trade:', error);
    return NextResponse.json(
      { success: false, message: 'An error occurred during the trade' },
      { status: 500 }
    );
  }
}
