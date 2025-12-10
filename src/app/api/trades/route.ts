import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { trades, teams, players } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Discord webhook for trade notifications
async function sendTradeNotification(
  team1Name: string,
  team2Name: string,
  players1: string[],
  players2: string[]
) {
  const webhookUrl = process.env.DISCORD_TRADE_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log('No Discord webhook URL configured for trades');
    return;
  }

  try {
    const embed = {
      title: '🔄 Trade Completed!',
      color: 0x00d4aa, // Accent green color
      fields: [
        {
          name: `📤 ${team1Name} sends`,
          value: players1.length > 0 ? players1.join('\n') : 'No players',
          inline: true,
        },
        {
          name: `📥 ${team2Name} sends`,
          value: players2.length > 0 ? players2.join('\n') : 'No players',
          inline: true,
        },
      ],
      footer: {
        text: 'Wispbyte League Trade Center',
      },
      timestamp: new Date().toISOString(),
    };

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [embed],
      }),
    });
    console.log('Trade notification sent to Discord');
  } catch (error) {
    console.error('Failed to send trade notification:', error);
  }
}

export async function GET() {
  try {
    const allTrades = await db.select().from(trades).orderBy(trades.id);
    return NextResponse.json(allTrades);
  } catch (error) {
    console.error('Error fetching trades:', error);
    return NextResponse.json({ error: 'Failed to fetch trades' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.discordId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { team1Name, team2Name, players1, players2 } = body;

    // Verify user owns team1
    const allTeams = await db.select().from(teams);
    const team1 = allTeams.find(t => t.name === team1Name);
    const team2 = allTeams.find(t => t.name === team2Name);

    if (!team1 || !team2) {
      return NextResponse.json({ error: 'Invalid teams' }, { status: 400 });
    }

    if (team1.ownerId !== session.user.discordId) {
      return NextResponse.json({ error: 'You do not own this team' }, { status: 403 });
    }

    // Execute the trade
    const timestamp = new Date().toISOString();

    // Move players from team1 to team2
    for (const playerName of players1) {
      await db.update(players)
        .set({ teamId: team2.id })
        .where(eq(players.name, playerName));
    }

    // Move players from team2 to team1
    for (const playerName of players2) {
      await db.update(players)
        .set({ teamId: team1.id })
        .where(eq(players.name, playerName));
    }

    // Record the trade
    const newTrade = await db.insert(trades).values({
      timestamp,
      team1Name,
      team2Name,
      players1: JSON.stringify(players1),
      players2: JSON.stringify(players2),
    }).returning();

    // Send Discord notification
    await sendTradeNotification(team1Name, team2Name, players1, players2);

    return NextResponse.json(newTrade[0]);
  } catch (error) {
    console.error('Error creating trade:', error);
    return NextResponse.json({ error: 'Failed to create trade' }, { status: 500 });
  }
}
