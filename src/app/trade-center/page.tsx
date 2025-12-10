'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

interface Team {
  id: number;
  name: string;
  ownerId: string;
  ownerName: string | null;
  maxSize: number;
  purse: number;
  players: Player[];
}

interface Player {
  id: number;
  name: string;
  teamId: number;
}

export default function TradeCenterPage() {
  const { data: session, status } = useSession();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [team1, setTeam1] = useState<string>('');
  const [team2, setTeam2] = useState<string>('');
  const [selectedPlayers1, setSelectedPlayers1] = useState<string[]>([]);
  const [selectedPlayers2, setSelectedPlayers2] = useState<string[]>([]);
  const [trading, setTrading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchTeams();
  }, []);

  // Auto-select user's team
  useEffect(() => {
    if (session?.user?.discordId && teams.length > 0) {
      const userTeam = teams.find(t => t.ownerId === session.user.discordId);
      if (userTeam && !team1) {
        setTeam1(userTeam.name);
      }
    }
  }, [session, teams]);

  const fetchTeams = async () => {
    try {
      const res = await fetch('/api/teams');
      const data = await res.json();
      
      // API returns { teams, players } - combine them
      if (data && data.teams && Array.isArray(data.teams)) {
        const playersArray = Array.isArray(data.players) ? data.players : [];
        const teamsWithPlayers = data.teams.map((team: any) => ({
          ...team,
          players: playersArray.filter((p: any) => p.teamId === team.id) || [],
        }));
        setTeams(teamsWithPlayers);
      } else if (Array.isArray(data)) {
        // Fallback for old format
        setTeams(data);
      } else {
        console.error('Unexpected API response format:', data);
        setTeams([]);
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
      setTeams([]);
    } finally {
      setLoading(false);
    }
  };

  const userOwnedTeams = teams.filter(t => t.ownerId === session?.user?.discordId);
  const team1Data = teams.find(t => t.name === team1);
  const team2Data = teams.find(t => t.name === team2);

  const togglePlayer1 = (name: string) => {
    setSelectedPlayers1(prev => 
      prev.includes(name) ? prev.filter(p => p !== name) : [...prev, name]
    );
  };

  const togglePlayer2 = (name: string) => {
    setSelectedPlayers2(prev => 
      prev.includes(name) ? prev.filter(p => p !== name) : [...prev, name]
    );
  };

  const executeTrade = async () => {
    if (!team1 || !team2 || selectedPlayers1.length === 0 || selectedPlayers2.length === 0) {
      setMessage({ type: 'error', text: 'Please select teams and players for both sides' });
      return;
    }

    setTrading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team1Name: team1,
          team2Name: team2,
          players1: selectedPlayers1,
          players2: selectedPlayers2,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: 'Trade executed successfully!' });
        setSelectedPlayers1([]);
        setSelectedPlayers2([]);
        fetchTeams();
      } else {
        setMessage({ type: 'error', text: data.error || 'Trade failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to execute trade' });
    } finally {
      setTrading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-accent mx-auto mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="card text-center max-w-md">
          <div className="text-6xl mb-4">🔐</div>
          <h2 className="text-xl font-semibold mb-2">Sign In Required</h2>
          <p className="text-gray-400 mb-6">You need to sign in with Discord to access the Trade Center.</p>
          <Link href="/login" className="btn-primary">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (userOwnedTeams.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="card text-center max-w-md">
          <div className="text-6xl mb-4">🏟️</div>
          <h2 className="text-xl font-semibold mb-2">No Team Found</h2>
          <p className="text-gray-400">You don't own any teams. Only team owners can make trades.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Trade Center</h1>
        <p className="text-gray-400">Execute trades between your team and others</p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Team 1 (User's Team) */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Your Team</h2>
          <select 
            value={team1} 
            onChange={(e) => {
              setTeam1(e.target.value);
              setSelectedPlayers1([]);
            }}
            className="select w-full mb-4"
          >
            <option value="">Select Team</option>
            {userOwnedTeams.map(team => (
              <option key={team.id} value={team.name}>{team.name}</option>
            ))}
          </select>

          {team1Data && (
            <>
              <div className="text-sm text-gray-400 mb-2">
                Purse: <span className="text-accent font-mono">${(team1Data.purse / 1000000).toFixed(2)}M</span>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {team1Data.players.map(player => (
                  <button
                    key={player.id}
                    onClick={() => togglePlayer1(player.name)}
                    className={`w-full p-3 rounded-lg text-left transition-colors ${
                      selectedPlayers1.includes(player.name)
                        ? 'bg-accent/20 border-accent border'
                        : 'bg-surface-light hover:bg-surface border border-transparent'
                    }`}
                  >
                    {player.name}
                  </button>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-sm text-gray-400">
                  Selected: <span className="text-white">{selectedPlayers1.length}</span> players
                </p>
              </div>
            </>
          )}
        </div>

        {/* Team 2 (Other Team) */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Trading With</h2>
          <select 
            value={team2} 
            onChange={(e) => {
              setTeam2(e.target.value);
              setSelectedPlayers2([]);
            }}
            className="select w-full mb-4"
          >
            <option value="">Select Team</option>
            {teams.filter(t => t.name !== team1).map(team => (
              <option key={team.id} value={team.name}>{team.name}</option>
            ))}
          </select>

          {team2Data && (
            <>
              <div className="text-sm text-gray-400 mb-2">
                Purse: <span className="text-accent font-mono">${(team2Data.purse / 1000000).toFixed(2)}M</span>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {team2Data.players.map(player => (
                  <button
                    key={player.id}
                    onClick={() => togglePlayer2(player.name)}
                    className={`w-full p-3 rounded-lg text-left transition-colors ${
                      selectedPlayers2.includes(player.name)
                        ? 'bg-accent/20 border-accent border'
                        : 'bg-surface-light hover:bg-surface border border-transparent'
                    }`}
                  >
                    {player.name}
                  </button>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-sm text-gray-400">
                  Selected: <span className="text-white">{selectedPlayers2.length}</span> players
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Trade Summary */}
      {(selectedPlayers1.length > 0 || selectedPlayers2.length > 0) && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Trade Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div>
              <h3 className="font-medium text-accent mb-2">{team1} sends:</h3>
              <ul className="list-disc list-inside text-sm">
                {selectedPlayers1.map(p => <li key={p}>{p}</li>)}
              </ul>
            </div>
            <div className="text-center text-4xl">↔</div>
            <div>
              <h3 className="font-medium text-accent mb-2">{team2} sends:</h3>
              <ul className="list-disc list-inside text-sm">
                {selectedPlayers2.map(p => <li key={p}>{p}</li>)}
              </ul>
            </div>
          </div>
          <button
            onClick={executeTrade}
            disabled={trading || selectedPlayers1.length === 0 || selectedPlayers2.length === 0}
            className="btn-primary w-full mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {trading ? 'Processing...' : 'Execute Trade'}
          </button>
        </div>
      )}
    </div>
  );
}
