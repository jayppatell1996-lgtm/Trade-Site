'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
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
  const [bidLoading, setBidLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [waitingForNext, setWaitingForNext] = useState(false);
  const [roundCompleted, setRoundCompleted] = useState(false);
  const [localTimer, setLocalTimer] = useState<number>(0);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  
  const timerExpiredRef = useRef(false);
  const lastServerTimeRef = useRef<number>(0);

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
      // Rounds API returns array directly, not { rounds: [...] }
      setRounds(Array.isArray(roundsData) ? roundsData : roundsData.rounds || []);

      // Update local timer from server (validate it's reasonable)
      const serverTime = stateData.remainingTime;
      if (serverTime !== lastServerTimeRef.current && serverTime >= 0 && serverTime <= 60) {
        setLocalTimer(serverTime);
        lastServerTimeRef.current = serverTime;
      } else if (serverTime > 60) {
        // Timer seems corrupted, reset to 0
        setLocalTimer(0);
        lastServerTimeRef.current = 0;
      }

      // Check states
      if (stateData.isActive && !stateData.currentPlayerId) {
        setWaitingForNext(true);
        setRoundCompleted(false);
      } else if (!stateData.isActive && stateData.currentRoundId) {
        // Round just completed
        const round = roundsData.find((r: Round) => r.id === stateData.currentRoundId);
        if (round?.isCompleted) {
          setRoundCompleted(true);
        }
      } else {
        setWaitingForNext(false);
        setRoundCompleted(false);
      }
    } catch (error) {
      console.error('Error fetching auction state:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Local timer countdown for smooth display
  useEffect(() => {
    if (!state?.isActive || state?.isPaused || !state?.currentPlayerId) return;
    
    const interval = setInterval(() => {
      setLocalTimer(prev => Math.max(0, prev - 1));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [state?.isActive, state?.isPaused, state?.currentPlayerId]);

  // Handle timer expiry
  const handleTimerExpiry = useCallback(async () => {
    if (timerExpiredRef.current) return;
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

    setTimeout(() => {
      timerExpiredRef.current = false;
    }, 2000);
  }, []);

  // Polling for real-time updates
  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 1500); // Slightly slower polling
    return () => clearInterval(interval);
  }, [fetchState]);

  // Watch for timer expiry
  useEffect(() => {
    if (state?.isActive && 
        state?.currentPlayerId && 
        !state?.isPaused && 
        localTimer <= 0 &&
        !timerExpiredRef.current) {
      handleTimerExpiry();
    }
  }, [localTimer, state?.isActive, state?.currentPlayerId, state?.isPaused, handleTimerExpiry]);

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
          timerExpiredRef.current = false;
        }
        if (action === 'stop') {
          setRoundCompleted(false);
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
    setBidLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/auction/bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (res.ok) {
        // Optimistic update - immediately show new timer
        setLocalTimer(data.remainingTime || 6);
        setMessage({ type: 'success', text: data.message });
        // Quick fetch to get updated state
        fetchState();
      } else if (data.retry) {
        // Race condition - retry after short delay
        setTimeout(placeBid, 100);
        return;
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Bid failed' });
    } finally {
      setBidLoading(false);
    }
  };

  const deleteRound = async (roundId: number) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/auction/rounds?id=${roundId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Round deleted' });
        setDeleteConfirm(null);
        fetchState();
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Failed to delete round' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete round' });
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

  // Round Completed Screen
  if (roundCompleted && !state?.isActive) {
    return (
      <div className="space-y-6">
        <div className="card text-center py-12">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-3xl font-bold mb-4">Round Completed!</h2>
          <p className="text-gray-400 mb-8">
            {state?.currentRound?.name || 'This round'} has finished. All players have been auctioned.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => {
                setRoundCompleted(false);
                setSelectedRound(null);
              }}
              className="btn-primary"
            >
              📋 Select Another Round
            </button>
            <Link href="/auction-summary" className="btn-secondary">
              📊 View Auction Summary
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Live Auction</h1>
          <p className="text-gray-400">
            {state?.isActive 
              ? `Round ${state.currentRound?.roundNumber}: ${state.currentRound?.name}`
              : 'Select a round to begin'}
          </p>
        </div>
        <Link href="/auction-summary" className="btn-secondary">
          📊 Summary
        </Link>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {/* Waiting for Next Player Screen */}
      {waitingForNext && state?.isActive && !state?.currentPlayerId && (
        <div className="card text-center py-8">
          <div className="text-4xl mb-4">⏳</div>
          <h2 className="text-2xl font-bold mb-2">Waiting for Next Player</h2>
          
          {state.lastSale ? (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6 max-w-md mx-auto">
              <div className="text-green-400 text-sm mb-1">Last Sale</div>
              <div className="text-xl font-bold">{state.lastSale.playerName}</div>
              <div className="text-gray-400">
                sold to <span className="text-accent">{state.lastSale.teamName}</span> for{' '}
                <span className="text-green-400">{formatMoney(state.lastSale.amount)}</span>
              </div>
            </div>
          ) : (
            <p className="text-gray-400 mb-6">Player went unsold</p>
          )}

          {state.pendingPlayers.length > 0 ? (
            <>
              <p className="text-gray-400 mb-4">
                <span className="text-accent font-bold">{state.pendingPlayers.length}</span> players remaining
              </p>
              
              {isAdmin && (
                <button
                  onClick={() => executeAction('next')}
                  disabled={actionLoading}
                  className="btn-primary text-lg px-8 py-3"
                >
                  {actionLoading ? 'Loading...' : `⏭️ Next Player (${state.pendingPlayers[0]?.name})`}
                </button>
              )}
            </>
          ) : (
            <>
              <p className="text-yellow-400 mb-4">No more players in this round!</p>
              {isAdmin && (
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={() => executeAction('stop')}
                    disabled={actionLoading}
                    className="btn-danger"
                  >
                    🛑 End Round
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Active Auction Display */}
      {state?.isActive && state?.currentPlayer && !waitingForNext && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Auction Panel */}
          <div className="lg:col-span-2">
            <div className={`card ${state.isPaused ? 'border-yellow-500/50' : 'border-accent/50'} border-2`}>
              {/* Status Badge */}
              <div className="flex items-center justify-between mb-4">
                <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  state.isPaused 
                    ? 'bg-yellow-500/20 text-yellow-400' 
                    : 'bg-red-500/20 text-red-400 animate-pulse'
                }`}>
                  {state.isPaused ? '⏸️ PAUSED' : '🔴 LIVE'}
                </div>
                <div className="text-sm text-gray-400">
                  {state.currentPlayer.category}
                </div>
              </div>

              {/* Player Name */}
              <div className="text-center mb-6">
                <h2 className="text-4xl font-bold text-accent mb-4">{state.currentPlayer.name}</h2>
                <div className="text-sm text-gray-400">Base Price: {formatMoney(state.currentPlayer.basePrice)}</div>
              </div>

              {/* Timer - Using local timer for smooth countdown */}
              <div className="mb-6">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-400">Time Remaining</span>
                  <span className={`font-mono text-2xl font-bold transition-colors ${
                    localTimer <= 3 ? 'text-red-500' : 
                    localTimer <= 5 ? 'text-yellow-500' : 'text-accent'
                  }`}>
                    {state.isPaused ? '⏸️' : `${Math.max(0, localTimer)}s`}
                  </span>
                </div>
                <div className="w-full bg-background rounded-full h-4 overflow-hidden">
                  <div 
                    className={`h-4 rounded-full transition-all duration-300 ${
                      localTimer <= 3 ? 'bg-red-500' : 
                      localTimer <= 5 ? 'bg-yellow-500' : 'bg-accent'
                    }`}
                    style={{ 
                      width: `${Math.max(0, (localTimer / 10) * 100)}%`,
                      transition: state.isPaused ? 'none' : 'width 1s linear'
                    }}
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

              {/* Bid Button */}
              {session && isTeamOwner && (
                <button
                  onClick={placeBid}
                  disabled={bidLoading || actionLoading || state.isPaused}
                  className={`btn-primary w-full text-xl py-4 mb-4 transition-all ${
                    bidLoading ? 'opacity-70 scale-98' : ''
                  }`}
                >
                  {bidLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                      Bidding...
                    </span>
                  ) : state.isPaused ? (
                    '⏸️ Bidding Paused'
                  ) : (
                    `💰 Place Bid (${userTeam?.name})`
                  )}
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
                  <div key={team.id} className={`flex justify-between items-center p-2 rounded transition-all ${
                    team.ownerId === state.highestBidderId ? 'bg-accent/20 scale-[1.02]' : 'bg-surface-light'
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
                {state.pendingPlayers.slice(0, 5).map((player, idx) => (
                  <div key={player.id} className={`p-2 rounded ${idx === 0 ? 'bg-accent/10 border border-accent/30' : 'bg-surface-light'}`}>
                    <div className="font-medium text-sm">{player.name}</div>
                    <div className="text-xs text-gray-400">
                      {player.category} • {formatMoney(player.basePrice)}
                    </div>
                  </div>
                ))}
                {state.pendingPlayers.length > 5 && (
                  <div className="text-xs text-gray-500 text-center py-2">
                    +{state.pendingPlayers.length - 5} more
                  </div>
                )}
                {state.pendingPlayers.length === 0 && (
                  <div className="text-sm text-yellow-400 text-center py-4">
                    Last player!
                  </div>
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="card">
              <h3 className="font-semibold mb-4">Recent Activity</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {state.recentLogs.slice(0, 10).map(log => (
                  <div key={log.id} className="text-xs p-2 bg-surface-light rounded">
                    <div className={`${
                      log.logType === 'sale' ? 'text-green-400' :
                      log.logType === 'unsold' ? 'text-red-400' :
                      log.logType === 'bid' ? 'text-yellow-400' : 'text-gray-400'
                    }`}>
                      {log.message}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No Active Auction - Show Round Selection */}
      {!state?.isActive && !waitingForNext && !roundCompleted && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-6">Select Auction Round</h2>
          
          {rounds.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rounds.map(round => (
                <div key={round.id} className="relative">
                  <button
                    onClick={() => setSelectedRound(round.id)}
                    disabled={round.isCompleted || round.pendingPlayers === 0}
                    className={`w-full p-4 rounded-xl text-left transition-all ${
                      selectedRound === round.id 
                        ? 'bg-accent/20 border-2 border-accent' 
                        : round.isCompleted || round.pendingPlayers === 0
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
                      {!round.isCompleted && round.pendingPlayers === 0 && (
                        <span className="text-xs bg-gray-500/20 text-gray-400 px-2 py-1 rounded">
                          Empty
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-400 mb-2">{round.name}</div>
                    <div className="text-xs text-gray-500">
                      {round.pendingPlayers}/{round.totalPlayers} remaining • {round.soldPlayers} sold
                    </div>
                  </button>
                  
                  {/* Delete Button */}
                  {isAdmin && (
                    <div className="absolute top-2 right-2">
                      {deleteConfirm === round.id ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => deleteRound(round.id)}
                            className="text-xs bg-red-500 text-white px-2 py-1 rounded"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="text-xs bg-gray-500 text-white px-2 py-1 rounded"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm(round.id);
                          }}
                          className="text-xs text-red-400 hover:text-red-300 p-1"
                          title="Delete Round"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-4">📋</div>
              <p>No auction rounds created yet.</p>
              <p className="text-sm mt-2">Admins can create rounds in the Admin panel.</p>
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

      {/* Your Team Info */}
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
