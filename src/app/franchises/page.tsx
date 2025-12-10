'use client';

import { useState, useEffect } from 'react';
import { formatCurrency, formatFullCurrency } from '@/lib/auction';

interface Player {
  id: number;
  playerId: string;
  name: string;
  teamId: number | null;
  purchasePrice: number | null;
}

interface Team {
  id: number;
  name: string;
  ownerId: string;
  purse: number;
  maxSize: number;
  players: Player[];
  playerCount: number;
}

export default function FranchisesPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'purse' | 'roster'>('name');

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const res = await fetch('/api/teams');
        const data = await res.json();
        setTeams(data);
      } catch (error) {
        console.error('Failed to fetch teams:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTeams();
  }, []);

  // Filter and sort teams
  const filteredTeams = teams
    .filter(team => {
      const query = searchQuery.toLowerCase();
      return team.name.toLowerCase().includes(query) ||
             team.players.some(p => p.name.toLowerCase().includes(query));
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'purse':
          return b.purse - a.purse;
        case 'roster':
          return b.playerCount - a.playerCount;
        default:
          return a.name.localeCompare(b.name);
      }
    });

  // Calculate league stats
  const totalPurse = teams.reduce((sum, t) => sum + t.purse, 0);
  const totalPlayers = teams.reduce((sum, t) => sum + t.playerCount, 0);
  const avgPurse = teams.length > 0 ? totalPurse / teams.length : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">Loading franchises...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">🏏 Franchises</h1>
          <p className="text-gray-400">View all teams, rosters, and remaining purse</p>
        </div>

        {/* League Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="text-gray-400 text-sm">Total Teams</div>
            <div className="text-2xl font-bold">{teams.length}</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="text-gray-400 text-sm">Total Players</div>
            <div className="text-2xl font-bold">{totalPlayers}</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="text-gray-400 text-sm">Total Purse</div>
            <div className="text-2xl font-bold text-green-400">{formatCurrency(totalPurse)}</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="text-gray-400 text-sm">Avg Purse</div>
            <div className="text-2xl font-bold text-green-400">{formatCurrency(avgPurse)}</div>
          </div>
        </div>

        {/* Search and Sort */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search teams or players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500"
            />
          </div>
          <div className="flex gap-2">
            <span className="text-gray-400 self-center">Sort by:</span>
            {(['name', 'purse', 'roster'] as const).map((option) => (
              <button
                key={option}
                onClick={() => setSortBy(option)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  sortBy === option
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Teams Grid */}
        {filteredTeams.length === 0 ? (
          <div className="bg-gray-800 rounded-xl p-8 text-center border border-gray-700">
            <h2 className="text-xl text-gray-400">No franchises found</h2>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredTeams.map((team) => (
              <TeamCard key={team.id} team={team} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TeamCard({ team }: { team: Team }) {
  const [expanded, setExpanded] = useState(false);
  const capacityPercent = (team.playerCount / team.maxSize) * 100;
  
  // Determine capacity color
  const capacityColor = capacityPercent >= 90 ? 'bg-red-500' :
                        capacityPercent >= 70 ? 'bg-yellow-500' :
                        'bg-green-500';

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      {/* Team Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h2 className="text-xl font-bold text-white">{team.name}</h2>
            <p className="text-sm text-gray-500">Owner ID: {team.ownerId}</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">Remaining Purse</div>
            <div className="text-2xl font-bold text-green-400">
              {formatFullCurrency(team.purse)}
            </div>
          </div>
        </div>

        {/* Roster Capacity Bar */}
        <div className="mt-3">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-400">Roster</span>
            <span className="text-gray-300">{team.playerCount}/{team.maxSize} players</span>
          </div>
          <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className={`h-full ${capacityColor} transition-all duration-300`}
              style={{ width: `${capacityPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Players List */}
      <div className="p-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between w-full text-left mb-2"
        >
          <span className="text-gray-400 font-semibold">Players</span>
          <span className="text-gray-500">{expanded ? '▼' : '▶'}</span>
        </button>

        {expanded && (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {team.players.length === 0 ? (
              <p className="text-gray-500 italic">No players yet</p>
            ) : (
              team.players.map((player) => (
                <div 
                  key={player.id}
                  className="flex justify-between items-center py-2 px-3 bg-gray-700/50 rounded text-sm"
                >
                  <span className="text-white">{player.name}</span>
                  {player.purchasePrice && player.purchasePrice > 0 && (
                    <span className="text-gray-400">
                      {formatCurrency(player.purchasePrice)}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {!expanded && team.players.length > 0 && (
          <div className="text-gray-400 text-sm">
            {team.players.slice(0, 3).map(p => p.name).join(', ')}
            {team.players.length > 3 && ` +${team.players.length - 3} more`}
          </div>
        )}
      </div>
    </div>
  );
}
