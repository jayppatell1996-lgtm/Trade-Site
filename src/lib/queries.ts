import { db } from '@/db';
import { teams, players, trades } from '@/db/schema';
import { eq, desc, and, or } from 'drizzle-orm';

export type TeamWithPlayers = {
  id: number;
  name: string;
  ownerId: string;
  maxSize: number;
  players: { id: number; playerId: string; name: string }[];
};

export type TradeRecord = {
  id: number;
  timestamp: string;
  team1Name: string;
  team2Name: string;
  players1: { id: string; name: string }[];
  players2: { id: string; name: string }[];
};

export async function getAllTeams(): Promise<TeamWithPlayers[]> {
  const teamsData = await db.select().from(teams);
  const playersData = await db.select().from(players);

  return teamsData.map(team => ({
    ...team,
    players: playersData
      .filter(p => p.teamId === team.id)
      .map(p => ({ id: p.id, playerId: p.playerId, name: p.name })),
  }));
}

export async function getTeamByName(name: string): Promise<TeamWithPlayers | null> {
  const [team] = await db.select().from(teams).where(eq(teams.name, name));
  if (!team) return null;

  const teamPlayers = await db.select().from(players).where(eq(players.teamId, team.id));

  return {
    ...team,
    players: teamPlayers.map(p => ({ id: p.id, playerId: p.playerId, name: p.name })),
  };
}

export async function getRecentTrades(limit = 10): Promise<TradeRecord[]> {
  const tradesData = await db
    .select()
    .from(trades)
    .orderBy(desc(trades.timestamp))
    .limit(limit);

  return tradesData.map(trade => ({
    id: trade.id,
    timestamp: trade.timestamp,
    team1Name: trade.team1Name,
    team2Name: trade.team2Name,
    players1: JSON.parse(trade.players1),
    players2: JSON.parse(trade.players2),
  }));
}

export async function getLeagueStats() {
  const teamsData = await db.select().from(teams);
  const playersData = await db.select().from(players);
  const tradesData = await db.select().from(trades);

  // Get trades from last 7 days
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const recentTrades = tradesData.filter(
    t => new Date(t.timestamp) > weekAgo
  );

  return {
    totalTeams: teamsData.length,
    totalPlayers: playersData.length,
    totalTrades: tradesData.length,
    recentTradeVolume: recentTrades.length,
    teams: teamsData.map(team => ({
      ...team,
      playerCount: playersData.filter(p => p.teamId === team.id).length,
    })),
  };
}

export async function executeTrade(
  team1Name: string,
  team2Name: string,
  player1Ids: string[],
  player2Ids: string[]
): Promise<{ success: boolean; message: string }> {
  try {
    // Get both teams
    const [team1] = await db.select().from(teams).where(eq(teams.name, team1Name));
    const [team2] = await db.select().from(teams).where(eq(teams.name, team2Name));

    if (!team1 || !team2) {
      return { success: false, message: 'One or both teams not found' };
    }

    // Get all players involved
    const team1Players = await db
      .select()
      .from(players)
      .where(and(
        eq(players.teamId, team1.id),
      ));
    const team2Players = await db
      .select()
      .from(players)
      .where(eq(players.teamId, team2.id));

    // Validate players exist on correct teams
    const players1 = team1Players.filter(p => player1Ids.includes(p.playerId));
    const players2 = team2Players.filter(p => player2Ids.includes(p.playerId));

    if (players1.length !== player1Ids.length) {
      return { success: false, message: 'Some players not found on team 1' };
    }
    if (players2.length !== player2Ids.length) {
      return { success: false, message: 'Some players not found on team 2' };
    }

    // Check roster limits after trade
    const team1FinalSize = team1Players.length - players1.length + players2.length;
    const team2FinalSize = team2Players.length - players2.length + players1.length;

    if (team1FinalSize > team1.maxSize) {
      return { success: false, message: `${team1Name} would exceed max roster size` };
    }
    if (team2FinalSize > team2.maxSize) {
      return { success: false, message: `${team2Name} would exceed max roster size` };
    }

    // Execute the trade - update player team assignments
    for (const player of players1) {
      await db.update(players).set({ teamId: team2.id }).where(eq(players.id, player.id));
    }
    for (const player of players2) {
      await db.update(players).set({ teamId: team1.id }).where(eq(players.id, player.id));
    }

    // Record the trade
    await db.insert(trades).values({
      timestamp: new Date().toISOString(),
      team1Name,
      team2Name,
      players1: JSON.stringify(players1.map(p => ({ id: p.playerId, name: p.name }))),
      players2: JSON.stringify(players2.map(p => ({ id: p.playerId, name: p.name }))),
    });

    return { success: true, message: 'Trade executed successfully' };
  } catch (error) {
    console.error('Trade error:', error);
    return { success: false, message: 'An error occurred during the trade' };
  }
}
