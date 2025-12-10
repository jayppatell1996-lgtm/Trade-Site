'use client';

import { useState, useEffect, useCallback } from 'react';

interface Team {
  id: number;
  name: string;
  ownerId: string;
  maxSize: number;
  purse: number;
}

interface Player {
  id: number;
  playerId: string;
  name: string;
  teamId: number;
  category: string | null;
  boughtFor: number | null;
}

export default function FranchisesPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/teams');
      const data = await res.json();
      if (res.ok) {
        setTeams(data.teams || []);
        setPlayers(data.players || []);
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch and polling for updates
  useEffect(() => {
    fetchData();
    // Poll every 5 seconds to get auction updates
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Filter teams and players based on search
  const filteredTeams = teams.filter(team => {
    const teamPlayers = players.filter(p => p.teamId === team.id);
    const teamNameMatch = team.name.toLowerCase().includes(searchQuery.toLowerCase());
    const playerMatch = teamPlayers.some(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.playerId.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return teamNameMatch || playerMatch || searchQuery === '';
  });

  // Highlight matching text
  const highlightMatch = (text: string) => {
    if (!searchQuery) return text;
    const regex = new RegExp(`(${searchQuery})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) => 
      regex.test(part) ? <span key={i} className="bg-accent/30 text-accent">{part}</span> : part
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-accent mx-auto mb-4" />
          <p className="text-gray-400">Loading franchises...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">League Franchises</h1>
          <p className="text-gray-400">View active rosters and contracts.</p>
        </div>
        <div className="relative w-full md:w-auto">
          <input
            type="text"
            placeholder="Search teams or players..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10 w-full md:w-64"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Search Results Info */}
      {searchQuery && (
        <div className="text-sm text-gray-400">
          Found {filteredTeams.length} team{filteredTeams.length !== 1 ? 's' : ''} matching "{searchQuery}"
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTeams.map((team) => {
          const teamPlayers = players.filter(p => p.teamId === team.id);
          // Filter players if searching
          const displayPlayers = searchQuery 
            ? teamPlayers.filter(p => 
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.playerId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                team.name.toLowerCase().includes(searchQuery.toLowerCase())
              )
            : teamPlayers;
          
          return (
            <div key={team.id} className="card">
              {/* Team Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                    <span className="text-accent font-bold text-sm">{team.name}</span>
                  </div>
                  <div>
                    <h2 className="font-bold">{highlightMatch(team.name)}</h2>
                    <p className="text-xs text-gray-500">ID: {team.ownerId}</p>
                  </div>
                </div>
                <div className="bg-accent text-black text-xs font-bold px-2 py-1 rounded">
                  {teamPlayers.length}/{team.maxSize}
                </div>
              </div>

              {/* Purse Display */}
              <div className="bg-surface-light rounded-lg p-3 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Remaining Purse</span>
                  <span className="text-lg font-bold text-accent font-mono">
                    ${(team.purse / 1000000).toFixed(2)}M
                  </span>
                </div>
              </div>

              {/* Players List */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {(searchQuery ? displayPlayers : teamPlayers).map((player, index) => (
                  <div 
                    key={player.id} 
                    className="flex items-center justify-between p-2 bg-surface-light rounded-lg hover:bg-surface transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500 text-sm w-4">{index + 1}</span>
                      <span className="font-medium">{highlightMatch(player.name)}</span>
                    </div>
                    <span className="text-xs text-gray-500 font-mono bg-surface px-2 py-1 rounded">
                      {highlightMatch(player.playerId)}
                    </span>
                  </div>
                ))}
                {teamPlayers.length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-4">No players yet</p>
                )}
                {searchQuery && displayPlayers.length === 0 && teamPlayers.length > 0 && (
                  <p className="text-gray-500 text-sm text-center py-4">
                    No matching players (team has {teamPlayers.length} players)
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {teams.length === 0 && (
        <div className="card text-center py-12">
          <div className="text-6xl mb-4">🏟️</div>
          <h2 className="text-xl font-semibold mb-2">No Franchises Yet</h2>
          <p className="text-gray-400">Teams will appear here once created by admins.</p>
        </div>
      )}

      {filteredTeams.length === 0 && teams.length > 0 && (
        <div className="card text-center py-12">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-xl font-semibold mb-2">No Results Found</h2>
          <p className="text-gray-400">No teams or players match "{searchQuery}"</p>
          <button 
            onClick={() => setSearchQuery('')}
            className="btn-secondary mt-4"
          >
            Clear Search
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-sm text-gray-500 pt-8">
        Built for Wispbyte Server. Powered by Discord.
      </div>
    </div>
  );
}
