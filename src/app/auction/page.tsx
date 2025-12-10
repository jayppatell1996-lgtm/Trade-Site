'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { ADMIN_IDS } from '@/lib/auth';

interface AuctionState {
  id: number;
  isActive: boolean;
  isPaused: boolean;
  currentRoundId: number | null;
  currentPlayerId: number | null;
  currentBid: number;
  highestBidderId: string | null;
  highestBidderTeam: string | null;
  timerEndTime: number | null;
  remainingTime: number;
  currentPlayer: {
    id: number;
    name: string;
    category: string;
    basePrice: number;
  } | null;
  currentRound: {
    id: number;
    name: string;
    roundNumber: number;
  } | null;
  teams: Array<{
    id: number;
    name: string;
    ownerId: string;
    purse: number;
    maxSize: number;
    playerCount: number;
  }>;
  pendingPlayers: Array<{
    id: number;
    name: string;
    category: string;
    basePrice: number;
  }>;
  recentLogs: Array<{
    id: number;
    message: string;
    logType: string;
    timestamp: string;
  }>;
  lastSale: {
    playerName: string;
    teamName: string;
    amount: number;
  } | null;
}

interface Round {
  id: number;
  roundNumber: number;
  name: string;
  isActive: boolean;
  isCompleted: boolean;
  totalPlayers: number;
  pendingPlayers: number;
  soldPlayers: number;
}

export default function AuctionPage() {
  const { data: session } = useSession();
  const [state, setState] = useState<AuctionState | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [waitingForNext, setWaitingForNext] = useState(false);
  const timerExpiredRef = useRef(false);

  const isAdmin = session?.user?.discordId && ADMIN_IDS.includes(session.user.discordId);
  const userTeam = state?.teams.find(t => t.ownerId === session?.user?.discordId);
  const isTeamOwner = !!userTeam;

  const fetchState = useCallback(async () => {
    try {
      const [stateRes, roundsRes] = await Promise.all([
        fetch('/api/auction/state'),
        fetch('/api/auction/rounds'),
      ]);
      const stateData = await stateRes.json();
      const roundsData = await roundsRes.json();
      setState(stateData);
      setRounds(roundsData);

      // Check if we're waiting for next (auction active but no current player)
      if (stateData.isActive && !stateData.currentPlayerId) {
        setWaitingForNext(true);
      } else {
        setWaitingForNext(false);
      }
    } catch (error) {
      console.error('Error fetching auction state:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle timer expiry - auto-sell to highest bidder
  const handleTimerExpiry = useCallback(async () => {
    if (timerExpiredRef.current) return; // Prevent multiple calls
    timerExpiredRef.current = true;

    try {
      const res = await fetch('/api/auction/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'timer_expired' }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: data.message });
        setWaitingForNext(true);
      }
    } catch (error) {
      console.error('Timer expiry error:', error);
    }

    // Reset after a short delay
    setTimeout(() => {
      timerExpiredRef.current = false;
    }, 2000);
  }, []);

  // Polling for real-time updates
  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 1000);
    return () => clearInterval(interval);
  }, [fetchState]);

  // Watch for timer expiry
  useEffect(() => {
    if (state?.isActive && 
        state?.currentPlayerId && 
        !state?.isPaused && 
        state?.remainingTime <= 0 &&
        !timerExpiredRef.current) {
      handleTimerExpiry();
    }
  }, [state?.remainingTime, state?.isActive, state?.currentPlayerId, state?.isPaused, handleTimerExpiry]);

  const executeAction = async (action: string) => {
    setActionLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/auction/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, roundId: selectedRound }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: data.message });
        if (action === 'next') {
          setWaitingForNext(false);
        }
        fetchState();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Action failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const placeBid = async () => {
    setActionLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/auction/bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: data.message });
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Bid failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const formatMoney = (amount: number) => {
    return `$${(amount / 1000000).toFixed(2)}M`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-accent mx-auto mb-4" />
          <p className="text-gray-400">Loading auction...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Live Auction</h1>
          <p className="text-gray-400">
            {state?.isActive 
              ? `Round: ${state.currentRound?.name || 'Active'}` 
              : 'Waiting to start'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <a href="/auction/summary" className="btn-secondary text-sm">
            📊 Summary
          </a>
          {state?.isActive && (
            <div className={`px-4 py-2 rounded-full font-medium ${
              waitingForNext
                ? 'bg-blue-500/20 text-blue-400'
                : state.isPaused 
                  ? 'bg-yellow-500/20 text-yellow-400' 
                  : 'bg-green-500/20 text-green-400'
            }`}>
              {waitingForNext ? '⏳ WAITING FOR NEXT' : state.isPaused ? '⏸️ PAUSED' : '🔴 LIVE'}
            </div>
          )}
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {/* Active Auction - Waiting for Next */}
      {state?.isActive && waitingForNext && (
        <div className="card text-center py-12">
          {state.lastSale ? (
            <>
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold text-accent mb-2">SOLD!</h2>
              <p className="text-xl mb-4">
                <span className="font-semibold">{state.lastSale.playerName}</span> sold to{' '}
                <span className="font-semibold">{state.lastSale.teamName}</span> for{' '}
                <span className="text-accent font-mono">{formatMoney(state.lastSale.amount)}</span>
              </p>
            </>
          ) : (
            <>
              <div className="text-6xl mb-4">⏳</div>
              <h2 className="text-xl font-semibold mb-2">Ready for Next Player</h2>
            </>
          )}
          
          <p className="text-gray-400 mb-6">
            {state.pendingPlayers.length > 0 
              ? `${state.pendingPlayers.length} players remaining`
              : 'No more players in this round'}
          </p>

          {isAdmin && (
            <div className="flex gap-4 justify-center">
              {state.pendingPlayers.length > 0 ? (
                <button
                  onClick={() => executeAction('next')}
                  disabled={actionLoading}
                  className="btn-primary text-lg px-8 py-3"
                >
                  {actionLoading ? 'Loading...' : `⏭️ Next Player (${state.pendingPlayers[0]?.name})`}
                </button>
              ) : (
                <button
                  onClick={() => executeAction('stop')}
                  disabled={actionLoading}
                  className="btn-secondary text-lg px-8 py-3"
                >
                  ✅ End Round
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Active Auction - Bidding View */}
      {state?.isActive && state.currentPlayer && !waitingForNext ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Current Player Card */}
          <div className="lg:col-span-2">
            <div className="card glow-green">
              <div className="text-center mb-6">
                <div className="text-sm text-gray-400 mb-2">{state.currentPlayer.category}</div>
                <h2 className="text-4xl font-bold text-accent mb-4">{state.currentPlayer.name}</h2>
                <div className="text-sm text-gray-400">Base Price: {formatMoney(state.currentPlayer.basePrice)}</div>
              </div>

              {/* Timer */}
              <div className="mb-6">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-400">Time Remaining</span>
                  <span className={`font-mono text-xl ${
                    state.remainingTime <= 3 ? 'text-red-500 timer-critical' : 
                    state.remainingTime <= 5 ? 'text-yellow-500' : 'text-accent'
                  }`}>
                    {Math.max(0, state.remainingTime)}s
                  </span>
                </div>
                <div className="w-full bg-background rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full transition-all duration-1000 ${
                      state.remainingTime <= 3 ? 'bg-red-500' : 
                      state.remainingTime <= 5 ? 'bg-yellow-500' : 'bg-accent'
                    }`}
                    style={{ width: `${Math.max(0, (state.remainingTime / 10) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Current Bid */}
              <div className="bg-surface-light rounded-xl p-6 mb-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="text-center">
                    <div className="text-sm text-gray-400 mb-1">Current Bid</div>
                    <div className="text-3xl font-bold text-accent font-mono">
                      {formatMoney(state.currentBid || 0)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-400 mb-1">Highest Bidder</div>
                    <div className="text-xl font-semibold">
                      {state.highestBidderTeam || 'No bids yet'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bid Button - Show for ALL team owners (including admins who own teams) */}
              {session && isTeamOwner && (
                <button
                  onClick={placeBid}
                  disabled={actionLoading || state.isPaused}
                  className="btn-primary w-full text-xl py-4 disabled:opacity-50 mb-4"
                >
                  {actionLoading ? 'Placing Bid...' : `💰 Place Bid (${userTeam?.name})`}
                </button>
              )}

              {/* Admin Controls */}
              {isAdmin && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button
                    onClick={() => executeAction('next')}
                    disabled={actionLoading}
                    className="btn-secondary"
                  >
                    ⏭️ Skip
                  </button>
                  <button
                    onClick={() => executeAction('sold')}
                    disabled={actionLoading || !state.highestBidderId}
                    className="btn-primary"
                  >
                    🔨 Sell Now
                  </button>
                  <button
                    onClick={() => executeAction(state.isPaused ? 'resume' : 'pause')}
                    disabled={actionLoading}
                    className="btn-warning"
                  >
                    {state.isPaused ? '▶️ Resume' : '⏸️ Pause'}
                  </button>
                  <button
                    onClick={() => executeAction('stop')}
                    disabled={actionLoading}
                    className="btn-danger"
                  >
                    🛑 Stop
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Team Purses */}
            <div className="card">
              <h3 className="font-semibold mb-4">Team Purses</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {state.teams.map(team => (
                  <div key={team.id} className={`flex justify-between items-center p-2 rounded ${
                    team.ownerId === state.highestBidderId ? 'bg-accent/20' : 'bg-surface-light'
                  }`}>
                    <div>
                      <span className="text-sm">{team.name}</span>
                      <span className="text-xs text-gray-500 ml-2">({team.playerCount}/{team.maxSize})</span>
                    </div>
                    <span className="font-mono text-sm text-accent">{formatMoney(team.purse)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Up Next */}
            <div className="card">
              <h3 className="font-semibold mb-4">Up Next ({state.pendingPlayers.length})</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {state.pendingPlayers.slice(0, 5).map(player => (
                  <div key={player.id} className="p-2 bg-surface-light rounded">
                    <div className="font-medium text-sm">{player.name}</div>
                    <div className="text-xs text-gray-400">
                      {player.category} • {formatMoney(player.basePrice)}
                    </div>
                  </div>
                ))}
                {state.pendingPlayers.length > 5 && (
                  <div className="text-xs text-gray-500 text-center">
                    +{state.pendingPlayers.length - 5} more
                  </div>
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="card">
              <h3 className="font-semibold mb-4">Recent Activity</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {state.recentLogs.map(log => (
                  <div key={log.id} className="text-xs p-2 bg-surface-light rounded">
                    <div className={`${
                      log.logType === 'sale' ? 'text-green-400' :
                      log.logType === 'unsold' ? 'text-red-400' : 'text-gray-400'
                    }`}>
                      {log.message}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : !state?.isActive && (
        /* No Active Auction - Show Round Selection */
        <div className="card">
          <h2 className="text-xl font-semibold mb-6">Select Auction Round</h2>
          
          {rounds.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rounds.map(round => (
                <button
                  key={round.id}
                  onClick={() => setSelectedRound(round.id)}
                  disabled={round.isCompleted}
                  className={`p-4 rounded-xl text-left transition-all ${
                    selectedRound === round.id 
                      ? 'bg-accent/20 border-2 border-accent' 
                      : round.isCompleted
                        ? 'bg-surface-light/50 opacity-50 cursor-not-allowed'
                        : 'bg-surface-light hover:bg-surface border-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">Round {round.roundNumber}</span>
                    {round.isCompleted && (
                      <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                        Completed
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-400 mb-2">{round.name}</div>
                  <div className="text-xs text-gray-500">
                    {round.pendingPlayers}/{round.totalPlayers} remaining • {round.soldPlayers} sold
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No auction rounds created yet. Admins can create rounds in the Admin panel.
            </div>
          )}

          {isAdmin && selectedRound && (
            <button
              onClick={() => executeAction('start')}
              disabled={actionLoading}
              className="btn-primary w-full mt-6"
            >
              {actionLoading ? 'Starting...' : '▶️ Start Auction'}
            </button>
          )}

          {!isAdmin && !session && (
            <p className="text-center text-gray-500 mt-6">
              Sign in with Discord to participate in auctions.
            </p>
          )}
        </div>
      )}

      {/* Your Team Info (for team owners) */}
      {userTeam && (
        <div className="card">
          <h3 className="font-semibold mb-4">Your Team: {userTeam.name}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-accent font-mono">{formatMoney(userTeam.purse)}</div>
              <div className="text-xs text-gray-500">Remaining Purse</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{userTeam.playerCount}/{userTeam.maxSize}</div>
              <div className="text-xs text-gray-500">Roster Size</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
