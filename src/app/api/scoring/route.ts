import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, ADMIN_IDS } from '@/lib/auth';
import { db } from '@/db';
import { 
  matches, teams, players, innings, deliveries, 
  battingPerformances, bowlingPerformances, fieldingPerformances,
  matchEvents, liveMatchState, partnerships, groupTeams, playerCareerStats
} from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

// GET - Fetch live match state, scorecard, or available matches
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const matchId = searchParams.get('matchId');

  try {
    // Get list of matches available for scoring
    if (type === 'matches') {
      const allMatches = await db.select({
        id: matches.id,
        matchNumber: matches.matchNumber,
        team1Id: matches.team1Id,
        team2Id: matches.team2Id,
        venue: matches.venue,
        city: matches.city,
        matchDate: matches.matchDate,
        matchTime: matches.matchTime,
        status: matches.status,
      }).from(matches).orderBy(desc(matches.id));

      const allTeams = await db.select().from(teams);
      const teamMap = Object.fromEntries(allTeams.map(t => [t.id, t.name]));

      const matchesWithTeams = allMatches.map(m => ({
        ...m,
        team1Name: teamMap[m.team1Id!] || 'TBD',
        team2Name: teamMap[m.team2Id!] || 'TBD',
      }));

      return NextResponse.json(matchesWithTeams);
    }

    // Get live match state
    if (type === 'live' && matchId) {
      const liveState = await db.select().from(liveMatchState)
        .where(eq(liveMatchState.matchId, parseInt(matchId)))
        .limit(1);

      if (liveState.length === 0) {
        return NextResponse.json({ isLive: false });
      }

      return NextResponse.json(liveState[0]);
    }

    // Get full scorecard
    if (type === 'scorecard' && matchId) {
      const matchIdNum = parseInt(matchId);
      
      const [match] = await db.select().from(matches).where(eq(matches.id, matchIdNum));
      if (!match) {
        return NextResponse.json({ error: 'Match not found' }, { status: 404 });
      }

      const allTeams = await db.select().from(teams);
      const teamMap = Object.fromEntries(allTeams.map(t => [t.id, t]));

      const matchInnings = await db.select().from(innings)
        .where(eq(innings.matchId, matchIdNum))
        .orderBy(innings.inningsNumber);

      const batting = await db.select().from(battingPerformances)
        .where(eq(battingPerformances.matchId, matchIdNum))
        .orderBy(battingPerformances.battingPosition);

      const bowling = await db.select().from(bowlingPerformances)
        .where(eq(bowlingPerformances.matchId, matchIdNum));

      const partnershipData = await db.select().from(partnerships)
        .where(eq(partnerships.matchId, matchIdNum));

      const [liveState] = await db.select().from(liveMatchState)
        .where(eq(liveMatchState.matchId, matchIdNum));

      const recentDeliveries = await db.select().from(deliveries)
        .where(eq(deliveries.matchId, matchIdNum))
        .orderBy(desc(deliveries.id))
        .limit(36);

      const events = await db.select().from(matchEvents)
        .where(eq(matchEvents.matchId, matchIdNum))
        .orderBy(desc(matchEvents.timestamp))
        .limit(50);

      return NextResponse.json({
        match: {
          ...match,
          team1: teamMap[match.team1Id!],
          team2: teamMap[match.team2Id!],
        },
        innings: matchInnings,
        batting,
        bowling,
        partnerships: partnershipData,
        liveState,
        recentDeliveries: recentDeliveries.reverse(),
        events,
      });
    }

    // Get players for a team
    if (type === 'players' && searchParams.get('teamId')) {
      const teamId = parseInt(searchParams.get('teamId')!);
      const teamPlayers = await db.select().from(players)
        .where(eq(players.teamId, teamId));
      return NextResponse.json(teamPlayers);
    }

    return NextResponse.json({ error: 'Invalid request type' }, { status: 400 });
  } catch (error) {
    console.error('Error in scoring GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Scoring actions
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !ADMIN_IDS.includes(session.user.id)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    // START MATCH
    if (action === 'start_match') {
      const { matchId, tossWinnerId, tossDecision } = body;

      await db.update(matches)
        .set({ status: 'live' })
        .where(eq(matches.id, matchId));

      const [match] = await db.select().from(matches).where(eq(matches.id, matchId));

      const battingFirstId = tossDecision === 'bat' ? tossWinnerId : 
        (tossWinnerId === match.team1Id ? match.team2Id : match.team1Id);
      const bowlingFirstId = battingFirstId === match.team1Id ? match.team2Id : match.team1Id;

      const [newInnings] = await db.insert(innings).values({
        matchId,
        teamId: battingFirstId,
        inningsNumber: 1,
        createdAt: new Date().toISOString(),
      }).returning();

      // Delete any existing live state for this match
      await db.delete(liveMatchState).where(eq(liveMatchState.matchId, matchId));

      await db.insert(liveMatchState).values({
        matchId,
        currentInningsId: newInnings.id,
        currentInningsNumber: 1,
        battingTeamId: battingFirstId,
        bowlingTeamId: bowlingFirstId,
        isLive: true,
        currentOver: 0,
        currentBall: 0,
        lastUpdated: new Date().toISOString(),
      });

      await db.insert(matchEvents).values({
        matchId,
        inningsId: newInnings.id,
        eventType: 'match_start',
        description: `Match started. Toss decision: ${tossDecision}`,
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json({ 
        success: true, 
        message: 'Match started',
        inningsId: newInnings.id 
      });
    }

    // SET BATSMEN
    if (action === 'set_batsmen') {
      const { matchId, strikerId, strikerName, nonStrikerId, nonStrikerName, inningsId } = body;

      await db.update(liveMatchState)
        .set({
          strikerId,
          strikerName,
          nonStrikerId,
          nonStrikerName,
          lastUpdated: new Date().toISOString(),
        })
        .where(eq(liveMatchState.matchId, matchId));

      const existingBatting = await db.select().from(battingPerformances)
        .where(and(
          eq(battingPerformances.matchId, matchId),
          eq(battingPerformances.inningsId, inningsId)
        ));

      const existingPlayerIds = existingBatting.map(b => b.playerId);
      const battingPosition = existingBatting.length + 1;

      const [currentInnings] = await db.select().from(innings).where(eq(innings.id, inningsId));

      if (strikerId && !existingPlayerIds.includes(strikerId)) {
        await db.insert(battingPerformances).values({
          matchId,
          inningsId,
          playerId: strikerId,
          playerName: strikerName,
          teamId: currentInnings.teamId,
          battingPosition,
          createdAt: new Date().toISOString(),
        });
      }

      if (nonStrikerId && !existingPlayerIds.includes(nonStrikerId)) {
        await db.insert(battingPerformances).values({
          matchId,
          inningsId,
          playerId: nonStrikerId,
          playerName: nonStrikerName,
          teamId: currentInnings.teamId,
          battingPosition: battingPosition + 1,
          createdAt: new Date().toISOString(),
        });
      }

      // Create partnership
      const wicketCount = existingBatting.filter(b => b.isOut).length;
      
      // End any active partnership
      await db.update(partnerships)
        .set({ isActive: false })
        .where(and(
          eq(partnerships.inningsId, inningsId),
          eq(partnerships.isActive, true)
        ));

      await db.insert(partnerships).values({
        inningsId,
        matchId,
        wicketNumber: wicketCount + 1,
        batsman1Id: strikerId,
        batsman1Name: strikerName,
        batsman2Id: nonStrikerId,
        batsman2Name: nonStrikerName,
        isActive: true,
      });

      return NextResponse.json({ success: true, message: 'Batsmen set' });
    }

    // SET BOWLER
    if (action === 'set_bowler') {
      const { matchId, bowlerId, bowlerName, inningsId } = body;

      await db.update(liveMatchState)
        .set({
          currentBowlerId: bowlerId,
          currentBowlerName: bowlerName,
          lastUpdated: new Date().toISOString(),
        })
        .where(eq(liveMatchState.matchId, matchId));

      const [existingBowling] = await db.select().from(bowlingPerformances)
        .where(and(
          eq(bowlingPerformances.matchId, matchId),
          eq(bowlingPerformances.inningsId, inningsId),
          eq(bowlingPerformances.playerId, bowlerId)
        ));

      const [liveState] = await db.select().from(liveMatchState).where(eq(liveMatchState.matchId, matchId));

      if (!existingBowling) {
        await db.insert(bowlingPerformances).values({
          matchId,
          inningsId,
          playerId: bowlerId,
          playerName: bowlerName,
          teamId: liveState.bowlingTeamId,
          createdAt: new Date().toISOString(),
        });
      }

      return NextResponse.json({ success: true, message: 'Bowler set' });
    }

    // RECORD DELIVERY
    if (action === 'record_delivery') {
      const { 
        matchId, inningsId, runs = 0, 
        extraType, extraRuns = 0,
        isWicket = false, wicketType, dismissedBatsmanId, dismissedBatsmanName,
        fielderId, fielderName,
        isFour = false, isSix = false
      } = body;

      const [liveState] = await db.select().from(liveMatchState)
        .where(eq(liveMatchState.matchId, matchId));
      const [currentInnings] = await db.select().from(innings)
        .where(eq(innings.id, inningsId));

      if (!liveState || !currentInnings) {
        return NextResponse.json({ error: 'Match state not found' }, { status: 400 });
      }

      const totalDeliveryRuns = runs + extraRuns;
      const isLegalDelivery = !extraType || (extraType !== 'wide' && extraType !== 'noball');
      
      let newBallNumber = liveState.currentBall || 0;
      let newOverNumber = liveState.currentOver || 0;
      
      if (isLegalDelivery) {
        newBallNumber++;
        if (newBallNumber > 6) {
          newBallNumber = 1;
          newOverNumber++;
        }
      }

      // Insert delivery
      await db.insert(deliveries).values({
        inningsId,
        matchId,
        overNumber: newOverNumber,
        ballNumber: isLegalDelivery ? (newBallNumber === 0 ? 1 : newBallNumber) : liveState.currentBall || 0,
        batsmanId: liveState.strikerId,
        batsmanName: liveState.strikerName || '',
        nonStrikerId: liveState.nonStrikerId,
        nonStrikerName: liveState.nonStrikerName,
        bowlerId: liveState.currentBowlerId,
        bowlerName: liveState.currentBowlerName || '',
        runs,
        extras: extraRuns,
        extraType,
        totalRuns: totalDeliveryRuns,
        isWicket,
        wicketType,
        dismissedBatsmanId,
        dismissedBatsmanName,
        fielderId,
        fielderName,
        isFour,
        isSix,
        timestamp: new Date().toISOString(),
      });

      // Update innings
      const newTotalRuns = (currentInnings.totalRuns || 0) + totalDeliveryRuns;
      const newWickets = (currentInnings.wickets || 0) + (isWicket ? 1 : 0);
      const newOvers = newOverNumber + (newBallNumber / 10);
      const newExtras = (currentInnings.extras || 0) + extraRuns;

      await db.update(innings)
        .set({
          totalRuns: newTotalRuns,
          wickets: newWickets,
          overs: newOvers,
          extras: newExtras,
          wides: (currentInnings.wides || 0) + (extraType === 'wide' ? extraRuns : 0),
          noBalls: (currentInnings.noBalls || 0) + (extraType === 'noball' ? 1 : 0),
          byes: (currentInnings.byes || 0) + (extraType === 'bye' ? extraRuns : 0),
          legByes: (currentInnings.legByes || 0) + (extraType === 'legbye' ? extraRuns : 0),
          runRate: newOvers > 0 ? newTotalRuns / newOvers : 0,
        })
        .where(eq(innings.id, inningsId));

      // Update batting
      if (liveState.strikerId) {
        const [batsmanPerf] = await db.select().from(battingPerformances)
          .where(and(
            eq(battingPerformances.matchId, matchId),
            eq(battingPerformances.inningsId, inningsId),
            eq(battingPerformances.playerId, liveState.strikerId)
          ));

        if (batsmanPerf) {
          const newRuns = (batsmanPerf.runs || 0) + runs;
          const newBalls = (batsmanPerf.balls || 0) + (isLegalDelivery ? 1 : 0);
          const newFours = (batsmanPerf.fours || 0) + (isFour ? 1 : 0);
          const newSixes = (batsmanPerf.sixes || 0) + (isSix ? 1 : 0);

          await db.update(battingPerformances)
            .set({
              runs: newRuns,
              balls: newBalls,
              fours: newFours,
              sixes: newSixes,
              strikeRate: newBalls > 0 ? (newRuns / newBalls) * 100 : 0,
            })
            .where(eq(battingPerformances.id, batsmanPerf.id));
        }
      }

      // Update bowling
      if (liveState.currentBowlerId) {
        const [bowlerPerf] = await db.select().from(bowlingPerformances)
          .where(and(
            eq(bowlingPerformances.matchId, matchId),
            eq(bowlingPerformances.inningsId, inningsId),
            eq(bowlingPerformances.playerId, liveState.currentBowlerId)
          ));

        if (bowlerPerf) {
          const currentOverBalls = Math.round((bowlerPerf.overs || 0) % 1 * 10);
          let newBowlerOvers = bowlerPerf.overs || 0;
          
          if (isLegalDelivery) {
            if (currentOverBalls >= 5) {
              newBowlerOvers = Math.floor(newBowlerOvers) + 1;
            } else {
              newBowlerOvers = Math.floor(newBowlerOvers) + ((currentOverBalls + 1) / 10);
            }
          }

          const newBowlerRuns = (bowlerPerf.runs || 0) + totalDeliveryRuns;
          const newBowlerWickets = (bowlerPerf.wickets || 0) + (isWicket && wicketType !== 'runout' ? 1 : 0);

          await db.update(bowlingPerformances)
            .set({
              overs: newBowlerOvers,
              runs: newBowlerRuns,
              wickets: newBowlerWickets,
              wides: (bowlerPerf.wides || 0) + (extraType === 'wide' ? 1 : 0),
              noBalls: (bowlerPerf.noBalls || 0) + (extraType === 'noball' ? 1 : 0),
              dots: (bowlerPerf.dots || 0) + (totalDeliveryRuns === 0 && isLegalDelivery ? 1 : 0),
              fours: (bowlerPerf.fours || 0) + (isFour ? 1 : 0),
              sixes: (bowlerPerf.sixes || 0) + (isSix ? 1 : 0),
              economy: newBowlerOvers > 0 ? newBowlerRuns / newBowlerOvers : 0,
            })
            .where(eq(bowlingPerformances.id, bowlerPerf.id));
        }
      }

      // Update partnership
      const [activePartnership] = await db.select().from(partnerships)
        .where(and(
          eq(partnerships.inningsId, inningsId),
          eq(partnerships.isActive, true)
        ));

      if (activePartnership) {
        const isStriker = activePartnership.batsman1Id === liveState.strikerId;
        await db.update(partnerships)
          .set({
            batsman1Runs: (activePartnership.batsman1Runs || 0) + (isStriker ? runs : 0),
            batsman1Balls: (activePartnership.batsman1Balls || 0) + (isStriker && isLegalDelivery ? 1 : 0),
            batsman2Runs: (activePartnership.batsman2Runs || 0) + (!isStriker ? runs : 0),
            batsman2Balls: (activePartnership.batsman2Balls || 0) + (!isStriker && isLegalDelivery ? 1 : 0),
            totalRuns: (activePartnership.totalRuns || 0) + totalDeliveryRuns,
            totalBalls: (activePartnership.totalBalls || 0) + (isLegalDelivery ? 1 : 0),
          })
          .where(eq(partnerships.id, activePartnership.id));
      }

      // Handle wicket
      if (isWicket && dismissedBatsmanId) {
        await db.update(battingPerformances)
          .set({
            isOut: true,
            howOut: `${wicketType}${fielderName ? ` ${fielderName}` : ''} b ${liveState.currentBowlerName}`,
            dismissalType: wicketType,
            bowlerId: wicketType !== 'runout' ? liveState.currentBowlerId : null,
            bowlerName: wicketType !== 'runout' ? liveState.currentBowlerName : null,
            fielderId,
            fielderName,
          })
          .where(and(
            eq(battingPerformances.matchId, matchId),
            eq(battingPerformances.inningsId, inningsId),
            eq(battingPerformances.playerId, dismissedBatsmanId)
          ));

        if (activePartnership) {
          await db.update(partnerships)
            .set({ isActive: false })
            .where(eq(partnerships.id, activePartnership.id));
        }

        // Update fielding
        if (fielderId && (wicketType === 'caught' || wicketType === 'runout' || wicketType === 'stumped')) {
          const [existingFielding] = await db.select().from(fieldingPerformances)
            .where(and(
              eq(fieldingPerformances.matchId, matchId),
              eq(fieldingPerformances.playerId, fielderId)
            ));

          if (existingFielding) {
            await db.update(fieldingPerformances)
              .set({
                catches: (existingFielding.catches || 0) + (wicketType === 'caught' ? 1 : 0),
                runOuts: (existingFielding.runOuts || 0) + (wicketType === 'runout' ? 1 : 0),
                stumpings: (existingFielding.stumpings || 0) + (wicketType === 'stumped' ? 1 : 0),
              })
              .where(eq(fieldingPerformances.id, existingFielding.id));
          } else {
            await db.insert(fieldingPerformances).values({
              matchId,
              playerId: fielderId,
              playerName: fielderName || '',
              teamId: liveState.bowlingTeamId,
              catches: wicketType === 'caught' ? 1 : 0,
              runOuts: wicketType === 'runout' ? 1 : 0,
              stumpings: wicketType === 'stumped' ? 1 : 0,
              createdAt: new Date().toISOString(),
            });
          }
        }

        await db.insert(matchEvents).values({
          matchId,
          inningsId,
          eventType: 'wicket',
          overNumber: newOverNumber,
          ballNumber: newBallNumber,
          description: `WICKET! ${dismissedBatsmanName} ${wicketType}${fielderName ? ` by ${fielderName}` : ''}`,
          timestamp: new Date().toISOString(),
        });

        // Clear dismissed batsman
        if (dismissedBatsmanId === liveState.strikerId) {
          await db.update(liveMatchState)
            .set({ strikerId: null, strikerName: null })
            .where(eq(liveMatchState.matchId, matchId));
        } else if (dismissedBatsmanId === liveState.nonStrikerId) {
          await db.update(liveMatchState)
            .set({ nonStrikerId: null, nonStrikerName: null })
            .where(eq(liveMatchState.matchId, matchId));
        }
      }

      // Add boundary event
      if (isFour || isSix) {
        await db.insert(matchEvents).values({
          matchId,
          inningsId,
          eventType: 'boundary',
          overNumber: newOverNumber,
          ballNumber: newBallNumber,
          description: `${isSix ? 'SIX!' : 'FOUR!'} ${liveState.strikerName}`,
          timestamp: new Date().toISOString(),
        });
      }

      // Rotate strike
      let newStrikerId = liveState.strikerId;
      let newStrikerName = liveState.strikerName;
      let newNonStrikerId = liveState.nonStrikerId;
      let newNonStrikerName = liveState.nonStrikerName;

      if (runs % 2 === 1) {
        [newStrikerId, newNonStrikerId] = [newNonStrikerId, newStrikerId];
        [newStrikerName, newNonStrikerName] = [newNonStrikerName, newStrikerName];
      }

      // End of over swap
      if (isLegalDelivery && newBallNumber === 1 && newOverNumber > (liveState.currentOver || 0)) {
        [newStrikerId, newNonStrikerId] = [newNonStrikerId, newStrikerId];
        [newStrikerName, newNonStrikerName] = [newNonStrikerName, newStrikerName];

        await db.insert(matchEvents).values({
          matchId,
          inningsId,
          eventType: 'over_end',
          overNumber: newOverNumber - 1,
          description: `End of over ${newOverNumber}`,
          timestamp: new Date().toISOString(),
        });
      }

      // Update live state
      await db.update(liveMatchState)
        .set({
          currentOver: newOverNumber,
          currentBall: isLegalDelivery ? newBallNumber : liveState.currentBall,
          strikerId: newStrikerId,
          strikerName: newStrikerName,
          nonStrikerId: newNonStrikerId,
          nonStrikerName: newNonStrikerName,
          lastUpdated: new Date().toISOString(),
        })
        .where(eq(liveMatchState.matchId, matchId));

      return NextResponse.json({ 
        success: true, 
        message: 'Delivery recorded',
        currentScore: `${newTotalRuns}/${newWickets}`,
        overs: `${newOverNumber}.${newBallNumber}`,
      });
    }

    // END INNINGS
    if (action === 'end_innings') {
      const { matchId, inningsId } = body;

      await db.update(innings)
        .set({ isCompleted: true })
        .where(eq(innings.id, inningsId));

      const [liveState] = await db.select().from(liveMatchState)
        .where(eq(liveMatchState.matchId, matchId));

      // Mark not out batsmen
      if (liveState.strikerId) {
        await db.update(battingPerformances)
          .set({ isNotOut: true, howOut: 'not out' })
          .where(and(
            eq(battingPerformances.matchId, matchId),
            eq(battingPerformances.inningsId, inningsId),
            eq(battingPerformances.playerId, liveState.strikerId)
          ));
      }
      if (liveState.nonStrikerId) {
        await db.update(battingPerformances)
          .set({ isNotOut: true, howOut: 'not out' })
          .where(and(
            eq(battingPerformances.matchId, matchId),
            eq(battingPerformances.inningsId, inningsId),
            eq(battingPerformances.playerId, liveState.nonStrikerId)
          ));
      }

      const [completedInnings] = await db.select().from(innings)
        .where(eq(innings.id, inningsId));

      if (liveState.currentInningsNumber === 1) {
        const newBattingTeamId = liveState.bowlingTeamId;
        const newBowlingTeamId = liveState.battingTeamId;

        const [newInnings] = await db.insert(innings).values({
          matchId,
          teamId: newBattingTeamId,
          inningsNumber: 2,
          target: (completedInnings.totalRuns || 0) + 1,
          createdAt: new Date().toISOString(),
        }).returning();

        await db.update(liveMatchState)
          .set({
            currentInningsId: newInnings.id,
            currentInningsNumber: 2,
            battingTeamId: newBattingTeamId,
            bowlingTeamId: newBowlingTeamId,
            strikerId: null,
            strikerName: null,
            nonStrikerId: null,
            nonStrikerName: null,
            currentBowlerId: null,
            currentBowlerName: null,
            currentOver: 0,
            currentBall: 0,
            lastUpdated: new Date().toISOString(),
          })
          .where(eq(liveMatchState.matchId, matchId));

        await db.insert(matchEvents).values({
          matchId,
          inningsId: newInnings.id,
          eventType: 'innings_end',
          description: `First innings ends. Target: ${(completedInnings.totalRuns || 0) + 1}`,
          timestamp: new Date().toISOString(),
        });

        return NextResponse.json({ 
          success: true, 
          message: 'First innings ended',
          newInningsId: newInnings.id,
          target: (completedInnings.totalRuns || 0) + 1,
        });
      } else {
        return NextResponse.json({ 
          success: true, 
          message: 'Second innings ended. Use end_match to finalize.',
        });
      }
    }

    // END MATCH
    if (action === 'end_match') {
      const { matchId, result, winnerId } = body;

      await db.update(matches)
        .set({
          status: 'completed',
          winnerId,
          result,
        })
        .where(eq(matches.id, matchId));

      await db.update(liveMatchState)
        .set({ isLive: false })
        .where(eq(liveMatchState.matchId, matchId));

      // Update points table
      const [match] = await db.select().from(matches).where(eq(matches.id, matchId));
      if (match.groupId && match.team1Id && match.team2Id) {
        if (winnerId) {
          // Winner gets 2 points
          const winnerGroupTeam = await db.select().from(groupTeams)
            .where(and(
              eq(groupTeams.groupId, match.groupId),
              eq(groupTeams.teamId, winnerId)
            ));
          
          if (winnerGroupTeam.length > 0) {
            await db.update(groupTeams)
              .set({
                played: (winnerGroupTeam[0].played || 0) + 1,
                won: (winnerGroupTeam[0].won || 0) + 1,
                points: (winnerGroupTeam[0].points || 0) + 2,
              })
              .where(eq(groupTeams.id, winnerGroupTeam[0].id));
          }

          // Loser
          const loserId = winnerId === match.team1Id ? match.team2Id : match.team1Id;
          const loserGroupTeam = await db.select().from(groupTeams)
            .where(and(
              eq(groupTeams.groupId, match.groupId),
              eq(groupTeams.teamId, loserId)
            ));
          
          if (loserGroupTeam.length > 0) {
            await db.update(groupTeams)
              .set({
                played: (loserGroupTeam[0].played || 0) + 1,
                lost: (loserGroupTeam[0].lost || 0) + 1,
              })
              .where(eq(groupTeams.id, loserGroupTeam[0].id));
          }
        }
      }

      await db.insert(matchEvents).values({
        matchId,
        eventType: 'match_end',
        description: result,
        timestamp: new Date().toISOString(),
      });

      // Update player career stats
      await updatePlayerCareerStats(matchId);

      return NextResponse.json({ 
        success: true, 
        message: 'Match ended',
        result,
      });
    }

    // SWAP BATSMEN
    if (action === 'swap_batsmen') {
      const { matchId } = body;
      
      const [liveState] = await db.select().from(liveMatchState)
        .where(eq(liveMatchState.matchId, matchId));

      if (liveState) {
        await db.update(liveMatchState)
          .set({
            strikerId: liveState.nonStrikerId,
            strikerName: liveState.nonStrikerName,
            nonStrikerId: liveState.strikerId,
            nonStrikerName: liveState.strikerName,
            lastUpdated: new Date().toISOString(),
          })
          .where(eq(liveMatchState.matchId, matchId));
      }

      return NextResponse.json({ success: true, message: 'Batsmen swapped' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in scoring POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper to update career stats
async function updatePlayerCareerStats(matchId: number) {
  try {
    const [match] = await db.select().from(matches).where(eq(matches.id, matchId));
    if (!match || !match.tournamentId) return;

    const battingPerfs = await db.select().from(battingPerformances)
      .where(eq(battingPerformances.matchId, matchId));

    for (const perf of battingPerfs) {
      if (!perf.playerId) continue;

      const [existingStats] = await db.select().from(playerCareerStats)
        .where(and(
          eq(playerCareerStats.playerId, perf.playerId),
          eq(playerCareerStats.tournamentId, match.tournamentId)
        ));

      if (existingStats) {
        const newTotalRuns = (existingStats.totalRuns || 0) + (perf.runs || 0);
        const newInnings = (existingStats.battingInnings || 0) + 1;
        const newNotOuts = (existingStats.notOuts || 0) + (perf.isNotOut ? 1 : 0);
        const dismissals = newInnings - newNotOuts;

        await db.update(playerCareerStats)
          .set({
            battingMatches: (existingStats.battingMatches || 0) + 1,
            battingInnings: newInnings,
            totalRuns: newTotalRuns,
            highestScore: Math.max(existingStats.highestScore || 0, perf.runs || 0),
            battingAverage: dismissals > 0 ? newTotalRuns / dismissals : newTotalRuns,
            totalBalls: (existingStats.totalBalls || 0) + (perf.balls || 0),
            battingStrikeRate: ((existingStats.totalBalls || 0) + (perf.balls || 0)) > 0 
              ? (newTotalRuns / ((existingStats.totalBalls || 0) + (perf.balls || 0))) * 100 : 0,
            totalFours: (existingStats.totalFours || 0) + (perf.fours || 0),
            totalSixes: (existingStats.totalSixes || 0) + (perf.sixes || 0),
            fifties: (existingStats.fifties || 0) + ((perf.runs || 0) >= 50 && (perf.runs || 0) < 100 ? 1 : 0),
            hundreds: (existingStats.hundreds || 0) + ((perf.runs || 0) >= 100 ? 1 : 0),
            ducks: (existingStats.ducks || 0) + ((perf.runs || 0) === 0 && perf.isOut ? 1 : 0),
            notOuts: newNotOuts,
            lastUpdated: new Date().toISOString(),
          })
          .where(eq(playerCareerStats.id, existingStats.id));
      } else {
        await db.insert(playerCareerStats).values({
          playerId: perf.playerId,
          playerName: perf.playerName,
          teamId: perf.teamId,
          tournamentId: match.tournamentId,
          battingMatches: 1,
          battingInnings: 1,
          totalRuns: perf.runs || 0,
          highestScore: perf.runs || 0,
          battingAverage: perf.isNotOut ? perf.runs || 0 : perf.runs || 0,
          totalBalls: perf.balls || 0,
          battingStrikeRate: (perf.balls || 0) > 0 ? ((perf.runs || 0) / (perf.balls || 0)) * 100 : 0,
          totalFours: perf.fours || 0,
          totalSixes: perf.sixes || 0,
          fifties: (perf.runs || 0) >= 50 && (perf.runs || 0) < 100 ? 1 : 0,
          hundreds: (perf.runs || 0) >= 100 ? 1 : 0,
          ducks: (perf.runs || 0) === 0 && perf.isOut ? 1 : 0,
          notOuts: perf.isNotOut ? 1 : 0,
          lastUpdated: new Date().toISOString(),
        });
      }
    }

    const bowlingPerfs = await db.select().from(bowlingPerformances)
      .where(eq(bowlingPerformances.matchId, matchId));

    for (const perf of bowlingPerfs) {
      if (!perf.playerId || (perf.overs || 0) === 0) continue;

      const [existingStats] = await db.select().from(playerCareerStats)
        .where(and(
          eq(playerCareerStats.playerId, perf.playerId),
          eq(playerCareerStats.tournamentId, match.tournamentId)
        ));

      if (existingStats) {
        const newTotalOvers = (existingStats.totalOvers || 0) + (perf.overs || 0);
        const newTotalWickets = (existingStats.totalWickets || 0) + (perf.wickets || 0);
        const newTotalRunsConceded = (existingStats.totalRunsConceded || 0) + (perf.runs || 0);

        await db.update(playerCareerStats)
          .set({
            bowlingMatches: (existingStats.bowlingMatches || 0) + 1,
            bowlingInnings: (existingStats.bowlingInnings || 0) + 1,
            totalOvers: newTotalOvers,
            totalMaidens: (existingStats.totalMaidens || 0) + (perf.maidens || 0),
            totalRunsConceded: newTotalRunsConceded,
            totalWickets: newTotalWickets,
            bowlingAverage: newTotalWickets > 0 ? newTotalRunsConceded / newTotalWickets : 0,
            bowlingEconomy: newTotalOvers > 0 ? newTotalRunsConceded / newTotalOvers : 0,
            threeWickets: (existingStats.threeWickets || 0) + ((perf.wickets || 0) >= 3 && (perf.wickets || 0) < 5 ? 1 : 0),
            fiveWickets: (existingStats.fiveWickets || 0) + ((perf.wickets || 0) >= 5 ? 1 : 0),
            lastUpdated: new Date().toISOString(),
          })
          .where(eq(playerCareerStats.id, existingStats.id));
      } else {
        await db.insert(playerCareerStats).values({
          playerId: perf.playerId,
          playerName: perf.playerName,
          teamId: perf.teamId,
          tournamentId: match.tournamentId,
          bowlingMatches: 1,
          bowlingInnings: 1,
          totalOvers: perf.overs || 0,
          totalMaidens: perf.maidens || 0,
          totalRunsConceded: perf.runs || 0,
          totalWickets: perf.wickets || 0,
          bowlingAverage: (perf.wickets || 0) > 0 ? (perf.runs || 0) / (perf.wickets || 0) : 0,
          bowlingEconomy: (perf.overs || 0) > 0 ? (perf.runs || 0) / (perf.overs || 0) : 0,
          threeWickets: (perf.wickets || 0) >= 3 && (perf.wickets || 0) < 5 ? 1 : 0,
          fiveWickets: (perf.wickets || 0) >= 5 ? 1 : 0,
          lastUpdated: new Date().toISOString(),
        });
      }
    }
  } catch (error) {
    console.error('Error updating career stats:', error);
  }
}
