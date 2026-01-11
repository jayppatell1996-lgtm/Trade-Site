import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { 
  players, teams, playerCareerStats, battingPerformances, 
  bowlingPerformances, fieldingPerformances, tournaments, matches 
} from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

// GET - Fetch player stats, leaderboards, etc.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const playerId = searchParams.get('playerId');
  const tournamentId = searchParams.get('tournamentId');
  const teamId = searchParams.get('teamId');

  try {
    // Get all players with their teams
    if (type === 'players') {
      const allPlayers = await db.select({
        id: players.id,
        playerId: players.playerId,
        name: players.name,
        teamId: players.teamId,
        category: players.category,
        boughtFor: players.boughtFor,
      }).from(players);

      const allTeams = await db.select().from(teams);
      const teamMap = Object.fromEntries(allTeams.map(t => [t.id, t.name]));

      const playersWithTeams = allPlayers.map(p => ({
        ...p,
        teamName: teamMap[p.teamId!] || 'Unknown',
      }));

      return NextResponse.json(playersWithTeams);
    }

    // Get single player's full stats
    if (type === 'player' && playerId) {
      const playerIdNum = parseInt(playerId);
      
      // Get player info
      const [player] = await db.select().from(players)
        .where(eq(players.id, playerIdNum));

      if (!player) {
        return NextResponse.json({ error: 'Player not found' }, { status: 404 });
      }

      // Get team info
      const [team] = player.teamId ? await db.select().from(teams)
        .where(eq(teams.id, player.teamId)) : [null];

      // Get career stats
      const careerStats = await db.select().from(playerCareerStats)
        .where(eq(playerCareerStats.playerId, playerIdNum));

      // Get recent batting performances (last 10 matches)
      const recentBatting = await db.select({
        matchId: battingPerformances.matchId,
        runs: battingPerformances.runs,
        balls: battingPerformances.balls,
        fours: battingPerformances.fours,
        sixes: battingPerformances.sixes,
        strikeRate: battingPerformances.strikeRate,
        howOut: battingPerformances.howOut,
        isNotOut: battingPerformances.isNotOut,
        createdAt: battingPerformances.createdAt,
      }).from(battingPerformances)
        .where(eq(battingPerformances.playerId, playerIdNum))
        .orderBy(desc(battingPerformances.id))
        .limit(10);

      // Get recent bowling performances
      const recentBowling = await db.select({
        matchId: bowlingPerformances.matchId,
        overs: bowlingPerformances.overs,
        maidens: bowlingPerformances.maidens,
        runs: bowlingPerformances.runs,
        wickets: bowlingPerformances.wickets,
        economy: bowlingPerformances.economy,
        createdAt: bowlingPerformances.createdAt,
      }).from(bowlingPerformances)
        .where(eq(bowlingPerformances.playerId, playerIdNum))
        .orderBy(desc(bowlingPerformances.id))
        .limit(10);

      // Get fielding stats
      const fieldingStats = await db.select().from(fieldingPerformances)
        .where(eq(fieldingPerformances.playerId, playerIdNum));

      // Aggregate career totals
      const overallStats = careerStats.reduce((acc, stat) => ({
        battingMatches: (acc.battingMatches || 0) + (stat.battingMatches || 0),
        battingInnings: (acc.battingInnings || 0) + (stat.battingInnings || 0),
        totalRuns: (acc.totalRuns || 0) + (stat.totalRuns || 0),
        highestScore: Math.max(acc.highestScore || 0, stat.highestScore || 0),
        totalBalls: (acc.totalBalls || 0) + (stat.totalBalls || 0),
        totalFours: (acc.totalFours || 0) + (stat.totalFours || 0),
        totalSixes: (acc.totalSixes || 0) + (stat.totalSixes || 0),
        fifties: (acc.fifties || 0) + (stat.fifties || 0),
        hundreds: (acc.hundreds || 0) + (stat.hundreds || 0),
        notOuts: (acc.notOuts || 0) + (stat.notOuts || 0),
        bowlingMatches: (acc.bowlingMatches || 0) + (stat.bowlingMatches || 0),
        bowlingInnings: (acc.bowlingInnings || 0) + (stat.bowlingInnings || 0),
        totalOvers: (acc.totalOvers || 0) + (stat.totalOvers || 0),
        totalMaidens: (acc.totalMaidens || 0) + (stat.totalMaidens || 0),
        totalRunsConceded: (acc.totalRunsConceded || 0) + (stat.totalRunsConceded || 0),
        totalWickets: (acc.totalWickets || 0) + (stat.totalWickets || 0),
        threeWickets: (acc.threeWickets || 0) + (stat.threeWickets || 0),
        fiveWickets: (acc.fiveWickets || 0) + (stat.fiveWickets || 0),
        playerOfMatch: (acc.playerOfMatch || 0) + (stat.playerOfMatch || 0),
      }), {} as any);

      // Calculate averages
      const dismissals = (overallStats.battingInnings || 0) - (overallStats.notOuts || 0);
      overallStats.battingAverage = dismissals > 0 ? 
        (overallStats.totalRuns || 0) / dismissals : overallStats.totalRuns || 0;
      overallStats.battingStrikeRate = (overallStats.totalBalls || 0) > 0 ?
        ((overallStats.totalRuns || 0) / (overallStats.totalBalls || 0)) * 100 : 0;
      overallStats.bowlingAverage = (overallStats.totalWickets || 0) > 0 ?
        (overallStats.totalRunsConceded || 0) / (overallStats.totalWickets || 0) : 0;
      overallStats.bowlingEconomy = (overallStats.totalOvers || 0) > 0 ?
        (overallStats.totalRunsConceded || 0) / (overallStats.totalOvers || 0) : 0;

      // Aggregate fielding
      const totalFielding = fieldingStats.reduce((acc, f) => ({
        catches: (acc.catches || 0) + (f.catches || 0),
        runOuts: (acc.runOuts || 0) + (f.runOuts || 0),
        stumpings: (acc.stumpings || 0) + (f.stumpings || 0),
      }), {} as any);

      return NextResponse.json({
        player: {
          ...player,
          teamName: team?.name || 'Unknown',
        },
        overallStats,
        tournamentStats: careerStats,
        recentBatting,
        recentBowling,
        fieldingStats: totalFielding,
      });
    }

    // Get batting leaderboard
    if (type === 'batting_leaderboard') {
      const tournamentFilter = tournamentId ? 
        eq(playerCareerStats.tournamentId, parseInt(tournamentId)) : undefined;

      const leaderboard = await db.select({
        playerId: playerCareerStats.playerId,
        playerName: playerCareerStats.playerName,
        teamId: playerCareerStats.teamId,
        matches: playerCareerStats.battingMatches,
        innings: playerCareerStats.battingInnings,
        runs: playerCareerStats.totalRuns,
        highestScore: playerCareerStats.highestScore,
        average: playerCareerStats.battingAverage,
        strikeRate: playerCareerStats.battingStrikeRate,
        fifties: playerCareerStats.fifties,
        hundreds: playerCareerStats.hundreds,
        fours: playerCareerStats.totalFours,
        sixes: playerCareerStats.totalSixes,
      }).from(playerCareerStats)
        .where(tournamentFilter)
        .orderBy(desc(playerCareerStats.totalRuns))
        .limit(50);

      // Get team names
      const allTeams = await db.select().from(teams);
      const teamMap = Object.fromEntries(allTeams.map(t => [t.id, t.name]));

      const leaderboardWithTeams = leaderboard.map(p => ({
        ...p,
        teamName: teamMap[p.teamId!] || 'Unknown',
      }));

      return NextResponse.json(leaderboardWithTeams);
    }

    // Get bowling leaderboard
    if (type === 'bowling_leaderboard') {
      const tournamentFilter = tournamentId ? 
        eq(playerCareerStats.tournamentId, parseInt(tournamentId)) : undefined;

      const leaderboard = await db.select({
        playerId: playerCareerStats.playerId,
        playerName: playerCareerStats.playerName,
        teamId: playerCareerStats.teamId,
        matches: playerCareerStats.bowlingMatches,
        innings: playerCareerStats.bowlingInnings,
        overs: playerCareerStats.totalOvers,
        maidens: playerCareerStats.totalMaidens,
        runs: playerCareerStats.totalRunsConceded,
        wickets: playerCareerStats.totalWickets,
        average: playerCareerStats.bowlingAverage,
        economy: playerCareerStats.bowlingEconomy,
        threeWickets: playerCareerStats.threeWickets,
        fiveWickets: playerCareerStats.fiveWickets,
      }).from(playerCareerStats)
        .where(tournamentFilter)
        .orderBy(desc(playerCareerStats.totalWickets))
        .limit(50);

      const allTeams = await db.select().from(teams);
      const teamMap = Object.fromEntries(allTeams.map(t => [t.id, t.name]));

      const leaderboardWithTeams = leaderboard.map(p => ({
        ...p,
        teamName: teamMap[p.teamId!] || 'Unknown',
      }));

      return NextResponse.json(leaderboardWithTeams);
    }

    // Get team stats
    if (type === 'team_stats' && teamId) {
      const teamIdNum = parseInt(teamId);

      // Get team players
      const teamPlayers = await db.select().from(players)
        .where(eq(players.teamId, teamIdNum));

      // Get player career stats for this team
      const playerIds = teamPlayers.map(p => p.id);
      
      const playerStats = await db.select().from(playerCareerStats)
        .where(sql`${playerCareerStats.playerId} IN (${playerIds.join(',')})`);

      return NextResponse.json({
        players: teamPlayers,
        stats: playerStats,
      });
    }

    // Get available tournaments for filtering
    if (type === 'tournaments') {
      const allTournaments = await db.select({
        id: tournaments.id,
        name: tournaments.name,
        status: tournaments.status,
      }).from(tournaments)
        .orderBy(desc(tournaments.id));

      return NextResponse.json(allTournaments);
    }

    // Get match performance for a specific match
    if (type === 'match_performance' && searchParams.get('matchId')) {
      const matchIdNum = parseInt(searchParams.get('matchId')!);

      const batting = await db.select().from(battingPerformances)
        .where(eq(battingPerformances.matchId, matchIdNum))
        .orderBy(battingPerformances.battingPosition);

      const bowling = await db.select().from(bowlingPerformances)
        .where(eq(bowlingPerformances.matchId, matchIdNum));

      const fielding = await db.select().from(fieldingPerformances)
        .where(eq(fieldingPerformances.matchId, matchIdNum));

      return NextResponse.json({ batting, bowling, fielding });
    }

    return NextResponse.json({ error: 'Invalid request type' }, { status: 400 });
  } catch (error) {
    console.error('Error in stats GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
