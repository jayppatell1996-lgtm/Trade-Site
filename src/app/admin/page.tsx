'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ADMIN_IDS } from '@/lib/auth';

interface Team {
  id: number;
  name: string;
  ownerId: string;
  ownerName: string | null;
  maxSize: number;
  purse: number;
}

interface Player {
  id: number;
  playerId: string;
  name: string;
  teamId: number;
  category: string | null;
}

interface Round {
  id: number;
  roundNumber: number;
  name: string;
  isActive: boolean;
  isCompleted: boolean;
}

interface AuctionPlayer {
  id: number;
  roundId: number;
  playerId?: string | null;
  name: string;
  category: string;
  basePrice: number;
  status: string;
  soldTo?: string | null;
  soldFor?: number | null;
  soldAt?: string | null;
}

interface AuctionLog {
  id: number;
  roundId: number | null;
  message: string;
  logType: string;
  timestamp: string;
}

interface Tournament {
  id: number;
  name: string;
  country: string;
  numberOfGroups: number;
  roundRobinType: string;
  status: string;
  totalMatches: number;
  completedMatches: number;
}

interface Ground {
  name: string;
  city: string;
}

interface MatchConditions {
  pitchTypes: string[];
  pitchSurfaces: string[];
  cracks: string[];
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'teams' | 'rounds' | 'players' | 'logs' | 'upload' | 'fixtures'>('teams');
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [auctionPlayers, setAuctionPlayers] = useState<AuctionPlayer[]>([]);
  const [auctionLogs, setAuctionLogs] = useState<AuctionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit states
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [newPlayer, setNewPlayer] = useState({ teamId: 0, playerId: '', name: '', category: '' });
  const [newTeam, setNewTeam] = useState({ name: '', ownerId: '', maxSize: 20, purse: 50000000 });
  const [showCreateTeam, setShowCreateTeam] = useState(false);

  // Upload states
  const [uploadType, setUploadType] = useState<'teams' | 'round' | 'unsold'>('teams');
  const [roundNumber, setRoundNumber] = useState(1);
  const [roundName, setRoundName] = useState('');
  const [fileContent, setFileContent] = useState('');

  // Fixtures states
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [grounds, setGrounds] = useState<Ground[]>([]);
  const [matchConditions, setMatchConditions] = useState<MatchConditions | null>(null);
  const [venueProfiles, setVenueProfiles] = useState<Record<string, any>>({});
  const [defaultProfile, setDefaultProfile] = useState<any>(null);
  const [showCreateTournament, setShowCreateTournament] = useState(false);
  const [newTournament, setNewTournament] = useState({
    name: '',
    country: '',
    selectedTeamIds: [] as number[],
    numberOfGroups: 1,
    roundRobinType: 'single' as 'single' | 'double',
  });
  const [generatedMatches, setGeneratedMatches] = useState<any[]>([]);
  const [fixturesLoading, setFixturesLoading] = useState(false);
  
  // Match management states
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | null>(null);
  const [tournamentMatches, setTournamentMatches] = useState<any[]>([]);
  const [editingMatch, setEditingMatch] = useState<any | null>(null);
  const [matchResultForm, setMatchResultForm] = useState({
    team1Score: '',
    team2Score: '',
    winnerId: null as number | null,
    result: '',
  });
  
  // Fixture editing states
  const [editingFixture, setEditingFixture] = useState<any | null>(null);
  const [fixtureEditForm, setFixtureEditForm] = useState({
    venue: '',
    city: '',
    matchDate: '',
    matchTime: '',
    pitchType: '',
    pitchSurface: '',
    cracks: '',
  });
  const [sendingToDiscord, setSendingToDiscord] = useState(false);

  const isAdmin = session?.user?.discordId && ADMIN_IDS.includes(session.user.discordId);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session || !isAdmin) {
      router.push('/');
      return;
    }
    fetchData();
  }, [session, status, isAdmin, router]);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/admin');
      const data = await res.json();
      if (res.ok) {
        setTeams(data.teams);
        setPlayers(data.players);
        setRounds(data.rounds);
        setAuctionPlayers(data.auctionPlayers);
        setAuctionLogs(data.auctionLogs || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fixtures functions
  const fetchFixturesData = async () => {
    setFixturesLoading(true);
    try {
      const [tournamentsRes, countriesRes, conditionsRes] = await Promise.all([
        fetch('/api/fixtures'),
        fetch('/api/fixtures?type=countries'),
        fetch('/api/fixtures?type=conditions'),
      ]);
      
      if (tournamentsRes.ok) {
        const data = await tournamentsRes.json();
        setTournaments(Array.isArray(data) ? data : []);
      }
      if (countriesRes.ok) {
        setCountries(await countriesRes.json());
      }
      if (conditionsRes.ok) {
        setMatchConditions(await conditionsRes.json());
      }
    } catch (error) {
      console.error('Error fetching fixtures data:', error);
    } finally {
      setFixturesLoading(false);
    }
  };

  const fetchGroundsForCountry = async (country: string) => {
    try {
      // Fetch grounds
      const groundsRes = await fetch(`/api/fixtures?type=grounds&country=${encodeURIComponent(country)}`);
      if (groundsRes.ok) {
        setGrounds(await groundsRes.json());
      }
      
      // Fetch venue profiles for realistic pitch conditions
      const profilesRes = await fetch(`/api/fixtures?type=venue_profiles&country=${encodeURIComponent(country)}`);
      if (profilesRes.ok) {
        const data = await profilesRes.json();
        setVenueProfiles(data.venueProfiles || {});
        setDefaultProfile(data.defaultProfile || null);
      }
    } catch (error) {
      console.error('Error fetching grounds:', error);
    }
  };

  // Weighted random selection function
  const weightedRandom = (weights: Record<string, number>): string => {
    const entries = Object.entries(weights);
    const total = entries.reduce((sum, [_, weight]) => sum + weight, 0);
    let random = Math.random() * total;
    
    for (const [option, weight] of entries) {
      random -= weight;
      if (random <= 0) return option;
    }
    
    return entries[0][0]; // Fallback
  };

  // Get pitch conditions for a venue using weighted probabilities
  const getVenueConditions = (venueName: string): { pitchType: string; pitchSurface: string; cracks: string } => {
    const profile = venueProfiles[venueName] || defaultProfile;
    
    if (profile) {
      return {
        pitchType: weightedRandom(profile.pitchType),
        pitchSurface: weightedRandom(profile.surface),
        cracks: weightedRandom(profile.cracks),
      };
    }
    
    // Fallback to simple random if no profile
    const pitchTypes = matchConditions?.pitchTypes || ['Standard', 'Grassy', 'Dry'];
    const pitchSurfaces = matchConditions?.pitchSurfaces || ['Soft', 'Medium', 'Hard'];
    const cracksOptions = matchConditions?.cracks || ['None', 'Light', 'Heavy'];
    
    return {
      pitchType: getRandomElement(pitchTypes),
      pitchSurface: getRandomElement(pitchSurfaces),
      cracks: getRandomElement(cracksOptions),
    };
  };

  // Helper function to get random element from array
  const getRandomElement = <T,>(arr: T[]): T => {
    return arr[Math.floor(Math.random() * arr.length)];
  };

  // Generate round-robin matches preview with realistic venue-based conditions
  const generateMatchesPreview = () => {
    const { selectedTeamIds, numberOfGroups, roundRobinType } = newTournament;
    if (selectedTeamIds.length < 2) return;

    const selectedTeams = teams.filter(t => selectedTeamIds.includes(t.id));
    const teamsPerGroup = Math.ceil(selectedTeams.length / numberOfGroups);
    const groupedTeams: Team[][] = [];
    
    for (let i = 0; i < numberOfGroups; i++) {
      groupedTeams.push(selectedTeams.slice(i * teamsPerGroup, (i + 1) * teamsPerGroup));
    }

    const allMatches: any[] = [];
    let matchNum = 1;

    groupedTeams.forEach((groupTeams, groupIndex) => {
      const groupName = numberOfGroups > 1 ? `Group ${String.fromCharCode(65 + groupIndex)}` : 'League';
      
      for (let i = 0; i < groupTeams.length; i++) {
        for (let j = i + 1; j < groupTeams.length; j++) {
          const groundIndex = (matchNum - 1) % grounds.length;
          const ground = grounds[groundIndex] || { name: 'TBD', city: 'TBD' };
          
          // Get realistic conditions based on venue profile
          const conditions = getVenueConditions(ground.name);
          
          allMatches.push({
            matchNumber: matchNum,
            groupName,
            team1Id: groupTeams[i].id,
            team1Name: groupTeams[i].name,
            team2Id: groupTeams[j].id,
            team2Name: groupTeams[j].name,
            venue: ground.name,
            city: ground.city,
            ...conditions,
          });
          matchNum++;

          if (roundRobinType === 'double') {
            const groundIndex2 = (matchNum - 1) % grounds.length;
            const ground2 = grounds[groundIndex2] || { name: 'TBD', city: 'TBD' };
            
            // Get realistic conditions based on venue profile
            const conditions2 = getVenueConditions(ground2.name);
            
            allMatches.push({
              matchNumber: matchNum,
              groupName,
              team1Id: groupTeams[j].id,
              team1Name: groupTeams[j].name,
              team2Id: groupTeams[i].id,
              team2Name: groupTeams[i].name,
              venue: ground2.name,
              city: ground2.city,
              ...conditions2,
            });
            matchNum++;
          }
        }
      }
    });

    setGeneratedMatches(allMatches);
  };

  const updateMatchCondition = (matchIndex: number, field: string, value: string) => {
    setGeneratedMatches(prev => {
      const updated = [...prev];
      updated[matchIndex] = { ...updated[matchIndex], [field]: value };
      return updated;
    });
  };

  const updateMatchVenue = (matchIndex: number, venue: string, city: string) => {
    setGeneratedMatches(prev => {
      const updated = [...prev];
      updated[matchIndex] = { ...updated[matchIndex], venue, city };
      return updated;
    });
  };

  const createTournament = async () => {
    if (!newTournament.name || !newTournament.country || newTournament.selectedTeamIds.length < 2) {
      setMessage({ type: 'error', text: 'Please fill all required fields and select at least 2 teams' });
      return;
    }

    try {
      const res = await fetch('/api/fixtures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTournament,
          matchSchedule: generatedMatches.map(m => ({
            team1Id: m.team1Id,
            team2Id: m.team2Id,
            venue: m.venue,
            city: m.city,
            pitchType: m.pitchType,
            pitchSurface: m.pitchSurface,
            cracks: m.cracks,
          })),
        }),
      });

      const result = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: 'Tournament created successfully!' });
        setShowCreateTournament(false);
        setNewTournament({
          name: '',
          country: '',
          selectedTeamIds: [],
          numberOfGroups: 1,
          roundRobinType: 'single',
        });
        setGeneratedMatches([]);
        fetchFixturesData();
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to create tournament' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to create tournament' });
    }
  };

  const deleteTournament = async (tournamentId: number, tournamentName: string) => {
    if (!confirm(`Are you sure you want to delete "${tournamentName}"?\n\nThis will remove all matches and standings.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/fixtures?tournamentId=${tournamentId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Tournament deleted successfully' });
        fetchFixturesData();
      } else {
        const result = await res.json();
        setMessage({ type: 'error', text: result.error || 'Failed to delete tournament' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete tournament' });
    }
  };

  // Effect to fetch fixtures data when tab changes
  useEffect(() => {
    if (activeTab === 'fixtures' && tournaments.length === 0) {
      fetchFixturesData();
    }
  }, [activeTab]);

  // Effect to generate preview when teams/groups/type changes
  useEffect(() => {
    if (newTournament.selectedTeamIds.length >= 2 && grounds.length > 0 && (venueProfiles || defaultProfile || matchConditions)) {
      generateMatchesPreview();
    }
  }, [newTournament.selectedTeamIds, newTournament.numberOfGroups, newTournament.roundRobinType, grounds, venueProfiles, defaultProfile]);

  // Regenerate all match conditions with realistic venue-based random values
  const regenerateConditions = () => {
    setGeneratedMatches(prev => prev.map(match => {
      const conditions = getVenueConditions(match.venue);
      return {
        ...match,
        ...conditions,
      };
    }));
  };

  // Update match result
  const updateMatchResult = async (matchId: number, team1Score: string, team2Score: string, winnerId: number | null, result: string) => {
    try {
      const res = await fetch('/api/fixtures', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId,
          team1Score,
          team2Score,
          winnerId,
          result,
          status: 'completed',
        }),
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Match result updated!' });
        setEditingMatch(null);
        setMatchResultForm({ team1Score: '', team2Score: '', winnerId: null, result: '' });
        // Refresh tournament matches
        if (selectedTournamentId) {
          fetchTournamentMatches(selectedTournamentId);
        }
        fetchFixturesData();
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Failed to update match' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update match' });
    }
  };

  // Fetch matches for a specific tournament
  const fetchTournamentMatches = async (tournamentId: number) => {
    try {
      const res = await fetch(`/api/fixtures?type=tournament&tournamentId=${tournamentId}`);
      if (res.ok) {
        const data = await res.json();
        setTournamentMatches(data.matches || []);
        setSelectedTournamentId(tournamentId);
      }
    } catch (error) {
      console.error('Error fetching tournament matches:', error);
    }
  };

  // Open match result editor
  const openMatchEditor = (match: any) => {
    setEditingMatch(match);
    setMatchResultForm({
      team1Score: match.team1Score || '',
      team2Score: match.team2Score || '',
      winnerId: match.winnerId || null,
      result: match.result || '',
    });
  };

  // Open fixture editor
  const openFixtureEditor = (match: any) => {
    setEditingFixture(match);
    setFixtureEditForm({
      venue: match.venue || '',
      city: match.city || '',
      matchDate: match.matchDate || '',
      matchTime: match.matchTime || '',
      pitchType: match.pitchType || 'Standard',
      pitchSurface: match.pitchSurface || 'Medium',
      cracks: match.cracks || 'None',
    });
  };

  // Update fixture details
  const updateFixture = async () => {
    if (!editingFixture) return;

    try {
      const res = await fetch('/api/fixtures', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit_fixture',
          matchId: editingFixture.id,
          ...fixtureEditForm,
        }),
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Fixture updated!' });
        setEditingFixture(null);
        if (selectedTournamentId) {
          fetchTournamentMatches(selectedTournamentId);
        }
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Failed to update fixture' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update fixture' });
    }
  };

  // Send fixtures to Discord
  const sendFixturesToDiscord = async (tournamentId: number) => {
    setSendingToDiscord(true);
    try {
      const res = await fetch('/api/fixtures', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_to_discord',
          tournamentId,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: data.message || 'Fixtures sent to Discord!' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to send to Discord' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to send to Discord' });
    } finally {
      setSendingToDiscord(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      
      if (file.name.endsWith('.json')) {
        setFileContent(content);
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
        setMessage({ type: 'error', text: 'Spreadsheet parsing coming soon. Please use JSON format.' });
      }
    };
    reader.readAsText(file);
  };

  const processUpload = async () => {
    if (!fileContent) {
      setMessage({ type: 'error', text: 'Please select a file first' });
      return;
    }

    try {
      const parsedData = JSON.parse(fileContent);
      let action = '';
      let data: any = {};

      switch (uploadType) {
        case 'teams':
          action = 'import_teams';
          data = parsedData;
          break;
        case 'round':
          action = 'import_auction_round';
          data = {
            roundNumber,
            name: roundName || `Round ${roundNumber}`,
            players: parsedData.players_for_auction || parsedData,
          };
          break;
        case 'unsold':
          action = 'import_unsold';
          data = parsedData.unsold || parsedData;
          break;
      }

      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, data }),
      });

      const result = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: result.message });
        setFileContent('');
        fetchData();
      } else {
        setMessage({ type: 'error', text: result.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Invalid JSON format' });
    }
  };

  const updateTeam = async () => {
    if (!editingTeam) return;

    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_team',
          data: editingTeam,
        }),
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Team updated' });
        setEditingTeam(null);
        fetchData();
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update team' });
    }
  };

  const deleteTeam = async (teamId: number, teamName: string) => {
    if (!confirm(`Are you sure you want to DELETE team "${teamName}"?\n\nThis will permanently remove the team and ALL its players. This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_team',
          data: { teamId },
        }),
      });

      const result = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: result.message });
        fetchData();
      } else {
        setMessage({ type: 'error', text: result.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete team' });
    }
  };

  const createTeam = async () => {
    if (!newTeam.name || !newTeam.ownerId) {
      setMessage({ type: 'error', text: 'Team name and owner ID are required' });
      return;
    }

    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_team',
          data: newTeam,
        }),
      });

      const result = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: result.message });
        setNewTeam({ name: '', ownerId: '', maxSize: 20, purse: 50000000 });
        setShowCreateTeam(false);
        fetchData();
      } else {
        setMessage({ type: 'error', text: result.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to create team' });
    }
  };

  const addPlayer = async () => {
    if (!newPlayer.teamId || !newPlayer.name || !newPlayer.playerId) {
      setMessage({ type: 'error', text: 'Please fill in Team, Player ID, and Name' });
      return;
    }

    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_player',
          data: {
            teamId: newPlayer.teamId,
            playerId: newPlayer.playerId,
            playerName: newPlayer.name,
            category: newPlayer.category,
          },
        }),
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Player added' });
        setNewPlayer({ teamId: 0, playerId: '', name: '', category: '' });
        fetchData();
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to add player' });
    }
  };

  const removePlayer = async (playerId: number) => {
    if (!confirm('Remove this player?')) return;

    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove_player',
          data: { playerId },
        }),
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Player removed' });
        fetchData();
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to remove player' });
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-accent" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="card text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-gray-400">This page is only accessible to league administrators.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Admin Panel</h1>
        <p className="text-gray-400">Manage teams, players, and auction rounds</p>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-4">
        {(['teams', 'rounds', 'players', 'logs', 'fixtures', 'upload'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'bg-accent text-black'
                : 'bg-surface hover:bg-surface-light'
            }`}
          >
            {tab === 'players' ? 'Round Players' : tab}
          </button>
        ))}
      </div>

      {/* Teams Tab */}
      {activeTab === 'teams' && (
        <div className="space-y-6">
          {/* Create Team Button */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowCreateTeam(!showCreateTeam)}
              className="btn-primary"
            >
              {showCreateTeam ? 'Cancel' : '+ Create Team'}
            </button>
          </div>

          {/* Create Team Form */}
          {showCreateTeam && (
            <div className="card bg-surface-light">
              <h3 className="font-semibold mb-4">Create New Team</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <input
                  type="text"
                  placeholder="Team Name *"
                  value={newTeam.name}
                  onChange={e => setNewTeam({ ...newTeam, name: e.target.value })}
                  className="input"
                />
                <input
                  type="text"
                  placeholder="Owner Discord ID *"
                  value={newTeam.ownerId}
                  onChange={e => setNewTeam({ ...newTeam, ownerId: e.target.value })}
                  className="input"
                />
                <input
                  type="number"
                  placeholder="Max Size"
                  value={newTeam.maxSize}
                  onChange={e => setNewTeam({ ...newTeam, maxSize: parseInt(e.target.value) })}
                  className="input"
                />
                <input
                  type="number"
                  placeholder="Purse"
                  value={newTeam.purse}
                  onChange={e => setNewTeam({ ...newTeam, purse: parseFloat(e.target.value) })}
                  className="input"
                />
              </div>
              <button onClick={createTeam} className="btn-primary mt-4">Create Team</button>
            </div>
          )}

          {/* Teams List */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Teams ({teams.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 text-sm text-gray-400">Team</th>
                    <th className="text-left p-3 text-sm text-gray-400">Owner ID</th>
                    <th className="text-left p-3 text-sm text-gray-400">Purse</th>
                    <th className="text-left p-3 text-sm text-gray-400">Max Size</th>
                    <th className="text-left p-3 text-sm text-gray-400">Players</th>
                    <th className="text-left p-3 text-sm text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map(team => {
                    const teamPlayers = players.filter(p => p.teamId === team.id);
                    return (
                      <tr key={team.id} className="border-b border-border/50 hover:bg-surface-light/50">
                        <td className="p-3 font-medium">{team.name}</td>
                        <td className="p-3 font-mono text-sm text-gray-400">{team.ownerId}</td>
                        <td className="p-3 font-mono text-accent">${(team.purse / 1000000).toFixed(2)}M</td>
                        <td className="p-3">{team.maxSize}</td>
                        <td className="p-3">{teamPlayers.length}</td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingTeam(team)}
                              className="text-accent hover:underline text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteTeam(team.id, team.name)}
                              className="text-red-400 hover:underline text-sm"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Edit Team Modal */}
          {editingTeam && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="card max-w-md w-full m-4">
                <h3 className="text-lg font-semibold mb-4">Edit Team: {editingTeam.name}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Team Name</label>
                    <input
                      type="text"
                      value={editingTeam.name}
                      onChange={e => setEditingTeam({ ...editingTeam, name: e.target.value })}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Owner Discord ID</label>
                    <input
                      type="text"
                      value={editingTeam.ownerId}
                      onChange={e => setEditingTeam({ ...editingTeam, ownerId: e.target.value })}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Purse ($)</label>
                    <input
                      type="number"
                      value={editingTeam.purse}
                      onChange={e => setEditingTeam({ ...editingTeam, purse: parseFloat(e.target.value) })}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Max Size</label>
                    <input
                      type="number"
                      value={editingTeam.maxSize}
                      onChange={e => setEditingTeam({ ...editingTeam, maxSize: parseInt(e.target.value) })}
                      className="input w-full"
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={updateTeam} className="btn-primary flex-1">Save</button>
                  <button onClick={() => setEditingTeam(null)} className="btn-secondary flex-1">Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* Players by Team */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Players</h2>
            
            {/* Add Player */}
            <div className="bg-surface-light rounded-lg p-4 mb-4">
              <h3 className="font-medium mb-3">Add Player</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <select
                  value={newPlayer.teamId}
                  onChange={e => setNewPlayer({ ...newPlayer, teamId: parseInt(e.target.value) })}
                  className="select"
                >
                  <option value={0}>Select Team</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Player ID *"
                  value={newPlayer.playerId}
                  onChange={e => setNewPlayer({ ...newPlayer, playerId: e.target.value })}
                  className="input"
                />
                <input
                  type="text"
                  placeholder="Player Name *"
                  value={newPlayer.name}
                  onChange={e => setNewPlayer({ ...newPlayer, name: e.target.value })}
                  className="input"
                />
                <input
                  type="text"
                  placeholder="Category"
                  value={newPlayer.category}
                  onChange={e => setNewPlayer({ ...newPlayer, category: e.target.value })}
                  className="input"
                />
                <button onClick={addPlayer} className="btn-primary">Add</button>
              </div>
            </div>

            {/* Players List */}
            <div className="space-y-4">
              {teams.map(team => {
                const teamPlayers = players.filter(p => p.teamId === team.id);
                return (
                  <div key={team.id} className="bg-surface-light rounded-lg p-4">
                    <h4 className="font-medium mb-2">{team.name} ({teamPlayers.length})</h4>
                    <div className="flex flex-wrap gap-2">
                      {teamPlayers.map(player => (
                        <div key={player.id} className="flex items-center gap-2 bg-surface px-3 py-1 rounded-full text-sm">
                          <span>{player.name}</span>
                          <span className="text-xs text-gray-500 font-mono">({player.playerId})</span>
                          <button
                            onClick={() => removePlayer(player.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {teamPlayers.length === 0 && (
                        <span className="text-gray-500 text-sm">No players</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Rounds Tab */}
      {activeTab === 'rounds' && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Auction Rounds</h2>
          {rounds.length > 0 ? (
            <div className="space-y-4">
              {rounds.map(round => {
                const roundAuctionPlayers = auctionPlayers.filter(p => p.roundId === round.id);
                const pending = roundAuctionPlayers.filter(p => p.status === 'pending').length;
                const sold = roundAuctionPlayers.filter(p => p.status === 'sold').length;
                const unsold = roundAuctionPlayers.filter(p => p.status === 'unsold').length;

                return (
                  <div key={round.id} className="bg-surface-light rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium">Round {round.roundNumber}: {round.name}</h3>
                      <div className="flex items-center gap-2">
                        {round.isActive && (
                          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">Active</span>
                        )}
                        {round.isCompleted && (
                          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">Completed</span>
                        )}
                        <button
                          onClick={async () => {
                            if (confirm(`Reset Round ${round.roundNumber}? All players will be set back to pending.${round.isActive ? '\n\n⚠️ This round is currently ACTIVE. This will stop the auction!' : ''}`)) {
                              try {
                                const res = await fetch('/api/admin', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ action: 'reset_round', roundId: round.id }),
                                });
                                const data = await res.json();
                                if (res.ok) {
                                  setMessage({ type: 'success', text: data.message });
                                  fetchData();
                                } else {
                                  setMessage({ type: 'error', text: data.error });
                                }
                              } catch (error) {
                                setMessage({ type: 'error', text: 'Failed to reset round' });
                              }
                            }
                          }}
                          className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded hover:bg-yellow-500/30"
                        >
                          🔄 Reset
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm(`DELETE Round ${round.roundNumber}: ${round.name}?\n\nThis will permanently delete the round and ALL players in it. This cannot be undone!${round.isActive ? '\n\n⚠️ This round is currently ACTIVE. This will stop the auction!' : ''}`)) {
                              try {
                                const res = await fetch('/api/admin', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ action: 'delete_round', roundId: round.id }),
                                });
                                const data = await res.json();
                                if (res.ok) {
                                  setMessage({ type: 'success', text: data.message });
                                  fetchData();
                                } else {
                                  setMessage({ type: 'error', text: data.error });
                                }
                              } catch (error) {
                                setMessage({ type: 'error', text: 'Failed to delete round' });
                              }
                            }
                          }}
                          className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded hover:bg-red-500/30"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">Total:</span> {roundAuctionPlayers.length}
                      </div>
                      <div>
                        <span className="text-gray-400">Pending:</span> {pending}
                      </div>
                      <div>
                        <span className="text-gray-400">Sold:</span> {sold}
                      </div>
                      <div>
                        <span className="text-gray-400">Unsold:</span> {unsold}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No rounds created. Use the Upload tab to import rounds.</p>
          )}

          {/* Danger Zone - Reset All Auction Data */}
          <div className="mt-8 pt-6 border-t border-red-500/30">
            <h3 className="text-lg font-semibold text-red-400 mb-4">⚠️ Danger Zone</h3>
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="font-medium text-red-400">Reset All Auction Data</h4>
                  <p className="text-sm text-gray-400 mt-1">
                    This will clear ALL auction logs, sold player records, unsold players, and reset all rounds to pending.
                    Team purses will remain unchanged. This action cannot be undone!
                  </p>
                </div>
                <button
                  onClick={async () => {
                    if (confirm('⚠️ DANGER: Reset ALL auction data?\n\nThis will:\n• Clear all auction logs\n• Remove all sold players from rosters\n• Reset all rounds to pending\n• Clear unsold players list\n\nTeam purses will NOT be reset.\n\nThis action CANNOT be undone!')) {
                      if (confirm('Are you ABSOLUTELY sure? Type "yes" mentally and click OK to proceed.')) {
                        try {
                          const res = await fetch('/api/admin', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'reset_auction_data' }),
                          });
                          const data = await res.json();
                          if (res.ok) {
                            setMessage({ type: 'success', text: data.message });
                            fetchData();
                          } else {
                            setMessage({ type: 'error', text: data.error });
                          }
                        } catch (error) {
                          setMessage({ type: 'error', text: 'Failed to reset auction data' });
                        }
                      }
                    }
                  }}
                  className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 whitespace-nowrap"
                >
                  🗑️ Reset All Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Round Players Tab */}
      {activeTab === 'players' && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold">Auction Rounds & Players</h2>
          
          {rounds.length === 0 ? (
            <div className="card text-center py-12">
              <div className="text-4xl mb-4">📋</div>
              <p className="text-gray-400">No auction rounds created yet.</p>
              <p className="text-sm text-gray-500 mt-2">Go to the Upload tab to import rounds.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {rounds
                .sort((a, b) => a.roundNumber - b.roundNumber)
                .map(round => {
                  const roundPlayers = auctionPlayers
                    .filter(p => p.roundId === round.id)
                    .sort((a, b) => {
                      // Sort by status: pending first, then sold, then unsold
                      const statusOrder: Record<string, number> = { pending: 0, current: 1, sold: 2, unsold: 3 };
                      return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
                    });
                  
                  const pending = roundPlayers.filter(p => p.status === 'pending').length;
                  const sold = roundPlayers.filter(p => p.status === 'sold').length;
                  const unsold = roundPlayers.filter(p => p.status === 'unsold').length;
                  const current = roundPlayers.filter(p => p.status === 'current').length;

                  return (
                    <div key={round.id} className="card">
                      {/* Round Header */}
                      <div className="flex justify-between items-center mb-4 pb-4 border-b border-border">
                        <div>
                          <h3 className="text-lg font-bold flex items-center gap-2">
                            Round {round.roundNumber}: {round.name}
                            {round.isActive && (
                              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded animate-pulse">
                                🔴 LIVE
                              </span>
                            )}
                            {round.isCompleted && (
                              <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                                ✅ Completed
                              </span>
                            )}
                          </h3>
                          <div className="flex gap-4 mt-2 text-sm">
                            <span className="text-gray-400">
                              Total: <span className="text-white font-medium">{roundPlayers.length}</span>
                            </span>
                            <span className="text-yellow-400">
                              Pending: <span className="font-medium">{pending}</span>
                            </span>
                            {current > 0 && (
                              <span className="text-orange-400">
                                Current: <span className="font-medium">{current}</span>
                              </span>
                            )}
                            <span className="text-green-400">
                              Sold: <span className="font-medium">{sold}</span>
                            </span>
                            <span className="text-red-400">
                              Unsold: <span className="font-medium">{unsold}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Players Table */}
                      {roundPlayers.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">No players in this round</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-gray-400 border-b border-border">
                                <th className="pb-2 pr-4">#</th>
                                <th className="pb-2 pr-4">Player ID</th>
                                <th className="pb-2 pr-4">Player Name</th>
                                <th className="pb-2 pr-4">Category</th>
                                <th className="pb-2 pr-4">Base Price</th>
                                <th className="pb-2 pr-4">Status</th>
                                <th className="pb-2 pr-4">Sold To</th>
                                <th className="pb-2">Sold For</th>
                              </tr>
                            </thead>
                            <tbody>
                              {roundPlayers.map((player, index) => (
                                <tr 
                                  key={player.id} 
                                  className={`border-b border-border/50 hover:bg-surface-light/50 ${
                                    player.status === 'current' ? 'bg-orange-500/10' : ''
                                  }`}
                                >
                                  <td className="py-2 pr-4 text-gray-500">{index + 1}</td>
                                  <td className="py-2 pr-4 font-mono text-xs text-gray-400">
                                    {player.playerId || '-'}
                                  </td>
                                  <td className="py-2 pr-4 font-medium">
                                    {player.name}
                                    {player.status === 'current' && (
                                      <span className="ml-2 text-xs text-orange-400">⚡ LIVE</span>
                                    )}
                                  </td>
                                  <td className="py-2 pr-4 text-gray-400">{player.category || '-'}</td>
                                  <td className="py-2 pr-4 font-mono text-accent">
                                    ${(player.basePrice / 1000000).toFixed(2)}M
                                  </td>
                                  <td className="py-2 pr-4">
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                      player.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                      player.status === 'current' ? 'bg-orange-500/20 text-orange-400' :
                                      player.status === 'sold' ? 'bg-green-500/20 text-green-400' :
                                      player.status === 'unsold' ? 'bg-red-500/20 text-red-400' :
                                      'bg-gray-500/20 text-gray-400'
                                    }`}>
                                      {player.status.toUpperCase()}
                                    </span>
                                  </td>
                                  <td className="py-2 pr-4">
                                    {player.soldTo ? (
                                      <span className="font-medium text-accent">{player.soldTo}</span>
                                    ) : (
                                      <span className="text-gray-500">-</span>
                                    )}
                                  </td>
                                  <td className="py-2">
                                    {player.soldFor ? (
                                      <span className="font-mono text-green-400">
                                        ${(player.soldFor / 1000000).toFixed(2)}M
                                      </span>
                                    ) : (
                                      <span className="text-gray-500">-</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Round Summary */}
                      {sold > 0 && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-400">Total Amount Raised:</span>
                            <span className="font-mono text-green-400 font-bold">
                              ${(roundPlayers
                                .filter(p => p.soldFor)
                                .reduce((sum, p) => sum + (p.soldFor || 0), 0) / 1000000).toFixed(2)}M
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card bg-gradient-to-br from-green-500/20 to-green-500/5 border border-green-500/30">
              <div className="text-3xl font-bold text-green-400">
                {auctionLogs.filter(l => l.logType === 'sale').length}
              </div>
              <div className="text-sm text-gray-400">Total Sales</div>
            </div>
            <div className="card bg-gradient-to-br from-yellow-500/20 to-yellow-500/5 border border-yellow-500/30">
              <div className="text-3xl font-bold text-yellow-400">
                {auctionLogs.filter(l => l.logType === 'unsold').length}
              </div>
              <div className="text-sm text-gray-400">Unsold</div>
            </div>
            <div className="card bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/30">
              <div className="text-3xl font-bold text-blue-400">
                {auctionLogs.filter(l => l.logType === 'bid').length}
              </div>
              <div className="text-sm text-gray-400">Total Bids</div>
            </div>
            <div className="card bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/30">
              <div className="text-3xl font-bold text-purple-400">
                {auctionLogs.length}
              </div>
              <div className="text-sm text-gray-400">All Events</div>
            </div>
          </div>

          {/* Sales History */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">📜 Auction History</h2>
              <span className="text-sm text-gray-400">{auctionLogs.length} total events</span>
            </div>

            {auctionLogs.length > 0 ? (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {/* Group by showing sales first, then other logs */}
                {auctionLogs
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                  .map((log) => {
                    const round = rounds.find(r => r.id === log.roundId);
                    const roundLabel = round ? `Round ${round.roundNumber}` : '';
                    
                    let bgColor = 'bg-surface-light';
                    let textColor = 'text-gray-300';
                    let icon = '📝';
                    
                    if (log.logType === 'sale') {
                      bgColor = 'bg-green-500/10 border-l-4 border-green-500';
                      textColor = 'text-green-400';
                      icon = '💰';
                    } else if (log.logType === 'unsold') {
                      bgColor = 'bg-yellow-500/10 border-l-4 border-yellow-500';
                      textColor = 'text-yellow-400';
                      icon = '❌';
                    } else if (log.logType === 'bid') {
                      bgColor = 'bg-blue-500/10 border-l-4 border-blue-500';
                      textColor = 'text-blue-400';
                      icon = '🔨';
                    } else if (log.logType === 'start' || log.logType === 'next') {
                      bgColor = 'bg-purple-500/10 border-l-4 border-purple-500';
                      textColor = 'text-purple-400';
                      icon = '▶️';
                    } else if (log.logType === 'pause' || log.logType === 'resume') {
                      bgColor = 'bg-orange-500/10 border-l-4 border-orange-500';
                      textColor = 'text-orange-400';
                      icon = log.logType === 'pause' ? '⏸️' : '▶️';
                    } else if (log.logType === 'stop') {
                      bgColor = 'bg-red-500/10 border-l-4 border-red-500';
                      textColor = 'text-red-400';
                      icon = '🛑';
                    }
                    
                    return (
                      <div key={log.id} className={`p-3 rounded-lg ${bgColor}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-2">
                            <span className="text-lg">{icon}</span>
                            <div>
                              <span className={`${textColor}`}>{log.message}</span>
                              {roundLabel && (
                                <span className="text-xs text-gray-500 ml-2">({roundLabel})</span>
                              )}
                            </div>
                          </div>
                          <span className="text-xs text-gray-500 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No auction activity yet. Start an auction to see logs here.</p>
            )}
          </div>

          {/* Round-by-Round Breakdown */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">📊 Round Breakdown</h2>
            {rounds.length > 0 ? (
              <div className="space-y-4">
                {rounds.map(round => {
                  const roundPlayers = auctionPlayers.filter(p => p.roundId === round.id);
                  const soldPlayers = roundPlayers.filter(p => p.status === 'sold');
                  const unsoldPlayers = roundPlayers.filter(p => p.status === 'unsold');
                  const pendingPlayers = roundPlayers.filter(p => p.status === 'pending');
                  const totalSpent = soldPlayers.reduce((sum, p) => sum + (p.soldFor || 0), 0);
                  
                  return (
                    <div key={round.id} className="bg-surface-light rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium">
                          Round {round.roundNumber}: {round.name}
                          {round.isActive && <span className="ml-2 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">Active</span>}
                          {round.isCompleted && <span className="ml-2 text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">Completed</span>}
                        </h3>
                        <span className="text-accent font-mono font-bold">${(totalSpent / 1000000).toFixed(2)}M spent</span>
                      </div>
                      
                      <div className="grid grid-cols-4 gap-4 text-sm mb-3">
                        <div>
                          <span className="text-gray-400">Total:</span> {roundPlayers.length}
                        </div>
                        <div>
                          <span className="text-green-400">Sold:</span> {soldPlayers.length}
                        </div>
                        <div>
                          <span className="text-yellow-400">Unsold:</span> {unsoldPlayers.length}
                        </div>
                        <div>
                          <span className="text-gray-400">Pending:</span> {pendingPlayers.length}
                        </div>
                      </div>

                      {/* Sold Players List */}
                      {soldPlayers.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <div className="text-xs text-gray-400 mb-2">Sold Players:</div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {soldPlayers.map(player => (
                              <div key={player.id} className="bg-surface rounded px-2 py-1 text-sm flex justify-between">
                                <span>{player.name}</span>
                                <span className="text-green-400 font-mono">
                                  ${((player.soldFor || 0) / 1000000).toFixed(2)}M → {player.soldTo}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No rounds created yet.</p>
            )}
          </div>
        </div>
      )}

      {/* Fixtures Tab */}
      {activeTab === 'fixtures' && (
        <div className="space-y-6">
          {/* Create Tournament Button */}
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Tournament Management</h2>
            <button
              onClick={() => {
                setShowCreateTournament(!showCreateTournament);
                if (!showCreateTournament && countries.length === 0) {
                  fetchFixturesData();
                }
              }}
              className="btn-primary"
            >
              {showCreateTournament ? 'Cancel' : '+ Create Tournament'}
            </button>
          </div>

          {/* Create Tournament Form */}
          {showCreateTournament && (
            <div className="card bg-surface-light space-y-6">
              <h3 className="font-semibold text-lg">Create New Tournament</h3>
              
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Tournament Name *</label>
                  <input
                    type="text"
                    value={newTournament.name}
                    onChange={e => setNewTournament({ ...newTournament, name: e.target.value })}
                    placeholder="e.g., Wispbyte Premier League 2025"
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Country (for Stadiums) *</label>
                  <select
                    value={newTournament.country}
                    onChange={e => {
                      setNewTournament({ ...newTournament, country: e.target.value });
                      fetchGroundsForCountry(e.target.value);
                    }}
                    className="input w-full"
                  >
                    <option value="">Select Country</option>
                    {countries.map(country => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tournament Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Number of Groups</label>
                  <select
                    value={newTournament.numberOfGroups}
                    onChange={e => setNewTournament({ ...newTournament, numberOfGroups: parseInt(e.target.value) })}
                    className="input w-full"
                  >
                    {[1, 2, 3, 4].map(n => (
                      <option key={n} value={n}>{n === 1 ? 'Single League' : `${n} Groups`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Round Robin Type</label>
                  <select
                    value={newTournament.roundRobinType}
                    onChange={e => setNewTournament({ ...newTournament, roundRobinType: e.target.value as 'single' | 'double' })}
                    className="input w-full"
                  >
                    <option value="single">Single Round Robin (Home/Away once)</option>
                    <option value="double">Double Round Robin (Home & Away)</option>
                  </select>
                </div>
              </div>

              {/* Team Selection */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Select Teams * ({newTournament.selectedTeamIds.length} selected)
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-2 bg-surface rounded-lg">
                  {teams.map(team => (
                    <label
                      key={team.id}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                        newTournament.selectedTeamIds.includes(team.id)
                          ? 'bg-accent/20 border border-accent'
                          : 'bg-surface-light hover:bg-surface-light/80'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={newTournament.selectedTeamIds.includes(team.id)}
                        onChange={e => {
                          if (e.target.checked) {
                            setNewTournament({
                              ...newTournament,
                              selectedTeamIds: [...newTournament.selectedTeamIds, team.id],
                            });
                          } else {
                            setNewTournament({
                              ...newTournament,
                              selectedTeamIds: newTournament.selectedTeamIds.filter(id => id !== team.id),
                            });
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm truncate">{team.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Match Preview */}
              {generatedMatches.length > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <label className="block text-sm text-gray-400">
                        Generated Matches ({generatedMatches.length} matches)
                      </label>
                      <span className="text-xs text-accent">
                        ✨ Pitch conditions based on real-world venue characteristics
                      </span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <button
                        onClick={regenerateConditions}
                        className="text-xs bg-surface hover:bg-surface-light px-3 py-1.5 rounded-lg transition-colors"
                      >
                        🎲 Re-roll Realistic Conditions
                      </button>
                      <span className="text-xs text-gray-500">or edit individually below</span>
                    </div>
                  </div>
                  <div className="max-h-96 overflow-y-auto space-y-2 bg-surface rounded-lg p-3">
                    {generatedMatches.map((match, index) => (
                      <div key={index} className="bg-surface-light rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-gray-500">Match {match.matchNumber} • {match.groupName}</span>
                          <div className="flex gap-1">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              match.pitchType.includes('Grassy') ? 'bg-green-500/20 text-green-400' :
                              match.pitchType.includes('Dry') || match.pitchType.includes('Dusty') ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-gray-500/20 text-gray-400'
                            }`}>{match.pitchType}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">{match.pitchSurface}</span>
                            {match.cracks !== 'None' && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">{match.cracks} Cracks</span>
                            )}
                          </div>
                        </div>
                        <div className="font-medium mb-3">
                          {match.team1Name} <span className="text-gray-500">vs</span> {match.team2Name}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
                          <select
                            value={`${match.venue}|${match.city}`}
                            onChange={e => {
                              const [venue, city] = e.target.value.split('|');
                              updateMatchVenue(index, venue, city);
                            }}
                            className="input text-xs py-1"
                          >
                            {grounds.map(g => (
                              <option key={g.name} value={`${g.name}|${g.city}`}>
                                {g.name}, {g.city}
                              </option>
                            ))}
                          </select>
                          <select
                            value={match.pitchType}
                            onChange={e => updateMatchCondition(index, 'pitchType', e.target.value)}
                            className="input text-xs py-1"
                          >
                            {matchConditions?.pitchTypes.map(pt => (
                              <option key={pt} value={pt}>{pt}</option>
                            ))}
                          </select>
                          <select
                            value={match.pitchSurface}
                            onChange={e => updateMatchCondition(index, 'pitchSurface', e.target.value)}
                            className="input text-xs py-1"
                          >
                            {matchConditions?.pitchSurfaces.map(ps => (
                              <option key={ps} value={ps}>{ps}</option>
                            ))}
                          </select>
                          <select
                            value={match.cracks}
                            onChange={e => updateMatchCondition(index, 'cracks', e.target.value)}
                            className="input text-xs py-1"
                          >
                            {matchConditions?.cracks.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={createTournament}
                disabled={!newTournament.name || !newTournament.country || newTournament.selectedTeamIds.length < 2}
                className="btn-primary w-full disabled:opacity-50"
              >
                Create Tournament with {generatedMatches.length} Matches
              </button>
            </div>
          )}

          {/* Tournaments List */}
          <div className="card">
            <h3 className="font-semibold mb-4">Existing Tournaments ({tournaments.length})</h3>
            {fixturesLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-accent" />
              </div>
            ) : tournaments.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No tournaments created yet.</p>
            ) : (
              <div className="space-y-3">
                {tournaments.map(tournament => (
                  <div key={tournament.id} className="bg-surface-light rounded-lg overflow-hidden">
                    <div className="p-4 flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{tournament.name}</h4>
                        <div className="flex flex-wrap gap-2 md:gap-4 text-sm text-gray-400 mt-1">
                          <span>📍 {tournament.country}</span>
                          <span>👥 {tournament.numberOfGroups === 1 ? 'League' : `${tournament.numberOfGroups} Groups`}</span>
                          <span>🔄 {tournament.roundRobinType === 'double' ? 'Double' : 'Single'} RR</span>
                          <span>🏏 {tournament.completedMatches}/{tournament.totalMatches} matches</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          tournament.status === 'ongoing' ? 'bg-green-500/20 text-green-400' :
                          tournament.status === 'completed' ? 'bg-gray-500/20 text-gray-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
                        </span>
                        <button
                          onClick={() => {
                            if (selectedTournamentId === tournament.id) {
                              setSelectedTournamentId(null);
                              setTournamentMatches([]);
                            } else {
                              fetchTournamentMatches(tournament.id);
                            }
                          }}
                          className="text-accent hover:underline text-sm"
                        >
                          {selectedTournamentId === tournament.id ? 'Hide Matches' : 'Manage Matches'}
                        </button>
                        <button
                          onClick={() => sendFixturesToDiscord(tournament.id)}
                          disabled={sendingToDiscord}
                          className="text-purple-400 hover:underline text-sm disabled:opacity-50"
                        >
                          {sendingToDiscord ? '📤 Sending...' : '📤 Send to Discord'}
                        </button>
                        <button
                          onClick={() => window.open(`/fixtures?tournamentId=${tournament.id}`, '_blank')}
                          className="text-blue-400 hover:underline text-sm"
                        >
                          View
                        </button>
                        <button
                          onClick={() => deleteTournament(tournament.id, tournament.name)}
                          className="text-red-400 hover:underline text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    
                    {/* Expanded Match Management */}
                    {selectedTournamentId === tournament.id && (
                      <div className="border-t border-border p-4 bg-surface">
                        <h4 className="font-medium mb-3">Match Results</h4>
                        {tournamentMatches.length === 0 ? (
                          <p className="text-gray-500 text-center py-4">No matches found</p>
                        ) : (
                          <div className="space-y-2 max-h-[500px] overflow-y-auto">
                            {tournamentMatches.map((match: any) => (
                              <div 
                                key={match.id} 
                                className={`p-3 rounded-lg ${
                                  match.status === 'completed' ? 'bg-surface-light/50' : 'bg-surface-light'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mb-1">
                                      <span className="font-medium">Match {match.matchNumber}</span>
                                      <span className={`px-1.5 py-0.5 rounded ${
                                        match.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                        match.status === 'live' ? 'bg-red-500/20 text-red-400' :
                                        'bg-yellow-500/20 text-yellow-400'
                                      }`}>
                                        {match.status}
                                      </span>
                                    </div>
                                    
                                    {/* Teams and Scores */}
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className={`font-medium ${match.winnerId === match.team1Id ? 'text-green-400' : ''}`}>
                                        {match.team1Name}
                                      </span>
                                      {match.team1Score && (
                                        <span className="text-sm text-gray-400">{match.team1Score}</span>
                                      )}
                                      <span className="text-gray-500 mx-1">vs</span>
                                      <span className={`font-medium ${match.winnerId === match.team2Id ? 'text-green-400' : ''}`}>
                                        {match.team2Name}
                                      </span>
                                      {match.team2Score && (
                                        <span className="text-sm text-gray-400">{match.team2Score}</span>
                                      )}
                                    </div>
                                    
                                    {match.result && (
                                      <p className="text-xs text-accent mb-2">{match.result}</p>
                                    )}
                                    
                                    {/* Fixture Details */}
                                    <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                                      <span>📍 {match.venue}{match.city ? `, ${match.city}` : ''}</span>
                                      {match.matchDate && <span>📅 {match.matchDate}</span>}
                                      {match.matchTime && <span>🕐 {match.matchTime}</span>}
                                    </div>
                                    
                                    {/* Pitch Conditions */}
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {match.pitchType && (
                                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                                          match.pitchType.includes('Grassy') ? 'bg-green-500/20 text-green-400' :
                                          match.pitchType.includes('Dry') || match.pitchType.includes('Dusty') ? 'bg-yellow-500/20 text-yellow-400' :
                                          'bg-gray-500/20 text-gray-400'
                                        }`}>{match.pitchType}</span>
                                      )}
                                      {match.pitchSurface && (
                                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">{match.pitchSurface}</span>
                                      )}
                                      {match.cracks && match.cracks !== 'None' && (
                                        <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">{match.cracks} Cracks</span>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {/* Action Buttons */}
                                  <div className="flex flex-col gap-2">
                                    <button
                                      onClick={() => openFixtureEditor(match)}
                                      className="text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-3 py-1.5 rounded transition-colors whitespace-nowrap"
                                    >
                                      ✏️ Edit Fixture
                                    </button>
                                    <button
                                      onClick={() => openMatchEditor(match)}
                                      className="text-xs bg-accent/20 hover:bg-accent/30 text-accent px-3 py-1.5 rounded transition-colors whitespace-nowrap"
                                    >
                                      {match.status === 'completed' ? '📊 Edit Result' : '📊 Add Result'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fixture Editor Modal */}
          {editingFixture && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="card max-w-lg w-full m-4 max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-semibold mb-4">
                  Edit Fixture - Match {editingFixture.matchNumber}
                </h3>
                <div className="mb-4 text-center">
                  <span className="font-medium">{editingFixture.team1Name}</span>
                  <span className="text-gray-500 mx-3">vs</span>
                  <span className="font-medium">{editingFixture.team2Name}</span>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Venue</label>
                      <input
                        type="text"
                        value={fixtureEditForm.venue}
                        onChange={e => setFixtureEditForm({ ...fixtureEditForm, venue: e.target.value })}
                        placeholder="Stadium name"
                        className="input w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">City</label>
                      <input
                        type="text"
                        value={fixtureEditForm.city}
                        onChange={e => setFixtureEditForm({ ...fixtureEditForm, city: e.target.value })}
                        placeholder="City"
                        className="input w-full"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Match Date</label>
                      <input
                        type="date"
                        value={fixtureEditForm.matchDate}
                        onChange={e => setFixtureEditForm({ ...fixtureEditForm, matchDate: e.target.value })}
                        className="input w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Match Time</label>
                      <input
                        type="time"
                        value={fixtureEditForm.matchTime}
                        onChange={e => setFixtureEditForm({ ...fixtureEditForm, matchTime: e.target.value })}
                        className="input w-full"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Pitch Type</label>
                    <select
                      value={fixtureEditForm.pitchType}
                      onChange={e => setFixtureEditForm({ ...fixtureEditForm, pitchType: e.target.value })}
                      className="input w-full"
                    >
                      <option value="Standard">Standard</option>
                      <option value="Grassy">Grassy</option>
                      <option value="Dry">Dry</option>
                      <option value="Grassy/Dry">Grassy/Dry</option>
                      <option value="Grassy/Dusty">Grassy/Dusty</option>
                      <option value="Dusty">Dusty</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Pitch Surface</label>
                      <select
                        value={fixtureEditForm.pitchSurface}
                        onChange={e => setFixtureEditForm({ ...fixtureEditForm, pitchSurface: e.target.value })}
                        className="input w-full"
                      >
                        <option value="Soft">Soft</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Cracks</label>
                      <select
                        value={fixtureEditForm.cracks}
                        onChange={e => setFixtureEditForm({ ...fixtureEditForm, cracks: e.target.value })}
                        className="input w-full"
                      >
                        <option value="None">None</option>
                        <option value="Light">Light</option>
                        <option value="Heavy">Heavy</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setEditingFixture(null)}
                      className="flex-1 bg-surface-light hover:bg-surface py-2 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={updateFixture}
                      className="flex-1 btn-primary"
                    >
                      Save Fixture
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Match Result Editor Modal */}
          {editingMatch && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="card max-w-lg w-full m-4">
                <h3 className="text-lg font-semibold mb-4">
                  Update Match Result - Match {editingMatch.matchNumber}
                </h3>
                <div className="mb-4 text-center">
                  <span className="font-medium text-lg">{editingMatch.team1Name}</span>
                  <span className="text-gray-500 mx-3">vs</span>
                  <span className="font-medium text-lg">{editingMatch.team2Name}</span>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">{editingMatch.team1Name} Score</label>
                      <input
                        type="text"
                        value={matchResultForm.team1Score}
                        onChange={e => setMatchResultForm({ ...matchResultForm, team1Score: e.target.value })}
                        placeholder="e.g., 185/6 (20)"
                        className="input w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">{editingMatch.team2Name} Score</label>
                      <input
                        type="text"
                        value={matchResultForm.team2Score}
                        onChange={e => setMatchResultForm({ ...matchResultForm, team2Score: e.target.value })}
                        placeholder="e.g., 180/8 (20)"
                        className="input w-full"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Winner</label>
                    <select
                      value={matchResultForm.winnerId || ''}
                      onChange={e => setMatchResultForm({ ...matchResultForm, winnerId: e.target.value ? parseInt(e.target.value) : null })}
                      className="input w-full"
                    >
                      <option value="">Select Winner</option>
                      <option value={editingMatch.team1Id}>{editingMatch.team1Name}</option>
                      <option value={editingMatch.team2Id}>{editingMatch.team2Name}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Result Summary</label>
                    <input
                      type="text"
                      value={matchResultForm.result}
                      onChange={e => setMatchResultForm({ ...matchResultForm, result: e.target.value })}
                      placeholder="e.g., Team A won by 5 runs"
                      className="input w-full"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => {
                        setEditingMatch(null);
                        setMatchResultForm({ team1Score: '', team2Score: '', winnerId: null, result: '' });
                      }}
                      className="flex-1 bg-surface-light hover:bg-surface py-2 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => updateMatchResult(
                        editingMatch.id,
                        matchResultForm.team1Score,
                        matchResultForm.team2Score,
                        matchResultForm.winnerId,
                        matchResultForm.result
                      )}
                      disabled={!matchResultForm.winnerId}
                      className="flex-1 btn-primary disabled:opacity-50"
                    >
                      Save Result
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Import Data</h2>
          
          <div className="space-y-6">
            {/* Upload Type Selection */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">What are you uploading?</label>
              <div className="flex gap-3">
                {(['teams', 'round', 'unsold'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setUploadType(type)}
                    className={`px-4 py-2 rounded-lg capitalize ${
                      uploadType === type ? 'bg-accent text-black' : 'bg-surface-light'
                    }`}
                  >
                    {type === 'round' ? 'Auction Round' : type}
                  </button>
                ))}
              </div>
            </div>

            {/* Warning for Teams Upload */}
            {uploadType === 'teams' && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <span className="text-yellow-500 text-xl">⚠️</span>
                  <div>
                    <h4 className="font-medium text-yellow-400">Overwrite Warning</h4>
                    <p className="text-sm text-gray-400 mt-1">
                      Importing teams will <strong>overwrite all existing data</strong> for teams with matching names. 
                      This includes purse, owner ID, max size, and <strong>all players</strong> will be replaced.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Round-specific fields */}
            {uploadType === 'round' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Round Number</label>
                  <input
                    type="number"
                    value={roundNumber}
                    onChange={e => setRoundNumber(parseInt(e.target.value))}
                    className="input w-full"
                    min={1}
                    max={6}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Round Name</label>
                  <input
                    type="text"
                    value={roundName}
                    onChange={e => setRoundName(e.target.value)}
                    placeholder="e.g., Batsmen Round"
                    className="input w-full"
                  />
                </div>
              </div>
            )}

            {/* File Upload */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Upload File (JSON)</label>
              <input
                type="file"
                accept=".json,.xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-400
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-accent file:text-black
                  hover:file:bg-accent-dim
                  cursor-pointer"
              />
            </div>

            {/* File Preview */}
            {fileContent && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">Preview</label>
                <textarea
                  value={fileContent}
                  onChange={e => setFileContent(e.target.value)}
                  className="input w-full h-48 font-mono text-sm"
                />
              </div>
            )}

            {/* Format Examples */}
            <div className="bg-surface-light rounded-lg p-4">
              <h3 className="font-medium mb-2">Expected Format</h3>
              {uploadType === 'teams' && (
                <pre className="text-xs text-gray-400 overflow-x-auto">
{`{
  "teams": {
    "SKR": {
      "owner": "1127099249226690652",
      "max_size": 20,
      "purse": 50000000,
      "players": [
        { "name": "Player 1", "player_id": "abc123" },
        { "name": "Player 2", "player_id": "def456" }
      ]
    }
  }
}`}
                </pre>
              )}
              {uploadType === 'round' && (
                <pre className="text-xs text-gray-400 overflow-x-auto">
{`{
  "players_for_auction": [
    {
      "name": "Player Name",
      "player_id": "xyz789",
      "category": "Batsman",
      "base_price": 500000
    }
  ]
}`}
                </pre>
              )}
              {uploadType === 'unsold' && (
                <pre className="text-xs text-gray-400 overflow-x-auto">
{`{
  "unsold": [
    {
      "name": "Player Name",
      "player_id": "abc123",
      "category": "Bowler",
      "base_price": 100000
    }
  ]
}`}
                </pre>
              )}
            </div>

            <button
              onClick={processUpload}
              disabled={!fileContent}
              className="btn-primary w-full disabled:opacity-50"
            >
              Import Data
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
