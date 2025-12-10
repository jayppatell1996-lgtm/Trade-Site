'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatCurrency, formatFullCurrency, calculateBidIncrement, isAuthorizedAdmin } from '@/lib/auction';

interface Team {
  id: number;
  name: string;
  ownerId: string;
  purse: number;
  maxSize: number;
  playerCount: number;
}

interface Player {
  id: number;
  name: string;
  category: string;
  basePrice: number;
  status: string;
}

interface AuctionState {
  id: number;
  roundId: number | null;
  currentPlayerId: number | null;
  currentBid: number;
  highestBidderId: string | null;
  highestBidderName: string | null;
  highestBidderTeamId: number | null;
  status: string;
  remainingTime: number;
  lastSalePlayer: string | null;
  lastSaleTeam: string | null;
  lastSaleAmount: number | null;
  lastUnsoldPlayer: string | null;
}

interface Round {
  id: number;
  roundNumber: number;
  name: string;
  status: string;
}

interface AuctionData {
  state: AuctionState;
  currentPlayer: Player | null;
  currentRound: Round | null;
  teams: Team[];
  queue: Player[];
  rounds: Round[];
  nextPlayer: Player | null;
  queueCount: number;
}

interface SaleHistory {
  id: number;
  playerName: string;
  teamName: string;
  winningBid: number;
  createdAt: string;
}

interface UnsoldPlayer {
  id: number;
  name: string;
  category: string;
  basePrice: number;
}

interface AuctionSummary {
  totalPlayersSold: number;
  totalAmountSpent: number;
  highestBid: number;
  averageBid: number;
  playersRemaining: number;
  playersUnsold: number;
  highestSale: SaleHistory | null;
}

interface LogsData {
  history: SaleHistory[];
  unsoldPlayers: UnsoldPlayer[];
  summary: AuctionSummary;
}

export default function AuctionPage() {
  const [auctionData, setAuctionData] = useState<AuctionData | null>(null);
  const [logsData, setLogsData] = useState<LogsData | null>(null);
  const [discordId, setDiscordId] = useState<string>('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [userTeam, setUserTeam] = useState<Team | null>(null);
  const [activeTab, setActiveTab] = useState<'auction' | 'history' | 'unsold' | 'summary'>('auction');

  // Fetch auction state
  const fetchAuctionState = useCallback(async () => {
    try {
      const res = await fetch('/api/auction');
      const data = await res.json();
      setAuctionData(data);
      
      // Find user's team
      if (discordId && data.teams) {
        const team = data.teams.find((t: Team) => t.ownerId === discordId);
        setUserTeam(team || null);
      }
    } catch (err) {
      console.error('Failed to fetch auction state:', err);
    }
  }, [discordId]);

  // Fetch logs and history
  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/auction/logs?limit=100');
      const data = await res.json();
      setLogsData(data);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    }
  }, []);

  // Poll for updates every second
  useEffect(() => {
    fetchAuctionState();
    fetchLogs();
    const interval = setInterval(() => {
      fetchAuctionState();
      fetchLogs();
    }, 1000);
    return () => clearInterval(interval);
  }, [fetchAuctionState, fetchLogs]);

  // Load saved Discord ID
  useEffect(() => {
    const savedId = localStorage.getItem('discordId');
    if (savedId) {
      setDiscordId(savedId);
      setIsLoggedIn(true);
    }
  }, []);

  // Perform auction action
  const performAction = async (action: string, additionalData = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch('/api/auction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          discordId,
          teamId: userTeam?.id,
          ...additionalData,
        }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || 'Action failed');
        return false;
      }

      await fetchAuctionState();
      return true;
    } catch (err) {
      setError('Failed to perform action');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Login handler
  const handleLogin = () => {
    if (discordId.trim()) {
      localStorage.setItem('discordId', discordId);
      setIsLoggedIn(true);
    }
  };

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('discordId');
    setDiscordId('');
    setIsLoggedIn(false);
    setUserTeam(null);
  };

  const isAdmin = isAuthorizedAdmin(discordId);
  const state = auctionData?.state;
  const currentPlayer = auctionData?.currentPlayer;
  const currentRound = auctionData?.currentRound;

  // Timer bar component
  const TimerBar = ({ remaining, total = 10 }: { remaining: number; total?: number }) => {
    const percentage = (remaining / total) * 100;
    const color = remaining <= 3 ? 'bg-red-500' : remaining <= 6 ? 'bg-yellow-500' : 'bg-green-500';
    
    return (
      <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
        <div 
          className={`h-full ${color} transition-all duration-1000`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    );
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="bg-gray-800 p-8 rounded-xl max-w-md w-full">
          <h1 className="text-2xl font-bold mb-6 text-center">🎯 Auction Login</h1>
          <p className="text-gray-400 mb-4 text-center">
            Enter your Discord ID to participate in the auction
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
            Enter Auction
          </button>
          <p className="text-gray-500 text-sm mt-4 text-center">
            Find your Discord ID by enabling Developer Mode and right-clicking your profile
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">🎯 Live Auction</h1>
          <div className="flex items-center gap-4">
            {userTeam && (
              <div className="bg-gray-800 px-4 py-2 rounded-lg">
                <span className="text-gray-400">Your Team:</span>{' '}
                <span className="font-bold text-indigo-400">{userTeam.name}</span>
                <span className="text-gray-400 ml-2">|</span>
                <span className="text-green-400 ml-2">{formatFullCurrency(userTeam.purse)}</span>
              </div>
            )}
            {isAdmin && (
              <span className="bg-yellow-600/20 text-yellow-400 px-3 py-1 rounded-full text-sm">
                🔐 Admin
              </span>
            )}
            <button
              onClick={handleLogout}
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm"
            >
              Logout
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 border-b border-gray-700 pb-2">
          {[
            { id: 'auction', label: '🔴 Live Auction', icon: '🔴' },
            { id: 'history', label: '📜 Sales Log', icon: '📜' },
            { id: 'unsold', label: '📦 Unsold', icon: '📦' },
            { id: 'summary', label: '📊 Summary', icon: '📊' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-2 rounded-t-lg transition-colors font-semibold ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {tab.label}
              {tab.id === 'unsold' && logsData?.unsoldPlayers && logsData.unsoldPlayers.length > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {logsData.unsoldPlayers.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'auction' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Current Auction */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status Banner */}
            <div className={`p-4 rounded-xl text-center font-bold text-xl ${
              state?.status === 'active' ? 'bg-red-600' :
              state?.status === 'paused' ? 'bg-yellow-600' :
              'bg-gray-700'
            }`}>
              {state?.status === 'active' ? '🔴 LIVE AUCTION' :
               state?.status === 'paused' ? '⏸️ PAUSED' :
               '⏹️ IDLE'}
              {currentRound && <span className="ml-4 text-lg font-normal">| {currentRound.name}</span>}
            </div>

            {/* Current Player Card */}
            {currentPlayer ? (
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="text-center mb-4">
                  <h2 className="text-4xl font-bold text-white mb-2">
                    🏏 {currentPlayer.name}
                  </h2>
                  <span className="bg-indigo-600/30 text-indigo-300 px-4 py-1 rounded-full">
                    {currentPlayer.category}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-700/50 p-4 rounded-lg text-center">
                    <div className="text-gray-400 text-sm">Base Price</div>
                    <div className="text-2xl font-bold text-white">
                      {formatCurrency(currentPlayer.basePrice)}
                    </div>
                  </div>
                  <div className="bg-green-900/30 p-4 rounded-lg text-center border border-green-700">
                    <div className="text-gray-400 text-sm">Current Bid</div>
                    <div className="text-3xl font-bold text-green-400">
                      {formatCurrency(state?.currentBid || currentPlayer.basePrice)}
                    </div>
                  </div>
                </div>

                {/* Highest Bidder */}
                <div className="bg-gray-700/30 p-4 rounded-lg mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">
                      {state?.highestBidderName ? '🏆 Highest Bidder' : '👤 No bids yet'}
                    </span>
                    <span className="text-xl font-bold text-white">
                      {state?.highestBidderName || '-'}
                    </span>
                  </div>
                </div>

                {/* Timer */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-400">⏱️ Time Remaining</span>
                    <span className="text-2xl font-bold">
                      {state?.remainingTime || 0}s
                    </span>
                  </div>
                  <TimerBar remaining={state?.remainingTime || 0} />
                </div>

                {/* Bid Button */}
                {userTeam && state?.status === 'active' && (
                  <button
                    onClick={() => performAction('bid')}
                    disabled={loading || state?.status !== 'active'}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 
                             text-white font-bold py-4 px-6 rounded-xl text-xl
                             transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    💰 Place Bid - {formatCurrency(
                      state?.highestBidderId 
                        ? (state.currentBid || 0) + calculateBidIncrement(currentPlayer.basePrice)
                        : currentPlayer.basePrice
                    )}
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-gray-800 rounded-xl p-12 text-center border border-gray-700">
                <div className="text-6xl mb-4">🎯</div>
                <h2 className="text-2xl font-bold text-gray-400">
                  {state?.status === 'idle' ? 'Waiting for auction to start...' : 'No player currently being auctioned'}
                </h2>
              </div>
            )}

            {/* Last Result */}
            {(state?.lastSalePlayer || state?.lastUnsoldPlayer) && (
              <div className={`p-4 rounded-lg ${
                state?.lastSalePlayer ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'
              }`}>
                {state?.lastSalePlayer ? (
                  <span>
                    🎉 <strong>{state.lastSalePlayer}</strong> sold to <strong>{state.lastSaleTeam}</strong> for{' '}
                    <strong>{formatFullCurrency(state.lastSaleAmount || 0)}</strong>
                  </span>
                ) : (
                  <span>❌ <strong>{state?.lastUnsoldPlayer}</strong> went unsold</span>
                )}
              </div>
            )}

            {/* Admin Controls */}
            {isAdmin && (
              <div className="bg-gray-800 rounded-xl p-6 border border-yellow-700/50">
                <h3 className="text-lg font-bold text-yellow-400 mb-4">🔐 Admin Controls</h3>
                
                {/* Round Selection */}
                <div className="mb-4">
                  <label className="block text-sm text-gray-400 mb-2">Select Round</label>
                  <select
                    value={selectedRound || ''}
                    onChange={(e) => setSelectedRound(Number(e.target.value))}
                    className="w-full bg-gray-700 p-3 rounded-lg text-white"
                  >
                    <option value="">Choose a round...</option>
                    {auctionData?.rounds?.map((round) => (
                      <option key={round.id} value={round.id}>
                        {round.name} ({round.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <button
                    onClick={() => selectedRound && performAction('start', { roundId: selectedRound })}
                    disabled={loading || !selectedRound || state?.status === 'active'}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 p-3 rounded-lg font-semibold"
                  >
                    ▶️ Start
                  </button>
                  <button
                    onClick={() => performAction('next')}
                    disabled={loading || state?.status !== 'active'}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 p-3 rounded-lg font-semibold"
                  >
                    ⏭️ Next
                  </button>
                  <button
                    onClick={() => performAction('sold')}
                    disabled={loading || !state?.highestBidderId}
                    className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 p-3 rounded-lg font-semibold"
                  >
                    🔨 Sold
                  </button>
                  <button
                    onClick={() => performAction('pause')}
                    disabled={loading || state?.status === 'idle'}
                    className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 p-3 rounded-lg font-semibold"
                  >
                    {state?.status === 'paused' ? '▶️ Resume' : '⏸️ Pause'}
                  </button>
                  <button
                    onClick={() => performAction('stop')}
                    disabled={loading || state?.status === 'idle'}
                    className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-500 p-3 rounded-lg font-semibold"
                  >
                    🛑 Stop
                  </button>
                  <button
                    onClick={() => performAction('moveUnsoldToRound')}
                    disabled={loading || !logsData?.unsoldPlayers || logsData.unsoldPlayers.length === 0}
                    className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 p-3 rounded-lg font-semibold"
                  >
                    📦 Re-auction Unsold ({logsData?.unsoldPlayers?.length || 0})
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Info Panels */}
          <div className="space-y-6">
            {/* Queue */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <h3 className="text-lg font-bold mb-3">📋 Queue ({auctionData?.queueCount || 0})</h3>
              {auctionData?.nextPlayer && (
                <div className="bg-gray-700/50 p-3 rounded-lg mb-2">
                  <div className="text-sm text-gray-400">Up Next</div>
                  <div className="font-bold">{auctionData.nextPlayer.name}</div>
                  <div className="text-sm text-gray-400">
                    {auctionData.nextPlayer.category} • {formatCurrency(auctionData.nextPlayer.basePrice)}
                  </div>
                </div>
              )}
              <div className="max-h-48 overflow-y-auto space-y-1">
                {auctionData?.queue?.slice(1, 10).map((player) => (
                  <div key={player.id} className="text-sm text-gray-400 py-1 border-b border-gray-700/50">
                    {player.name} • {formatCurrency(player.basePrice)}
                  </div>
                ))}
              </div>
            </div>

            {/* Live Sales Feed */}
            <div className="bg-gray-800 rounded-xl p-4 border border-green-700/50">
              <h3 className="text-lg font-bold mb-3 text-green-400">🎉 Live Sales</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {logsData?.history?.slice(0, 5).map((sale) => (
                  <div 
                    key={sale.id}
                    className="bg-green-900/20 p-2 rounded-lg border-l-2 border-green-500"
                  >
                    <div className="flex justify-between items-start">
                      <div className="font-semibold text-sm">{sale.playerName}</div>
                      <div className="text-green-400 font-bold text-sm">
                        {formatCurrency(sale.winningBid)}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">→ {sale.teamName}</div>
                  </div>
                ))}
                {(!logsData?.history || logsData.history.length === 0) && (
                  <div className="text-gray-500 text-sm text-center py-4">
                    No sales yet
                  </div>
                )}
              </div>
              {logsData?.unsoldPlayers && logsData.unsoldPlayers.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <div className="text-red-400 text-sm">
                    📦 {logsData.unsoldPlayers.length} unsold player{logsData.unsoldPlayers.length !== 1 ? 's' : ''}
                  </div>
                </div>
              )}
            </div>

            {/* Team Purses */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <h3 className="text-lg font-bold mb-3">💼 Team Purses</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {auctionData?.teams?.map((team) => (
                  <div 
                    key={team.id} 
                    className={`flex justify-between items-center p-2 rounded ${
                      team.ownerId === discordId ? 'bg-indigo-900/30 border border-indigo-700' : 'bg-gray-700/30'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{team.name}</div>
                      <div className="text-xs text-gray-400">{team.playerCount}/{team.maxSize} players</div>
                    </div>
                    <div className="text-green-400 font-bold">
                      {formatCurrency(team.purse)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Rounds Overview */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <h3 className="text-lg font-bold mb-3">📊 Rounds</h3>
              <div className="space-y-2">
                {auctionData?.rounds?.map((round) => (
                  <div 
                    key={round.id}
                    className={`flex justify-between items-center p-2 rounded ${
                      currentRound?.id === round.id ? 'bg-indigo-600/30 border border-indigo-500' : 'bg-gray-700/30'
                    }`}
                  >
                    <span>{round.name}</span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      round.status === 'active' ? 'bg-green-600' :
                      round.status === 'completed' ? 'bg-gray-600' :
                      'bg-gray-700'
                    }`}>
                      {round.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Sales History Tab */}
        {activeTab === 'history' && (
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-2xl font-bold mb-6">📜 Auction Sales Log</h2>
            {logsData?.history && logsData.history.length > 0 ? (
              <div className="space-y-3">
                {logsData.history.map((sale, idx) => (
                  <div 
                    key={sale.id}
                    className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg border-l-4 border-green-500"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-2xl">🎉</span>
                      <div>
                        <div className="font-bold text-lg">{sale.playerName}</div>
                        <div className="text-gray-400 text-sm">
                          {new Date(sale.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-indigo-400">{sale.teamName}</div>
                      <div className="text-green-400 font-bold text-xl">
                        {formatFullCurrency(sale.winningBid)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <span className="text-4xl block mb-4">📜</span>
                No sales recorded yet
              </div>
            )}
          </div>
        )}

        {/* Unsold Players Tab */}
        {activeTab === 'unsold' && (
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-2xl font-bold mb-6">📦 Unsold Players</h2>
            {logsData?.unsoldPlayers && logsData.unsoldPlayers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {logsData.unsoldPlayers.map((player) => (
                  <div 
                    key={player.id}
                    className="p-4 bg-gray-700/50 rounded-lg border border-red-700/50"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-lg">{player.name}</div>
                        <div className="text-gray-400 text-sm">{player.category}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-red-400 font-bold">UNSOLD</div>
                        <div className="text-gray-400 text-sm">
                          Base: {formatCurrency(player.basePrice)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <span className="text-4xl block mb-4">✅</span>
                No unsold players yet
              </div>
            )}
          </div>
        )}

        {/* Summary Tab */}
        {activeTab === 'summary' && (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="text-gray-400 text-sm">Players Sold</div>
                <div className="text-3xl font-bold text-white">
                  {logsData?.summary?.totalPlayersSold || 0}
                </div>
              </div>
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="text-gray-400 text-sm">Total Spent</div>
                <div className="text-3xl font-bold text-green-400">
                  {formatCurrency(logsData?.summary?.totalAmountSpent || 0)}
                </div>
              </div>
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="text-gray-400 text-sm">Highest Bid</div>
                <div className="text-3xl font-bold text-yellow-400">
                  {formatCurrency(logsData?.summary?.highestBid || 0)}
                </div>
              </div>
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="text-gray-400 text-sm">Average Price</div>
                <div className="text-3xl font-bold text-indigo-400">
                  {formatCurrency(logsData?.summary?.averageBid || 0)}
                </div>
              </div>
            </div>

            {/* Highest Sale */}
            {logsData?.summary?.highestSale && (
              <div className="bg-gradient-to-r from-yellow-900/30 to-yellow-700/30 rounded-xl p-6 border border-yellow-600">
                <h3 className="text-lg font-bold text-yellow-400 mb-2">🏆 Highest Sale</h3>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-2xl font-bold">{logsData.summary.highestSale.playerName}</div>
                    <div className="text-gray-400">Bought by {logsData.summary.highestSale.teamName}</div>
                  </div>
                  <div className="text-3xl font-bold text-yellow-400">
                    {formatFullCurrency(logsData.summary.highestSale.winningBid)}
                  </div>
                </div>
              </div>
            )}

            {/* Progress */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="text-gray-400 text-sm mb-2">Players Remaining</div>
                <div className="text-2xl font-bold text-blue-400">
                  {logsData?.summary?.playersRemaining || 0}
                </div>
              </div>
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="text-gray-400 text-sm mb-2">Players Sold</div>
                <div className="text-2xl font-bold text-green-400">
                  {logsData?.summary?.totalPlayersSold || 0}
                </div>
              </div>
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="text-gray-400 text-sm mb-2">Players Unsold</div>
                <div className="text-2xl font-bold text-red-400">
                  {logsData?.summary?.playersUnsold || 0}
                </div>
              </div>
            </div>

            {/* Team Spending Table */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-xl font-bold mb-4">💰 Team Spending</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-gray-700">
                      <th className="pb-3 text-gray-400">Team</th>
                      <th className="pb-3 text-gray-400 text-center">Players Bought</th>
                      <th className="pb-3 text-gray-400 text-right">Total Spent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logsData?.summary?.teamSpending?.map((team: { teamName: string; playersBought: number; totalSpent: number }, idx: number) => (
                      <tr key={idx} className="border-b border-gray-700/50">
                        <td className="py-3 font-semibold">{team.teamName}</td>
                        <td className="py-3 text-center">{team.playersBought}</td>
                        <td className="py-3 text-right text-green-400 font-bold">
                          {formatFullCurrency(team.totalSpent)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
