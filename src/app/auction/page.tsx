'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ADMIN_IDS } from '@/lib/auth';

const INITIAL_TIMER = 12;
const BID_TIMER = 8;

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
  pausedTimeRemaining: number | null;
  remainingTime: number;
  currentPlayer: {
    id: number;
    name: string;
    category: string;
    basePrice: number;
    playerId?: string;
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
  lastUnsold: {
    playerName: string;
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
  
  // Simple timer state - just seconds
  const [timer, setTimer] = useState<number>(INITIAL_TIMER);
  const timerExpiredRef = useRef(false);
  const processingRef = useRef(false);

  const isAdmin = session?.user?.discordId && ADMIN_IDS.includes(session.user.discordId);
  const userTeam = state?.teams.find(t => t.ownerId === session?.user?.discordId);
  const isTeamOwner = !!userTeam;

  // Fetch state from server
  const fetchState = useCallback(async () => {
    try {
      const [stateRes, roundsRes] = await Promise.all([
        fetch('/api/auction/state'),
        fetch('/api/auction/rounds'),
      ]);

      const stateData = await stateRes.json();
      const roundsData = await roundsRes.json();

      if (stateRes.ok) {
        setState(stateData);
        
        // Sync timer from server if we have valid remaining time
        if (stateData.remainingTime !== undefined && stateData.remainingTime > 0 && !stateData.isPaused) {
          const serverTime = Math.ceil(stateData.remainingTime);
          // Only update if significantly different to avoid jitter
          setTimer(prev => Math.abs(prev - serverTime) > 2 ? serverTime : prev);
        }
        
        // Handle state transitions
        if (stateData.isActive && !stateData.currentPlayerId) {
          setWaitingForNext(true);
          setRoundCompleted(false);
          timerExpiredRef.current = false;
        } else if (!stateData.isActive && stateData.currentRoundId) {
          const round = (Array.isArray(roundsData) ? roundsData : roundsData.rounds || [])
            .find((r: Round) => r.id === stateData.currentRoundId);
          if (round?.isCompleted) {
            setRoundCompleted(true);
          }
        } else if (stateData.currentPlayerId) {
          setWaitingForNext(false);
          setRoundCompleted(false);
        }
      }

      if (roundsRes.ok) {
        setRounds(Array.isArray(roundsData) ? roundsData : roundsData.rounds || []);
      }
    } catch (error) {
      console.error('Error fetching auction state:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Simple countdown timer
  useEffect(() => {
    // Don't run if not active, no player, paused, or waiting
    if (!state?.isActive || !state?.currentPlayerId || state?.isPaused || waitingForNext) {
      return;
    }

    const interval = setInterval(() => {
      setTimer(prev => {
        if (prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [state?.isActive, state?.currentPlayerId, state?.isPaused, waitingForNext]);

  // Handle timer expiry
  useEffect(() => {
    const shouldExpire = 
      timer <= 0 &&
      state?.isActive &&
      state?.currentPlayerId &&
      !state?.isPaused &&
      !waitingForNext &&
      !timerExpiredRef.current &&
      !processingRef.current;

    if (shouldExpire) {
      handleTimerExpiry();
    }
  }, [timer, state?.isActive, state?.currentPlayerId, state?.isPaused, waitingForNext]);

  const handleTimerExpiry = async () => {
    if (timerExpiredRef.current || processingRef.current) return;
    
    processingRef.current = true;
    timerExpiredRef.current = true;
    
    const currentPlayerName = state?.currentPlayer?.name;
    
    try {
      const res = await fetch('/api/auction/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'timer_expired' }),
      });

      const data = await res.json();
      
      if (res.ok) {
        if (data.playerName && data.teamName) {
          setState(prev => prev ? {
            ...prev,
            currentPlayerId: null,
            currentPlayer: null,
            currentBid: 0,
            highestBidderId: null,
            highestBidderTeam: null,
            lastSale: {
              playerName: data.playerName,
              teamName: data.teamName,
              amount: data.amount || 0,
            },
            lastUnsold: null,
          } : prev);
        } else if (currentPlayerName) {
          setState(prev => prev ? {
            ...prev,
            currentPlayerId: null,
            currentPlayer: null,
            currentBid: 0,
            highestBidderId: null,
            highestBidderTeam: null,
            lastSale: null,
            lastUnsold: { playerName: currentPlayerName },
          } : prev);
        }
        
        setMessage({ type: 'success', text: data.message || 'Timer expired' });
        setWaitingForNext(true);
        
        setTimeout(() => fetchState(), 500);
      }
    } catch (error) {
      console.error('Timer expiry error:', error);
    } finally {
      processingRef.current = false;
      setTimeout(() => {
        timerExpiredRef.current = false;
      }, 2000);
    }
  };

  // Poll for state updates
  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 2000);
    return () => clearInterval(interval);
  }, [fetchState]);

  // Place bid
  const placeBid = async () => {
    if (bidLoading || !state?.currentPlayerId || state?.isPaused || timer <= 0) return;
    
    setBidLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/auction/bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: state.currentPlayerId }),
      });

      const data = await res.json();

      if (res.ok) {
        // Reset timer on successful bid
        setTimer(BID_TIMER);
        timerExpiredRef.current = false;
        setMessage({ type: 'success', text: data.message });
        fetchState();
      } else {
        setMessage({ type: 'error', text: data.error || 'Bid failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to place bid' });
    } finally {
      setBidLoading(false);
    }
  };

  // Execute admin action
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
          processingRef.current = false;
          setTimer(INITIAL_TIMER);
          
          if (data.roundCompleted) {
            setRoundCompleted(true);
          }
        }
        if (action === 'start') {
          setTimer(INITIAL_TIMER);
          timerExpiredRef.current = false;
          processingRef.current = false;
        }
        if (action === 'resume' && data.remainingTime) {
          setTimer(Math.ceil(data.remainingTime));
        }
        if (action === 'stop' || action === 'end_round') {
          setRoundCompleted(false);
          setWaitingForNext(false);
          if (data.redirect) {
            setSelectedRound(null);
          }
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

  // Format money
  const formatMoney = (amount: number) => {
    return `$${(amount / 1000000).toFixed(2)}M`;
  };

  // Get timer color
  const getTimerColor = () => {
    if (timer <= 3) return 'text-red-500';
    if (timer <= 6) return 'text-yellow-400';
    return 'text-accent';
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
              onClick={async () => {
                try {
                  await fetch('/api/auction/control', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'clear_round' }),
                  });
                } catch (e) {
                  console.error('Error clearing round:', e);
                }
                setRoundCompleted(false);
                setSelectedRound(null);
                setWaitingForNext(false);
              }}
              className="btn-primary"
            >
              Select Next Round
            </button>
            <Link href="/auction-summary" className="btn-secondary">
              View Summary
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Waiting for Next Player Screen
  if (waitingForNext && state?.isActive) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Live Auction</h1>
          <Link href="/auction-summary" className="btn-secondary text-sm">
            📊 Summary
          </Link>
        </div>

        <div className="card text-center py-12">
          <div className="text-6xl mb-4">{state.lastSale ? '🎊' : state.lastUnsold ? '😔' : '⏳'}</div>
          
          {state.lastSale ? (
            <>
              <h2 className="text-2xl font-bold mb-2 text-green-400">SOLD!</h2>
              <p className="text-xl mb-2">
                <span className="font-bold">{state.lastSale.playerName}</span>
              </p>
              <p className="text-gray-400 mb-6">
                to <span className="text-accent font-semibold">{state.lastSale.teamName}</span> for{' '}
                <span className="text-green-400 font-mono font-bold">{formatMoney(state.lastSale.amount)}</span>
              </p>
            </>
          ) : state.lastUnsold ? (
            <>
              <h2 className="text-2xl font-bold mb-2 text-yellow-400">UNSOLD</h2>
              <p className="text-xl mb-2">
                <span className="font-bold">{state.lastUnsold.playerName}</span>
              </p>
              <p className="text-gray-400 mb-6">
                No bids received - added to unsold pool
              </p>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold mb-2">Ready for Next Player</h2>
              <p className="text-gray-400 mb-6">Waiting for auction to continue</p>
            </>
          )}

          <div className="bg-surface-light rounded-lg p-4 inline-block mb-6">
            <span className="text-gray-400">Remaining in Queue</span>
            <div className="text-3xl font-bold text-accent">{state.pendingPlayers?.length || 0}</div>
          </div>

          {isAdmin && state.pendingPlayers && state.pendingPlayers.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => executeAction('next')}
                disabled={actionLoading}
                className="btn-primary"
              >
                ⏭️ Next: {state.pendingPlayers[0]?.name}
              </button>
              <button
                onClick={() => executeAction('stop')}
                disabled={actionLoading}
                className="btn-danger"
              >
                🛑 Stop Auction
              </button>
            </div>
          )}
          
          {isAdmin && (!state.pendingPlayers || state.pendingPlayers.length === 0) && (
            <div className="text-center">
              <p className="text-gray-400 mb-4">No more players in this round!</p>
              <button
                onClick={() => executeAction('end_round')}
                disabled={actionLoading}
                className="btn-secondary"
              >
                End Round
              </button>
            </div>
          )}
        </div>

        {/* User's Team Info */}
        {userTeam && (
          <div className="card">
            <div className="text-sm text-gray-400 mb-2">Your Team: {userTeam.name}</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-2xl font-bold text-accent font-mono">
                  {formatMoney(userTeam.purse)}
                </div>
                <div className="text-xs text-gray-500">Remaining Purse</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {userTeam.playerCount}/{userTeam.maxSize}
                </div>
                <div className="text-xs text-gray-500">Roster Size</div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Round Selection Screen (not active)
  if (!state?.isActive || !state?.currentRoundId) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Live Auction</h1>
        
        {message && (
          <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {message.text}
          </div>
        )}

        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Select Auction Round</h2>
          
          {rounds.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No auction rounds available. Create rounds in the Admin panel.</p>
          ) : (
            <div className="grid gap-4">
              {rounds.map(round => (
                <div
                  key={round.id}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedRound === round.id
                      ? 'border-accent bg-accent/10'
                      : 'border-surface-light bg-surface-light hover:border-accent/50'
                  } ${round.isCompleted ? 'opacity-50' : ''}`}
                  onClick={() => !round.isCompleted && setSelectedRound(round.id)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold">Round {round.roundNumber}: {round.name}</h3>
                      <p className="text-sm text-gray-400">
                        {round.pendingPlayers} pending | {round.soldPlayers} sold | {round.totalPlayers} total
                      </p>
                    </div>
                    {round.isCompleted && (
                      <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">Completed</span>
                    )}
                    {round.isActive && (
                      <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">Active</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {isAdmin && selectedRound && (
            <div className="mt-6 flex gap-4">
              <button
                onClick={() => executeAction('start')}
                disabled={actionLoading}
                className="btn-primary flex-1"
              >
                {actionLoading ? '⏳ Starting...' : '▶️ Start Auction'}
              </button>
            </div>
          )}

          {!isAdmin && (
            <p className="text-gray-400 text-center mt-6">
              Waiting for admin to start the auction...
            </p>
          )}
        </div>
      </div>
    );
  }

  // Active Auction Screen
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">Live Auction</h1>
          <span className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            LIVE
          </span>
        </div>
        <Link href="/auction-summary" className="btn-secondary text-sm">
          📊 Summary
        </Link>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {message.text}
        </div>
      )}

      {/* Round Info */}
      <div className="bg-green-500/20 text-green-400 px-4 py-2 rounded-lg text-sm">
        Now auctioning: {state.currentPlayer?.name}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Auction Card */}
        <div className="lg:col-span-2 space-y-4">
          <div className="text-sm text-gray-400">
            <span className="text-red-400">● LIVE</span> Round {state.currentRound?.roundNumber}: {state.currentRound?.name}
          </div>

          {state.currentPlayer && (
            <div className="card bg-gradient-to-br from-surface to-surface-light">
              <div className="text-center mb-6">
                <div className="text-sm text-gray-400 mb-2">{state.currentPlayer.category}</div>
                <h2 className="text-4xl font-bold mb-2">{state.currentPlayer.name}</h2>
                {state.currentPlayer.playerId && (
                  <div className="text-xs text-gray-500 font-mono">ID: {state.currentPlayer.playerId}</div>
                )}
              </div>

              {/* Big Timer Display */}
              <div className="mb-6 text-center">
                <div className={`text-8xl font-bold font-mono tabular-nums ${getTimerColor()} ${timer <= 3 ? 'animate-pulse' : ''}`}>
                  {timer}
                </div>
                <div className="text-gray-400 text-sm mt-1">seconds remaining</div>
              </div>

              {/* Bid Info */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-surface rounded-lg p-4 text-center">
                  <div className="text-sm text-gray-400 mb-1">Current Bid</div>
                  <div className="text-3xl font-bold text-accent font-mono">
                    {formatMoney(state.currentBid)}
                  </div>
                </div>
                <div className="bg-surface rounded-lg p-4 text-center">
                  <div className="text-sm text-gray-400 mb-1">Highest Bidder</div>
                  <div className="text-xl font-bold truncate">
                    {state.highestBidderTeam || 'No bids'}
                  </div>
                </div>
              </div>

              {/* Bid Button for Team Owners */}
              {isTeamOwner && (
                <button
                  onClick={placeBid}
                  disabled={bidLoading || state.isPaused || actionLoading || timer <= 0}
                  className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                    state.isPaused || timer <= 0
                      ? 'bg-gray-600 cursor-not-allowed opacity-50'
                      : bidLoading
                        ? 'bg-accent/50 cursor-wait'
                        : 'bg-accent hover:bg-accent/80 text-black'
                  }`}
                >
                  {bidLoading ? '⏳ Placing Bid...' : state.isPaused ? '⏸️ Bidding Paused' : timer <= 0 ? '⏰ Time Expired' : `💰 Place Bid (${userTeam?.name})`}
                </button>
              )}

              {/* Admin Controls */}
              {isAdmin && (
                <div className="flex gap-2 mt-4 flex-wrap">
                  <button
                    onClick={() => executeAction('skip')}
                    disabled={actionLoading}
                    className="btn-secondary text-sm flex-1"
                  >
                    ⏭️ Skip
                  </button>
                  <button
                    onClick={() => executeAction('sell')}
                    disabled={actionLoading || !state.highestBidderId}
                    className="btn-primary text-sm flex-1"
                  >
                    🔨 Sell Now
                  </button>
                  <button
                    onClick={() => executeAction(state.isPaused ? 'resume' : 'pause')}
                    disabled={actionLoading}
                    className="btn-warning text-sm flex-1"
                  >
                    {state.isPaused ? '▶️ Resume' : '⏸️ Pause'}
                  </button>
                  <button
                    onClick={() => executeAction('stop')}
                    disabled={actionLoading}
                    className="btn-danger text-sm flex-1"
                  >
                    🛑 Stop
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Team Purses */}
          <div className="card">
            <h3 className="font-semibold mb-3">Team Purses</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {state.teams.map(team => (
                <div key={team.id} className="flex justify-between items-center text-sm">
                  <span className="truncate">
                    {team.name} <span className="text-gray-500">({team.playerCount}/{team.maxSize})</span>
                  </span>
                  <span className="text-accent font-mono">{formatMoney(team.purse)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Up Next */}
          <div className="card">
            <h3 className="font-semibold mb-3">Up Next ({state.pendingPlayers?.length || 0})</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {state.pendingPlayers?.slice(0, 5).map((player, idx) => (
                <div 
                  key={player.id} 
                  className={`text-sm p-2 rounded ${idx === 0 ? 'bg-accent/20' : 'bg-surface'}`}
                >
                  <div className="font-medium">{player.name}</div>
                  <div className="text-xs text-gray-500">
                    {player.category} • {formatMoney(player.basePrice)}
                  </div>
                </div>
              ))}
              {(!state.pendingPlayers || state.pendingPlayers.length === 0) && (
                <p className="text-gray-500 text-sm">No more players</p>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="card">
            <h3 className="font-semibold mb-3">Recent Activity</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {state.recentLogs?.slice(0, 10).map(log => (
                <div 
                  key={log.id} 
                  className={`text-sm ${
                    log.logType === 'sale' ? 'text-green-400' : 
                    log.logType === 'unsold' ? 'text-yellow-400' : 
                    'text-gray-400'
                  }`}
                >
                  {log.message}
                </div>
              ))}
              {(!state.recentLogs || state.recentLogs.length === 0) && (
                <p className="text-gray-500 text-sm">No activity yet</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* User's Team Info */}
      {userTeam && (
        <div className="card">
          <div className="text-sm text-gray-400 mb-2">Your Team: {userTeam.name}</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-2xl font-bold text-accent font-mono">
                {formatMoney(userTeam.purse)}
              </div>
              <div className="text-xs text-gray-500">Remaining Purse</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {userTeam.playerCount}/{userTeam.maxSize}
              </div>
              <div className="text-xs text-gray-500">Roster Size</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
