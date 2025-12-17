'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

interface Player {
  id: number;
  name: string;
  playerId: string;
  teamId: number;
  category: string | null;
}

interface Team {
  id: number;
  name: string;
  ownerId: string;
  ownerName: string | null;
  maxSize: number;
  purse: number;
  players: Player[];
}

interface PendingTrade {
  id: number;
  proposerId: string;
  proposerTeamName: string;
  targetId: string;
  targetTeamName: string;
  proposerPlayers: string;
  targetPlayers: string;
  status: string;
  message: string | null;
  createdAt: string;
}

const ADMIN_IDS = ['256972361918578688', '1111497896018313268'];

export default function TradeCenterPage() {
  const { data: session, status } = useSession();
  const [teams, setTeams] = useState<Team[]>([]);
  const [pendingTrades, setPendingTrades] = useState<PendingTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [team1, setTeam1] = useState<string>('');
  const [team2, setTeam2] = useState<string>('');
  const [selectedPlayers1, setSelectedPlayers1] = useState<string[]>([]);
  const [selectedPlayers2, setSelectedPlayers2] = useState<string[]>([]);
  const [tradeMessage, setTradeMessage] = useState('');
  const [trading, setTrading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [processingTradeId, setProcessingTradeId] = useState<number | null>(null);

  const isAdmin = session?.user?.discordId && ADMIN_IDS.includes(session.user.discordId);

  const fetchTeams = useCallback(async () => {
    try {
      const res = await fetch('/api/teams');
      if (!res.ok) {
        throw new Error('Failed to fetch teams');
      }
      const data = await res.json();
      
      let teamsArray: Team[] = [];
      let playersArray: Player[] = [];
      
      if (!data) {
        setTeams([]);
        return;
      }
      
      if (Array.isArray(data)) {
        teamsArray = data.map(t => ({
          ...t,
          players: Array.isArray(t.players) ? t.players : []
        }));
      } else if (typeof data === 'object') {
        if (Array.isArray(data.teams)) {
          teamsArray = data.teams;
        }
        if (Array.isArray(data.players)) {
          playersArray = data.players;
        }
        
        teamsArray = teamsArray.map(team => ({
          ...team,
          players: Array.isArray(team.players) && team.players.length > 0
            ? team.players
            : playersArray.filter(p => p && p.teamId === team.id)
        }));
      }
      
      setTeams(teamsArray);
    } catch (error) {
      console.error('Error fetching teams:', error);
      setTeams([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPendingTrades = useCallback(async () => {
    if (!session?.user?.discordId) return;
    
    try {
      const res = await fetch('/api/trades?type=pending');
      if (res.ok) {
        const data = await res.json();
        setPendingTrades(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching pending trades:', error);
    }
  }, [session?.user?.discordId]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  useEffect(() => {
    fetchPendingTrades();
  }, [fetchPendingTrades]);

  // Auto-select user's team
  useEffect(() => {
    if (session?.user?.discordId && teams.length > 0) {
      const userTeam = teams.find(t => t.ownerId === session.user.discordId);
      if (userTeam && !team1) {
        setTeam1(userTeam.name);
      }
    }
  }, [session, teams, team1]);

  const userOwnedTeams = Array.isArray(teams) 
    ? teams.filter(t => t && t.ownerId === session?.user?.discordId)
    : [];
  const team1Data = Array.isArray(teams) ? teams.find(t => t && t.name === team1) : undefined;
  const team2Data = Array.isArray(teams) ? teams.find(t => t && t.name === team2) : undefined;

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

  const proposeTrade = async (directTrade: boolean = false) => {
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
          message: tradeMessage,
          directTrade,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.trade) {
          setMessage({ type: 'success', text: 'Trade executed successfully!' });
        } else {
          setMessage({ type: 'success', text: data.message || 'Trade proposal sent!' });
        }
        setSelectedPlayers1([]);
        setSelectedPlayers2([]);
        setTradeMessage('');
        fetchTeams();
        fetchPendingTrades();
      } else {
        setMessage({ type: 'error', text: data.error || 'Trade failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to process trade' });
    } finally {
      setTrading(false);
    }
  };

  const handleTradeAction = async (tradeId: number, action: 'accept' | 'reject' | 'cancel') => {
    setProcessingTradeId(tradeId);
    setMessage(null);

    try {
      const res = await fetch('/api/trades', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradeId, action }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: data.message });
        fetchTeams();
        fetchPendingTrades();
      } else {
        setMessage({ type: 'error', text: data.error || 'Action failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to process action' });
    } finally {
      setProcessingTradeId(null);
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
          <p className="text-gray-400">You don&apos;t own any teams. Only team owners can make trades.</p>
        </div>
      </div>
    );
  }

  const team1Players = Array.isArray(team1Data?.players) ? team1Data.players : [];
  const team2Players = Array.isArray(team2Data?.players) ? team2Data.players : [];

  // Separate incoming and outgoing pending trades
  const incomingTrades = pendingTrades.filter(t => t.targetId === session?.user?.discordId);
  const outgoingTrades = pendingTrades.filter(t => t.proposerId === session?.user?.discordId);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Trade Center</h1>
        <p className="text-gray-400">Propose and manage trades with other teams</p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {/* Pending Trade Proposals */}
      {(incomingTrades.length > 0 || outgoingTrades.length > 0) && (
        <div className="space-y-6">
          {/* Incoming Trades */}
          {incomingTrades.length > 0 && (
            <div className="card border-2 border-yellow-500/30">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <span className="text-2xl">📨</span> Incoming Trade Proposals
                <span className="bg-yellow-500/20 text-yellow-400 text-sm px-2 py-0.5 rounded">
                  {incomingTrades.length}
                </span>
              </h2>
              <div className="space-y-4">
                {incomingTrades.map(trade => {
                  const proposerPlayers = JSON.parse(trade.proposerPlayers);
                  const targetPlayers = JSON.parse(trade.targetPlayers);
                  return (
                    <div key={trade.id} className="bg-surface-light p-4 rounded-lg">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="font-medium">
                            <span className="text-accent">{trade.proposerTeamName}</span> wants to trade with you
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(trade.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center mb-4">
                        <div>
                          <p className="text-sm text-gray-400 mb-1">They offer:</p>
                          <ul className="text-sm">
                            {proposerPlayers.map((p: string) => (
                              <li key={p} className="text-green-400">+ {p}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="text-center text-2xl">↔️</div>
                        <div>
                          <p className="text-sm text-gray-400 mb-1">They want:</p>
                          <ul className="text-sm">
                            {targetPlayers.map((p: string) => (
                              <li key={p} className="text-red-400">- {p}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      {trade.message && (
                        <p className="text-sm text-gray-400 italic mb-4">
                          &quot;{trade.message}&quot;
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleTradeAction(trade.id, 'accept')}
                          disabled={processingTradeId === trade.id}
                          className="flex-1 bg-green-500/20 text-green-400 py-2 px-4 rounded-lg hover:bg-green-500/30 disabled:opacity-50"
                        >
                          {processingTradeId === trade.id ? 'Processing...' : '✅ Accept'}
                        </button>
                        <button
                          onClick={() => handleTradeAction(trade.id, 'reject')}
                          disabled={processingTradeId === trade.id}
                          className="flex-1 bg-red-500/20 text-red-400 py-2 px-4 rounded-lg hover:bg-red-500/30 disabled:opacity-50"
                        >
                          {processingTradeId === trade.id ? 'Processing...' : '❌ Reject'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Outgoing Trades */}
          {outgoingTrades.length > 0 && (
            <div className="card border border-blue-500/30">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <span className="text-2xl">📤</span> Your Pending Proposals
                <span className="bg-blue-500/20 text-blue-400 text-sm px-2 py-0.5 rounded">
                  {outgoingTrades.length}
                </span>
              </h2>
              <div className="space-y-4">
                {outgoingTrades.map(trade => {
                  const proposerPlayers = JSON.parse(trade.proposerPlayers);
                  const targetPlayers = JSON.parse(trade.targetPlayers);
                  return (
                    <div key={trade.id} className="bg-surface-light p-4 rounded-lg">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="font-medium">
                            Trade proposal to <span className="text-accent">{trade.targetTeamName}</span>
                          </p>
                          <p className="text-xs text-gray-500">
                            Waiting for response... ({new Date(trade.createdAt).toLocaleString()})
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center mb-4">
                        <div>
                          <p className="text-sm text-gray-400 mb-1">You send:</p>
                          <ul className="text-sm">
                            {proposerPlayers.map((p: string) => (
                              <li key={p} className="text-red-400">- {p}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="text-center text-2xl">↔️</div>
                        <div>
                          <p className="text-sm text-gray-400 mb-1">You receive:</p>
                          <ul className="text-sm">
                            {targetPlayers.map((p: string) => (
                              <li key={p} className="text-green-400">+ {p}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <button
                        onClick={() => handleTradeAction(trade.id, 'cancel')}
                        disabled={processingTradeId === trade.id}
                        className="w-full bg-gray-500/20 text-gray-400 py-2 px-4 rounded-lg hover:bg-gray-500/30 disabled:opacity-50"
                      >
                        {processingTradeId === trade.id ? 'Processing...' : '🚫 Cancel Proposal'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create New Trade */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Create Trade Proposal</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Team 1 (User's Team) */}
          <div>
            <h3 className="font-medium mb-2">Your Team</h3>
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
                  {team1Players.map(player => (
                    <button
                      key={player.id}
                      onClick={() => togglePlayer1(player.name)}
                      className={`w-full p-3 rounded-lg text-left transition-colors ${
                        selectedPlayers1.includes(player.name)
                          ? 'bg-red-500/20 border-red-500 border'
                          : 'bg-surface-light hover:bg-surface border border-transparent'
                      }`}
                    >
                      <span>{player.name}</span>
                      <span className="text-xs text-gray-500 ml-2">({player.playerId})</span>
                    </button>
                  ))}
                  {team1Players.length === 0 && (
                    <p className="text-gray-500 text-sm text-center py-4">No players on this team</p>
                  )}
                </div>
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-sm text-gray-400">
                    Sending: <span className="text-red-400">{selectedPlayers1.length}</span> players
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Team 2 (Other Team) */}
          <div>
            <h3 className="font-medium mb-2">Trading With</h3>
            <select 
              value={team2} 
              onChange={(e) => {
                setTeam2(e.target.value);
                setSelectedPlayers2([]);
              }}
              className="select w-full mb-4"
            >
              <option value="">Select Team</option>
              {(Array.isArray(teams) ? teams : []).filter(t => t && t.name !== team1).map(team => (
                <option key={team.id} value={team.name}>{team.name}</option>
              ))}
            </select>

            {team2Data && (
              <>
                <div className="text-sm text-gray-400 mb-2">
                  Purse: <span className="text-accent font-mono">${(team2Data.purse / 1000000).toFixed(2)}M</span>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {team2Players.map(player => (
                    <button
                      key={player.id}
                      onClick={() => togglePlayer2(player.name)}
                      className={`w-full p-3 rounded-lg text-left transition-colors ${
                        selectedPlayers2.includes(player.name)
                          ? 'bg-green-500/20 border-green-500 border'
                          : 'bg-surface-light hover:bg-surface border border-transparent'
                      }`}
                    >
                      <span>{player.name}</span>
                      <span className="text-xs text-gray-500 ml-2">({player.playerId})</span>
                    </button>
                  ))}
                  {team2Players.length === 0 && (
                    <p className="text-gray-500 text-sm text-center py-4">No players on this team</p>
                  )}
                </div>
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-sm text-gray-400">
                    Receiving: <span className="text-green-400">{selectedPlayers2.length}</span> players
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Trade Summary */}
      {(selectedPlayers1.length > 0 || selectedPlayers2.length > 0) && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Trade Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center mb-6">
            <div>
              <h3 className="font-medium text-red-400 mb-2">{team1} sends:</h3>
              <ul className="list-disc list-inside text-sm">
                {selectedPlayers1.map(p => <li key={p}>{p}</li>)}
              </ul>
            </div>
            <div className="text-center text-4xl">↔️</div>
            <div>
              <h3 className="font-medium text-green-400 mb-2">{team2} sends:</h3>
              <ul className="list-disc list-inside text-sm">
                {selectedPlayers2.map(p => <li key={p}>{p}</li>)}
              </ul>
            </div>
          </div>

          {/* Optional message */}
          <div className="mb-6">
            <label className="block text-sm text-gray-400 mb-2">Message (optional)</label>
            <input
              type="text"
              value={tradeMessage}
              onChange={(e) => setTradeMessage(e.target.value)}
              placeholder="Add a message for the other team owner..."
              className="input w-full"
            />
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => proposeTrade(false)}
              disabled={trading || selectedPlayers1.length === 0 || selectedPlayers2.length === 0}
              className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {trading ? 'Processing...' : '📨 Send Trade Proposal'}
            </button>
            
            {isAdmin && (
              <button
                onClick={() => proposeTrade(true)}
                disabled={trading || selectedPlayers1.length === 0 || selectedPlayers2.length === 0}
                className="bg-purple-500/20 text-purple-400 py-2 px-4 rounded-lg hover:bg-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Admin: Execute trade immediately without approval"
              >
                ⚡ Direct Trade (Admin)
              </button>
            )}
          </div>
          
          <p className="text-xs text-gray-500 mt-4 text-center">
            The other team owner will receive a Discord notification and can accept or reject this trade.
          </p>
        </div>
      )}
    </div>
  );
}
