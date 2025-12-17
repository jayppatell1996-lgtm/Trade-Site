import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, ADMIN_IDS } from '@/lib/auth';
import { db } from '@/db';
import { trades, teams, players, pendingTrades } from '@/db/schema';
import { eq, or, and } from 'drizzle-orm';

// Discord webhook for trade notifications (public channel)
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
      color: 0x00d4aa,
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
      body: JSON.stringify({ embeds: [embed] }),
    });
    console.log('Trade notification sent to Discord');
  } catch (error) {
    console.error('Failed to send trade notification:', error);
  }
}

// Send Discord DM to a user via bot
async function sendDiscordDM(
  userId: string,
  title: string,
  description: string,
  color: number = 0xffc61a
) {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) {
    console.log('No Discord bot token configured for DMs');
    return false;
  }

  try {
    // First, create a DM channel with the user
    const dmChannelRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recipient_id: userId }),
    });

    if (!dmChannelRes.ok) {
      console.error('Failed to create DM channel:', await dmChannelRes.text());
      return false;
    }

    const dmChannel = await dmChannelRes.json();

    // Send the message
    const messageRes = await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds: [{
          title,
          description,
          color,
          footer: { text: 'Wispbyte League Trade Center' },
          timestamp: new Date().toISOString(),
        }],
      }),
    });

    if (!messageRes.ok) {
      console.error('Failed to send DM:', await messageRes.text());
      return false;
    }

    console.log('Discord DM sent successfully to user:', userId);
    return true;
  } catch (error) {
    console.error('Failed to send Discord DM:', error);
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';

    // Get completed trades
    const completedTrades = await db.select().from(trades).orderBy(trades.id);

    // Get pending trades
    let pendingTradesData: any[] = [];
    if (session?.user?.discordId) {
      // Get pending trades where user is proposer or target
      pendingTradesData = await db.select()
        .from(pendingTrades)
        .where(
          and(
            eq(pendingTrades.status, 'pending'),
            or(
              eq(pendingTrades.proposerId, session.user.discordId),
              eq(pendingTrades.targetId, session.user.discordId)
            )
          )
        );
    }

    if (type === 'pending') {
      return NextResponse.json(pendingTradesData);
    } else if (type === 'completed') {
      return NextResponse.json(completedTrades);
    }

    return NextResponse.json({
      completed: completedTrades,
      pending: pendingTradesData,
    });
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
    const { team1Name, team2Name, players1, players2, message, directTrade } = body;

    // Verify teams exist
    const allTeams = await db.select().from(teams);
    const team1 = allTeams.find(t => t.name === team1Name);
    const team2 = allTeams.find(t => t.name === team2Name);

    if (!team1 || !team2) {
      return NextResponse.json({ error: 'Invalid teams' }, { status: 400 });
    }

    // Verify user owns team1
    if (team1.ownerId !== session.user.discordId) {
      return NextResponse.json({ error: 'You do not own this team' }, { status: 403 });
    }

    // If directTrade is true (admin override) or same owner, execute immediately
    const isAdmin = ADMIN_IDS.includes(session.user.discordId);
    if (directTrade && isAdmin) {
      // Execute trade directly (admin bypass)
      return await executeTrade(team1, team2, players1, players2);
    }

    // Check if there's already a pending trade between these teams
    const existingPending = await db.select()
      .from(pendingTrades)
      .where(
        and(
          eq(pendingTrades.status, 'pending'),
          or(
            and(
              eq(pendingTrades.proposerTeamId, team1.id),
              eq(pendingTrades.targetTeamId, team2.id)
            ),
            and(
              eq(pendingTrades.proposerTeamId, team2.id),
              eq(pendingTrades.targetTeamId, team1.id)
            )
          )
        )
      );

    if (existingPending.length > 0) {
      return NextResponse.json({ 
        error: 'There is already a pending trade between these teams. Please wait for the other team to respond or cancel the existing proposal.' 
      }, { status: 400 });
    }

    // Create pending trade proposal
    const newProposal = await db.insert(pendingTrades).values({
      proposerId: session.user.discordId,
      proposerTeamId: team1.id,
      proposerTeamName: team1.name,
      targetId: team2.ownerId,
      targetTeamId: team2.id,
      targetTeamName: team2.name,
      proposerPlayers: JSON.stringify(players1),
      targetPlayers: JSON.stringify(players2),
      status: 'pending',
      message: message || null,
      createdAt: new Date().toISOString(),
    }).returning();

    // Send Discord DM to target team owner
    const proposerPlayersList = players1.length > 0 ? players1.join(', ') : 'No players';
    const targetPlayersList = players2.length > 0 ? players2.join(', ') : 'No players';
    
    await sendDiscordDM(
      team2.ownerId,
      '📨 New Trade Proposal!',
      `**${team1.name}** has proposed a trade with your team **${team2.name}**!\n\n` +
      `**They offer:** ${proposerPlayersList}\n` +
      `**They want:** ${targetPlayersList}\n` +
      `${message ? `\n**Message:** ${message}\n` : ''}\n` +
      `🔗 [Click here to review and respond](${process.env.NEXTAUTH_URL || 'https://trade-site-nine.vercel.app'}/trade-center)`,
      0xffc61a // Yellow/gold color
    );

    return NextResponse.json({ 
      success: true, 
      message: 'Trade proposal sent! The other team owner has been notified.',
      proposal: newProposal[0]
    });
  } catch (error) {
    console.error('Error creating trade proposal:', error);
    return NextResponse.json({ error: 'Failed to create trade proposal' }, { status: 500 });
  }
}

// Helper function to execute a trade
async function executeTrade(team1: any, team2: any, players1: string[], players2: string[]) {
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
    team1Name: team1.name,
    team2Name: team2.name,
    players1: JSON.stringify(players1),
    players2: JSON.stringify(players2),
  }).returning();

  // Send Discord notification
  await sendTradeNotification(team1.name, team2.name, players1, players2);

  return NextResponse.json({ success: true, trade: newTrade[0] });
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.discordId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { tradeId, action } = body; // action: 'accept', 'reject', 'cancel'

    if (!tradeId || !action) {
      return NextResponse.json({ error: 'Trade ID and action required' }, { status: 400 });
    }

    // Get the pending trade
    const pendingTradeArr = await db.select()
      .from(pendingTrades)
      .where(eq(pendingTrades.id, tradeId));

    if (pendingTradeArr.length === 0) {
      return NextResponse.json({ error: 'Trade proposal not found' }, { status: 404 });
    }

    const proposal = pendingTradeArr[0];

    if (proposal.status !== 'pending') {
      return NextResponse.json({ error: 'This trade proposal has already been processed' }, { status: 400 });
    }

    const userId = session.user.discordId;
    const isProposer = proposal.proposerId === userId;
    const isTarget = proposal.targetId === userId;
    const isAdmin = ADMIN_IDS.includes(userId);

    if (!isProposer && !isTarget && !isAdmin) {
      return NextResponse.json({ error: 'You are not part of this trade' }, { status: 403 });
    }

    switch (action) {
      case 'cancel': {
        // Only proposer or admin can cancel
        if (!isProposer && !isAdmin) {
          return NextResponse.json({ error: 'Only the proposer can cancel this trade' }, { status: 403 });
        }

        await db.update(pendingTrades)
          .set({ status: 'cancelled', respondedAt: new Date().toISOString() })
          .where(eq(pendingTrades.id, tradeId));

        // Notify the target
        await sendDiscordDM(
          proposal.targetId,
          '❌ Trade Cancelled',
          `**${proposal.proposerTeamName}** has cancelled their trade proposal with your team.`,
          0xed4245 // Red color
        );

        return NextResponse.json({ success: true, message: 'Trade proposal cancelled' });
      }

      case 'reject': {
        // Only target or admin can reject
        if (!isTarget && !isAdmin) {
          return NextResponse.json({ error: 'Only the target team can reject this trade' }, { status: 403 });
        }

        await db.update(pendingTrades)
          .set({ status: 'rejected', respondedAt: new Date().toISOString() })
          .where(eq(pendingTrades.id, tradeId));

        // Notify the proposer
        await sendDiscordDM(
          proposal.proposerId,
          '❌ Trade Rejected',
          `**${proposal.targetTeamName}** has rejected your trade proposal.`,
          0xed4245 // Red color
        );

        return NextResponse.json({ success: true, message: 'Trade proposal rejected' });
      }

      case 'accept': {
        // Only target or admin can accept
        if (!isTarget && !isAdmin) {
          return NextResponse.json({ error: 'Only the target team can accept this trade' }, { status: 403 });
        }

        // Get teams
        const allTeams = await db.select().from(teams);
        const team1 = allTeams.find(t => t.id === proposal.proposerTeamId);
        const team2 = allTeams.find(t => t.id === proposal.targetTeamId);

        if (!team1 || !team2) {
          return NextResponse.json({ error: 'Teams not found' }, { status: 404 });
        }

        const players1 = JSON.parse(proposal.proposerPlayers);
        const players2 = JSON.parse(proposal.targetPlayers);

        // Verify all players still belong to their respective teams
        const allPlayers = await db.select().from(players);
        
        for (const playerName of players1) {
          const player = allPlayers.find(p => p.name === playerName);
          if (!player || player.teamId !== team1.id) {
            return NextResponse.json({ 
              error: `Player ${playerName} is no longer on ${team1.name}. Trade cancelled.` 
            }, { status: 400 });
          }
        }

        for (const playerName of players2) {
          const player = allPlayers.find(p => p.name === playerName);
          if (!player || player.teamId !== team2.id) {
            return NextResponse.json({ 
              error: `Player ${playerName} is no longer on ${team2.name}. Trade cancelled.` 
            }, { status: 400 });
          }
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

        // Record the completed trade
        await db.insert(trades).values({
          timestamp,
          team1Name: team1.name,
          team2Name: team2.name,
          players1: JSON.stringify(players1),
          players2: JSON.stringify(players2),
        });

        // Update pending trade status
        await db.update(pendingTrades)
          .set({ status: 'accepted', respondedAt: timestamp })
          .where(eq(pendingTrades.id, tradeId));

        // Send Discord channel notification
        await sendTradeNotification(team1.name, team2.name, players1, players2);

        // Notify the proposer
        await sendDiscordDM(
          proposal.proposerId,
          '✅ Trade Accepted!',
          `**${proposal.targetTeamName}** has accepted your trade proposal!\n\n` +
          `**You received:** ${players2.join(', ') || 'No players'}\n` +
          `**You sent:** ${players1.join(', ') || 'No players'}`,
          0x57f287 // Green color
        );

        return NextResponse.json({ success: true, message: 'Trade completed successfully!' });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error processing trade action:', error);
    return NextResponse.json({ error: 'Failed to process trade action' }, { status: 500 });
  }
}
