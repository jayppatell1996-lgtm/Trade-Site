'use client';

import { useState, useEffect } from 'react';
import { formatCurrency } from '@/lib/auction';

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
}

interface Trade {
  id: number;
  timestamp: string;
  team1Name: string;
  team2Name: string;
  players1: string;
  players2: string;
}

export default function TradesPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [discordId, setDiscordId] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userTeam, setUserTeam] = useState<Team | null>(null);
  
  // Trade form state
  const [selectedPartnerTeam, setSelectedPartnerTeam] = useState<Team | null>(null);
  const [selectedOwnPlayers, setSelectedOwnPlayers] = useState<Player[]>([]);
  const [selectedPartnerPlayers, setSelectedPartnerPlayers] = useState<Player[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const savedId = localStorage.getItem('discordId');
    if (savedId) {
      setDiscordId(savedId);
      setIsLoggedIn(true);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const teamsRes = await fetch('/api/teams');
        const teamsData = await teamsRes.json();
        setTeams(teamsData);

        // Find user's team
        if (discordId) {
          const team = teamsData.find((t: Team) => t.ownerId === discordId);
          setUserTeam(team || null);
        }

        // TODO: Fetch trade history when API is implemented
        setTrades([]);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [discordId]);

  const handleLogin = () => {
    if (discordId.trim()) {
      localStorage.setItem('discordId', discordId);
      setIsLoggedIn(true);
    }
  };

  const toggleOwnPlayer = (player: Player) => {
    if (selectedOwnPlayers.find(p => p.id === player.id)) {
      setSelectedOwnPlayers(selectedOwnPlayers.filter(p => p.id !== player.id));
    } else if (selectedOwnPlayers.length < 5) {
      setSelectedOwnPlayers([...selectedOwnPlayers, player]);
    }
  };

  const togglePartnerPlayer = (player: Player) => {
    if (selectedPartnerPlayers.find(p => p.id === player.id)) {
      setSelectedPartnerPlayers(selectedPartnerPlayers.filter(p => p.id !== player.id));
    } else if (selectedPartnerPlayers.length < 5) {
      setSelectedPartnerPlayers([...selectedPartnerPlayers, player]);
    }
  };

  const validateTrade = (): string | null => {
    if (!userTeam || !selectedPartnerTeam) {
      return 'Please select a team to trade with';
    }
    if (selectedOwnPlayers.length === 0 || selectedPartnerPlayers.length === 0) {
      return 'Both teams must offer at least 1 player';
    }
    if (selectedOwnPlayers.length > 5 || selectedPartnerPlayers.length > 5) {
      return 'Maximum 5 players per side';
    }
    
    // Check roster limits
    const newOwnCount = userTeam.players.length - selectedOwnPlayers.length + selectedPartnerPlayers.length;
    const newPartnerCount = selectedPartnerTeam.players.length - selectedPartnerPlayers.length + selectedOwnPlayers.length;
    
    if (newOwnCount > userTeam.maxSize) {
      return `Trade would exceed your roster limit (${userTeam.maxSize})`;
    }
    if (newPartnerCount > selectedPartnerTeam.maxSize) {
      return `Trade would exceed ${selectedPartnerTeam.name}'s roster limit`;
    }
    
    return null;
  };

  const proposeTrade = async () => {
    const validationError = validateTrade();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    // TODO: Implement trade proposal API
    setSuccess('Trade proposed! The other team owner will need to accept.');
    
    // Reset selection
    setSelectedOwnPlayers([]);
    setSelectedPartnerPlayers([]);
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="bg-gray-800 p-8 rounded-xl max-w-md w-full">
          <h1 className="text-2xl font-bold mb-6 text-center">🔄 Trade Center</h1>
          <p className="text-gray-400 mb-4 text-center">
            Enter your Discord ID to propose trades
          </p>
          <input
            type="text"
            value={discordId}
            onChange={(e) => setDiscordId(e.target.value)}
            placeholder="Your Discord ID"
            className="w-full p-3 bg-gray-700 rounded-lg mb-4 text-white"
          />
          <button
            onClick={handleLogin}
            className="w-full bg-indigo-600 hover:bg-indigo-700 p-3 rounded-lg font-semibold"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">Loading trade center...</div>
      </div>
    );
  }

  if (!userTeam) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="bg-gray-800 p-8 rounded-xl max-w-md w-full text-center">
          <h1 className="text-2xl font-bold mb-4 text-yellow-400">⚠️ No Team Found</h1>
          <p className="text-gray-400">
            You don&apos;t own any team. Only team owners can propose trades.
          </p>
          <p className="text-gray-500 text-sm mt-4">
            Your Discord ID: {discordId}
          </p>
        </div>
      </div>
    );
  }

  const otherTeams = teams.filter(t => t.id !== userTeam.id);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">🔄 Trade Center</h1>
          <p className="text-gray-400">Propose trades with other teams</p>
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-900/50 border border-green-700 text-green-200 p-4 rounded-lg mb-6">
            {success}
          </div>
        )}

        {/* Trade Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Your Team */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{userTeam.name}</h2>
              <span className="text-sm text-gray-400">Your Team</span>
            </div>
            <div className="text-green-400 mb-4">{formatCurrency(userTeam.purse)}</div>
            
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {userTeam.players.map((player) => {
                const isSelected = selectedOwnPlayers.find(p => p.id === player.id);
                return (
                  <button
                    key={player.id}
                    onClick={() => toggleOwnPlayer(player)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      isSelected 
                        ? 'bg-indigo-600 border border-indigo-500' 
                        : 'bg-gray-700/50 hover:bg-gray-700'
                    }`}
                  >
                    <div className="font-semibold">{player.name}</div>
                    {player.purchasePrice && (
                      <div className="text-sm text-gray-400">
                        {formatCurrency(player.purchasePrice)}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {selectedOwnPlayers.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <div className="text-sm text-gray-400 mb-2">
                  Offering ({selectedOwnPlayers.length}/5):
                </div>
                <div className="text-indigo-400">
                  {selectedOwnPlayers.map(p => p.name).join(', ')}
                </div>
              </div>
            )}
          </div>

          {/* Trade Arrow / Button */}
          <div className="flex flex-col items-center justify-center">
            <div className="text-4xl mb-4">⇄</div>
            <button
              onClick={proposeTrade}
              disabled={!selectedPartnerTeam || selectedOwnPlayers.length === 0 || selectedPartnerPlayers.length === 0}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-8 py-3 rounded-lg font-bold"
            >
              Propose Trade
            </button>
            <p className="text-gray-500 text-sm mt-2 text-center">
              Select players from both teams
            </p>
          </div>

          {/* Partner Team */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Trade With</label>
              <select
                value={selectedPartnerTeam?.id || ''}
                onChange={(e) => {
                  const team = teams.find(t => t.id === Number(e.target.value));
                  setSelectedPartnerTeam(team || null);
                  setSelectedPartnerPlayers([]);
                }}
                className="w-full p-3 bg-gray-700 rounded-lg text-white"
              >
                <option value="">Select a team...</option>
                {otherTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedPartnerTeam ? (
              <>
                <div className="text-green-400 mb-4">
                  {formatCurrency(selectedPartnerTeam.purse)}
                </div>
                
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {selectedPartnerTeam.players.map((player) => {
                    const isSelected = selectedPartnerPlayers.find(p => p.id === player.id);
                    return (
                      <button
                        key={player.id}
                        onClick={() => togglePartnerPlayer(player)}
                        className={`w-full text-left p-3 rounded-lg transition-colors ${
                          isSelected 
                            ? 'bg-indigo-600 border border-indigo-500' 
                            : 'bg-gray-700/50 hover:bg-gray-700'
                        }`}
                      >
                        <div className="font-semibold">{player.name}</div>
                        {player.purchasePrice && (
                          <div className="text-sm text-gray-400">
                            {formatCurrency(player.purchasePrice)}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {selectedPartnerPlayers.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <div className="text-sm text-gray-400 mb-2">
                      Receiving ({selectedPartnerPlayers.length}/5):
                    </div>
                    <div className="text-indigo-400">
                      {selectedPartnerPlayers.map(p => p.name).join(', ')}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-gray-500 text-center py-12">
                Select a team to trade with
              </div>
            )}
          </div>
        </div>

        {/* Trade History */}
        <div className="mt-8 bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-4">📜 Trade History</h2>
          {trades.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No trades recorded yet</p>
          ) : (
            <div className="space-y-4">
              {trades.map((trade) => (
                <div key={trade.id} className="bg-gray-700/50 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold">
                      {trade.team1Name} ⇄ {trade.team2Name}
                    </span>
                    <span className="text-sm text-gray-400">
                      {new Date(trade.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Gave:</span>{' '}
                      {JSON.parse(trade.players1).map((p: { name: string }) => p.name).join(', ')}
                    </div>
                    <div>
                      <span className="text-gray-400">Received:</span>{' '}
                      {JSON.parse(trade.players2).map((p: { name: string }) => p.name).join(', ')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
