import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, ADMIN_IDS } from '@/lib/auth';
import { db } from '@/db';
import { tournaments, tournamentGroups, groupTeams, matches, teams } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// Stadium data by country
const GROUNDS_DATA: Record<string, { name: string; city: string }[]> = {
  'West Indies': [
    { name: 'Brian Lara Stadium', city: 'San Fernando' },
    { name: 'Daren Sammy Cricket Ground', city: 'Gros Islet' },
    { name: 'Kensington Oval', city: 'Bridgetown' },
    { name: 'Providence Stadium', city: 'Georgetown' },
    { name: "Queen's Park Oval", city: 'Port of Spain' },
    { name: 'Sabina Park', city: 'Kingston' },
    { name: 'Sir Vivian Richards Stadium', city: "St John's" },
    { name: 'Warner Park', city: 'Basseterre' },
  ],
  'Pakistan': [
    { name: 'Gaddafi Stadium', city: 'Lahore' },
    { name: 'Multan Cricket Stadium', city: 'Multan' },
    { name: 'National Stadium', city: 'Karachi' },
    { name: 'Rawalpindi Cricket Stadium', city: 'Rawalpindi' },
  ],
  'New Zealand': [
    { name: 'Basin Reserve', city: 'Wellington' },
    { name: 'Bay Oval', city: 'Mt Maunganui' },
    { name: 'Eden Park', city: 'Auckland' },
    { name: 'Hagley Oval', city: 'Christchurch' },
    { name: 'McLean Park', city: 'Napier' },
    { name: 'University of Otago Oval', city: 'Otago' },
  ],
  'India': [
    { name: 'ACA Stadium', city: 'Guwahati' },
    { name: 'ACA-VDCA Cricket Stadium', city: 'Visakhapatnam' },
    { name: 'Arun Jaitley Cricket Stadium', city: 'New Delhi' },
    { name: 'BRSABV Ekana Cricket Stadium', city: 'Lucknow' },
    { name: 'Eden Gardens', city: 'Kolkata' },
    { name: 'HPCA Stadium', city: 'Dharamshala' },
    { name: 'MA Chidambaram Stadium', city: 'Chennai' },
    { name: 'Mullanpur Stadium', city: 'Chandigarh' },
    { name: 'Narendra Modi Stadium', city: 'Ahmedabad' },
    { name: 'Rajiv Gandhi International Stadium', city: 'Hyderabad' },
    { name: 'Sawai Mansingh Stadium', city: 'Jaipur' },
    { name: 'Wankhede Stadium', city: 'Mumbai' },
  ],
  'England': [
    { name: 'Edgbaston', city: 'Birmingham' },
    { name: 'Emirates Old Trafford', city: 'Manchester' },
    { name: 'Headingley', city: 'Leeds' },
    { name: 'Kia Oval', city: 'London' },
    { name: "Lord's", city: 'London' },
    { name: 'Utilita Bowl', city: 'Southampton' },
    { name: 'Sophia Gardens', city: 'Cardiff' },
    { name: 'Trent Bridge', city: 'Nottingham' },
    { name: '1st Central County Ground', city: 'Hove' },
    { name: 'Northampton County Ground', city: 'Northampton' },
    { name: 'Taunton County Ground', city: 'Taunton' },
  ],
  'Australia': [
    { name: 'Adelaide Oval', city: 'Adelaide' },
    { name: 'Bellerive Oval', city: 'Hobart' },
    { name: 'The Gabba', city: 'Brisbane' },
    { name: 'Melbourne Cricket Ground', city: 'Melbourne' },
    { name: 'Perth Stadium', city: 'Perth' },
    { name: 'Sydney Cricket Ground', city: 'Sydney' },
    { name: 'Allan Border Field', city: 'Brisbane' },
    { name: 'Cazalys Stadium', city: 'Cairns' },
    { name: 'Coffs Harbour', city: 'Coffs Harbour' },
    { name: 'Docklands Stadium', city: 'Melbourne' },
    { name: 'GMHBA Stadium', city: 'Geelong' },
    { name: 'Great Barrier Reef Arena', city: 'Brisbane' },
    { name: 'Junction Oval', city: 'Melbourne' },
    { name: 'Karen Rolton Oval', city: 'Adelaide' },
  ],
};

const PITCH_TYPES = ['Standard', 'Grassy', 'Dry', 'Grassy/Dry', 'Grassy/Dusty', 'Dusty'];
const PITCH_SURFACES = ['Soft', 'Medium', 'Heavy'];
const CRACKS = ['None', 'Light', 'Heavy'];

// GET - Fetch tournaments and matches
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';
    const tournamentId = searchParams.get('tournamentId');

    if (type === 'countries') {
      return NextResponse.json(Object.keys(GROUNDS_DATA));
    }

    if (type === 'grounds') {
      const country = searchParams.get('country');
      if (country && GROUNDS_DATA[country]) {
        return NextResponse.json(GROUNDS_DATA[country]);
      }
      return NextResponse.json(GROUNDS_DATA);
    }

    if (type === 'conditions') {
      return NextResponse.json({
        pitchTypes: PITCH_TYPES,
        pitchSurfaces: PITCH_SURFACES,
        cracks: CRACKS,
      });
    }

    if (type === 'tournament' && tournamentId) {
      const tournament = await db.select()
        .from(tournaments)
        .where(eq(tournaments.id, parseInt(tournamentId)));

      if (tournament.length === 0) {
        return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
      }

      const groups = await db.select()
        .from(tournamentGroups)
        .where(eq(tournamentGroups.tournamentId, parseInt(tournamentId)));

      const allGroupTeams = await db.select()
        .from(groupTeams)
        .innerJoin(teams, eq(groupTeams.teamId, teams.id));

      const tournamentMatches = await db.select()
        .from(matches)
        .where(eq(matches.tournamentId, parseInt(tournamentId)));

      const allTeams = await db.select().from(teams);

      // Enrich matches with team names
      const enrichedMatches = tournamentMatches.map(match => ({
        ...match,
        team1Name: allTeams.find(t => t.id === match.team1Id)?.name || 'TBD',
        team2Name: allTeams.find(t => t.id === match.team2Id)?.name || 'TBD',
      }));

      // Organize groups with their teams
      const enrichedGroups = groups.map(group => ({
        ...group,
        teams: allGroupTeams
          .filter(gt => gt.group_teams.groupId === group.id)
          .map(gt => ({
            ...gt.group_teams,
            teamName: gt.teams.name,
          }))
          .sort((a, b) => (b.points || 0) - (a.points || 0) || (b.nrr || 0) - (a.nrr || 0)),
      }));

      return NextResponse.json({
        tournament: tournament[0],
        groups: enrichedGroups,
        matches: enrichedMatches,
      });
    }

    // Get all tournaments with basic info
    const allTournaments = await db.select().from(tournaments);
    
    // Get match counts for each tournament
    const enrichedTournaments = await Promise.all(
      allTournaments.map(async (t) => {
        const matchCount = await db.select()
          .from(matches)
          .where(eq(matches.tournamentId, t.id));
        
        const completedCount = matchCount.filter(m => m.status === 'completed').length;
        
        return {
          ...t,
          totalMatches: matchCount.length,
          completedMatches: completedCount,
        };
      })
    );

    return NextResponse.json(enrichedTournaments);
  } catch (error) {
    console.error('Error fetching fixtures:', error);
    return NextResponse.json({ error: 'Failed to fetch fixtures' }, { status: 500 });
  }
}

// POST - Create tournament and generate fixtures
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.discordId || !ADMIN_IDS.includes(session.user.discordId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      name, 
      country, 
      selectedTeamIds, 
      numberOfGroups, 
      roundRobinType,
      matchSchedule // Array of { team1Id, team2Id, venue, city, matchDate, matchTime, pitchType, pitchSurface, cracks }
    } = body;

    if (!name || !country || !selectedTeamIds || selectedTeamIds.length < 2) {
      return NextResponse.json({ error: 'Invalid tournament data' }, { status: 400 });
    }

    // Create tournament
    const newTournament = await db.insert(tournaments).values({
      name,
      country,
      numberOfGroups: numberOfGroups || 1,
      roundRobinType: roundRobinType || 'single',
      status: 'upcoming',
      createdAt: new Date().toISOString(),
    }).returning();

    const tournamentId = newTournament[0].id;

    // Create groups
    const groupNames = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const createdGroups: any[] = [];
    
    for (let i = 0; i < numberOfGroups; i++) {
      const group = await db.insert(tournamentGroups).values({
        tournamentId,
        name: numberOfGroups > 1 ? `Group ${groupNames[i]}` : 'League',
        orderIndex: i,
      }).returning();
      createdGroups.push(group[0]);
    }

    // Distribute teams to groups
    const teamsPerGroup = Math.ceil(selectedTeamIds.length / numberOfGroups);
    for (let i = 0; i < selectedTeamIds.length; i++) {
      const groupIndex = Math.floor(i / teamsPerGroup);
      const group = createdGroups[Math.min(groupIndex, createdGroups.length - 1)];
      
      await db.insert(groupTeams).values({
        groupId: group.id,
        teamId: selectedTeamIds[i],
        played: 0,
        won: 0,
        lost: 0,
        tied: 0,
        nrr: 0,
        points: 0,
      });
    }

    // If matchSchedule provided, create matches from it
    if (matchSchedule && matchSchedule.length > 0) {
      for (let i = 0; i < matchSchedule.length; i++) {
        const match = matchSchedule[i];
        
        // Find which group this match belongs to
        let matchGroupId = null;
        for (const group of createdGroups) {
          const teamsInGroup = await db.select()
            .from(groupTeams)
            .where(eq(groupTeams.groupId, group.id));
          
          const teamIds = teamsInGroup.map(t => t.teamId);
          if (teamIds.includes(match.team1Id) && teamIds.includes(match.team2Id)) {
            matchGroupId = group.id;
            break;
          }
        }

        await db.insert(matches).values({
          tournamentId,
          groupId: matchGroupId,
          matchNumber: i + 1,
          team1Id: match.team1Id,
          team2Id: match.team2Id,
          venue: match.venue,
          city: match.city,
          matchDate: match.matchDate || null,
          matchTime: match.matchTime || null,
          pitchType: match.pitchType || 'Standard',
          pitchSurface: match.pitchSurface || 'Medium',
          cracks: match.cracks || 'None',
          status: 'upcoming',
        });
      }
    } else {
      // Auto-generate round-robin fixtures
      const grounds = GROUNDS_DATA[country] || [];
      let matchNumber = 1;

      for (const group of createdGroups) {
        const teamsInGroup = await db.select()
          .from(groupTeams)
          .where(eq(groupTeams.groupId, group.id));
        
        const teamIds = teamsInGroup.map(t => t.teamId);
        
        // Generate round-robin matches
        const matchPairs: { team1Id: number; team2Id: number }[] = [];
        
        for (let i = 0; i < teamIds.length; i++) {
          for (let j = i + 1; j < teamIds.length; j++) {
            matchPairs.push({ team1Id: teamIds[i]!, team2Id: teamIds[j]! });
            
            // If double round-robin, add reverse fixture
            if (roundRobinType === 'double') {
              matchPairs.push({ team1Id: teamIds[j]!, team2Id: teamIds[i]! });
            }
          }
        }

        // Create matches
        for (const pair of matchPairs) {
          const groundIndex = (matchNumber - 1) % grounds.length;
          const ground = grounds[groundIndex] || { name: 'TBD', city: 'TBD' };
          
          await db.insert(matches).values({
            tournamentId,
            groupId: group.id,
            matchNumber,
            team1Id: pair.team1Id,
            team2Id: pair.team2Id,
            venue: ground.name,
            city: ground.city,
            pitchType: PITCH_TYPES[Math.floor(Math.random() * PITCH_TYPES.length)],
            pitchSurface: PITCH_SURFACES[Math.floor(Math.random() * PITCH_SURFACES.length)],
            cracks: CRACKS[Math.floor(Math.random() * CRACKS.length)],
            status: 'upcoming',
          });
          
          matchNumber++;
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      tournamentId,
      message: 'Tournament created successfully'
    });
  } catch (error) {
    console.error('Error creating tournament:', error);
    return NextResponse.json({ error: 'Failed to create tournament' }, { status: 500 });
  }
}

// PUT - Update match result or tournament
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.discordId || !ADMIN_IDS.includes(session.user.discordId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      matchId, 
      action,
      // For result updates
      team1Score, 
      team2Score, 
      winnerId, 
      result, 
      status,
      // For fixture edits
      venue,
      city,
      matchDate,
      matchTime,
      pitchType,
      pitchSurface,
      cracks,
      // For Discord
      tournamentId,
    } = body;

    // Action: Send fixtures to Discord
    if (action === 'send_to_discord' && tournamentId) {
      const webhookUrl = process.env.DISCORD_FIXTURES_WEBHOOK_URL;
      if (!webhookUrl) {
        return NextResponse.json({ error: 'Discord webhook not configured. Add DISCORD_FIXTURES_WEBHOOK_URL to environment variables.' }, { status: 400 });
      }

      // Get tournament details
      const tournament = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
      if (tournament.length === 0) {
        return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
      }

      // Get all matches
      const tournamentMatches = await db.select().from(matches).where(eq(matches.tournamentId, tournamentId));
      const allTeams = await db.select().from(teams);

      // Build fixture list
      const fixtureLines = tournamentMatches.map(match => {
        const team1 = allTeams.find(t => t.id === match.team1Id)?.name || 'TBD';
        const team2 = allTeams.find(t => t.id === match.team2Id)?.name || 'TBD';
        const statusEmoji = match.status === 'completed' ? '✅' : match.status === 'live' ? '🔴' : '📅';
        
        let line = `${statusEmoji} **Match ${match.matchNumber}:** ${team1} vs ${team2}`;
        line += `\n   📍 ${match.venue}${match.city ? `, ${match.city}` : ''}`;
        
        if (match.matchDate || match.matchTime) {
          line += `\n   🗓️ ${match.matchDate || 'TBD'} ${match.matchTime || ''}`;
        }
        
        if (match.pitchType) {
          line += `\n   🏟️ ${match.pitchType} | ${match.pitchSurface || 'Medium'} | Cracks: ${match.cracks || 'None'}`;
        }
        
        if (match.status === 'completed' && match.result) {
          line += `\n   🏆 ${match.result}`;
        }
        
        return line;
      });

      // Split into chunks if too long (Discord limit is 4096 for embed description)
      const chunkSize = 10;
      const chunks = [];
      for (let i = 0; i < fixtureLines.length; i += chunkSize) {
        chunks.push(fixtureLines.slice(i, i + chunkSize));
      }

      // Send embeds
      for (let i = 0; i < chunks.length; i++) {
        const embed = {
          title: i === 0 ? `🏏 ${tournament[0].name} - Fixtures` : `🏏 Fixtures (continued)`,
          description: chunks[i].join('\n\n'),
          color: 0x00d4aa,
          footer: {
            text: `${tournament[0].country} • ${tournament[0].roundRobinType === 'double' ? 'Double' : 'Single'} Round Robin • Page ${i + 1}/${chunks.length}`,
          },
          timestamp: new Date().toISOString(),
        };

        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ embeds: [embed] }),
        });

        // Small delay between messages
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      return NextResponse.json({ success: true, message: `Fixtures sent to Discord (${chunks.length} message(s))` });
    }

    // Action: Edit fixture details
    if (action === 'edit_fixture' && matchId) {
      const updateData: any = {};
      if (venue !== undefined) updateData.venue = venue;
      if (city !== undefined) updateData.city = city;
      if (matchDate !== undefined) updateData.matchDate = matchDate;
      if (matchTime !== undefined) updateData.matchTime = matchTime;
      if (pitchType !== undefined) updateData.pitchType = pitchType;
      if (pitchSurface !== undefined) updateData.pitchSurface = pitchSurface;
      if (cracks !== undefined) updateData.cracks = cracks;

      await db.update(matches).set(updateData).where(eq(matches.id, matchId));

      return NextResponse.json({ success: true, message: 'Fixture updated' });
    }

    // Default action: Update match result
    if (!matchId) {
      return NextResponse.json({ error: 'Match ID required' }, { status: 400 });
    }

    // Update match
    await db.update(matches)
      .set({
        team1Score,
        team2Score,
        winnerId,
        result,
        status: status || 'completed',
      })
      .where(eq(matches.id, matchId));

    // Update group standings if match is completed
    if (status === 'completed' && winnerId) {
      const match = await db.select().from(matches).where(eq(matches.id, matchId));
      if (match.length > 0 && match[0].groupId) {
        const groupId = match[0].groupId;
        const team1Id = match[0].team1Id;
        const team2Id = match[0].team2Id;

        // Update winner stats
        const winnerTeam = await db.select()
          .from(groupTeams)
          .where(and(
            eq(groupTeams.groupId, groupId),
            eq(groupTeams.teamId, winnerId)
          ));
        
        if (winnerTeam.length > 0) {
          await db.update(groupTeams)
            .set({
              played: (winnerTeam[0].played || 0) + 1,
              won: (winnerTeam[0].won || 0) + 1,
              points: (winnerTeam[0].points || 0) + 2,
            })
            .where(eq(groupTeams.id, winnerTeam[0].id));
        }

        // Update loser stats
        const loserId = winnerId === team1Id ? team2Id : team1Id;
        const loserTeam = await db.select()
          .from(groupTeams)
          .where(and(
            eq(groupTeams.groupId, groupId),
            eq(groupTeams.teamId, loserId!)
          ));
        
        if (loserTeam.length > 0) {
          await db.update(groupTeams)
            .set({
              played: (loserTeam[0].played || 0) + 1,
              lost: (loserTeam[0].lost || 0) + 1,
            })
            .where(eq(groupTeams.id, loserTeam[0].id));
        }
      }
    }

    return NextResponse.json({ success: true, message: 'Match updated' });
  } catch (error) {
    console.error('Error updating match:', error);
    return NextResponse.json({ error: 'Failed to update match' }, { status: 500 });
  }
}

// DELETE - Delete tournament
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.discordId || !ADMIN_IDS.includes(session.user.discordId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tournamentId = searchParams.get('tournamentId');

    if (!tournamentId) {
      return NextResponse.json({ error: 'Tournament ID required' }, { status: 400 });
    }

    const id = parseInt(tournamentId);

    // Delete in order: matches -> groupTeams -> groups -> tournament
    await db.delete(matches).where(eq(matches.tournamentId, id));
    
    const groups = await db.select().from(tournamentGroups).where(eq(tournamentGroups.tournamentId, id));
    for (const group of groups) {
      await db.delete(groupTeams).where(eq(groupTeams.groupId, group.id));
    }
    
    await db.delete(tournamentGroups).where(eq(tournamentGroups.tournamentId, id));
    await db.delete(tournaments).where(eq(tournaments.id, id));

    return NextResponse.json({ success: true, message: 'Tournament deleted' });
  } catch (error) {
    console.error('Error deleting tournament:', error);
    return NextResponse.json({ error: 'Failed to delete tournament' }, { status: 500 });
  }
}
