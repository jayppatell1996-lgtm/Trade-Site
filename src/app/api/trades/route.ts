import { NextResponse } from 'next/server';
import { getRecentTrades, executeTrade } from '@/lib/queries';

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
    const body = await request.json();
    const { team1Name, team2Name, player1Ids, player2Ids } = body;

    // Validation
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
