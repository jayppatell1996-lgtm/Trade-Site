'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ADMIN_IDS } from '@/lib/auth';

const INITIAL_TIMER = 12; // seconds for new player
const BID_TIMER = 8; // seconds after bid

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
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  
  // Smooth timer state
  const [displayTimer, setDisplayTimer] = useState<number>(INITIAL_TIMER);
  const [targetTimer, setTargetTimer] = useState<number>(INITIAL_TIMER);
  const timerExpiredRef = useRef(false);
  const lastBidTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(Date.now());

  const isAdmin = session?.user?.discordId && ADMIN_IDS.includes(session.user.discordId);
  const userTeam = state?.teams.find(t => t.ownerId === session?.user?.discordId);
  const isTeamOwner = !!userTeam;

  // Fetch auction state
  const fetchState = useCallback(async () => {
    try {
      const [stateRes, roundsRes] = await Promise.all([
        fetch('/api/auction/state'),
        fetch('/api/auction/rounds'),
      ]);
      const stateData = await stateRes.json();
      const roundsData = await roundsRes.json();
      
      const prevPlayerId = state?.currentPlayerId;
      setState(stateData);
      setRounds(Array.isArray(roundsData) ? roundsData : roundsData.rounds || []);

      // Sync timer from server
      const now = Date.now();
      const serverTime = stateData.remainingTime;
      
      // If new player started, reset timer fully
      if (stateData.currentPlayerId && stateData.currentPlayerId !== prevPlayerId) {
        console.log('New player detected, resetting timer to', serverTime || INITIAL_TIMER);
        const newTime = typeof serverTime === 'number' && serverTime > 0 ? serverTime : INITIAL_TIMER;
        setTargetTimer(newTime);
        setDisplayTimer(newTime);
        timerExpiredRef.current = false;
        setWaitingForNext(false);
      } else if (now - lastBidTimeRef.current > 800) {
        // Only sync if not recently bid (to avoid jitter)
        if (typeof serverTime === 'number' && serverTime >= 0) {
          // Smooth sync - only update if significantly different
          if (stateData.isPaused || !stateData.currentPlayerId) {
            setTargetTimer(serverTime);
            setDisplayTimer(serverTime);
          } else if (Math.abs(serverTime - displayTimer) > 2) {
            // Gradually sync if significantly different
            setTargetTimer(serverTime);
            setDisplayTimer(serverTime);
          }
        }
      }

      // Check states
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
    } catch (error) {
      console.error('Error fetching auction state:', error);
    } finally {
      setLoading(false);
    }
  }, [state?.currentPlayerId, displayTimer]);

  // Smooth timer animation using requestAnimationFrame
  const timerValueRef = useRef<number>(displayTimer);
  
  // Update ref when displayTimer changes externally (bids, new player, etc)
  useEffect(() => {
    timerValueRef.current = displayTimer;
  }, [displayTimer]);
  
  useEffect(() => {
    // If paused or no player, stop animation
    if (!state?.isActive || !state?.currentPlayerId) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }
    
    // If paused, stop animation but don't clear timer
    if (state?.isPaused) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    lastTickRef.current = Date.now();
    
    const animate = () => {
      const now = Date.now();
      const delta = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      
      // Use ref for current value to handle external updates
      timerValueRef.current = timerValueRef.current - delta;
      
      // Stop at 0
      if (timerValueRef.current <= 0) {
        timerValueRef.current = 0;
        setDisplayTimer(0);
        animationFrameRef.current = null;
        return;
      }
      
      setDisplayTimer(timerValueRef.current);
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    // Only start if timer > 0
    if (timerValueRef.current > 0) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [state?.isActive, state?.isPaused, state?.currentPlayerId]);

  // Handle timer expiry - this gets called when timer hits 0
  const handleTimerExpiry = useCallback(async () => {
    // Double-check we should actually expire
    if (timerExpiredRef.current) {
      console.log('Timer expiry already in progress, skipping');
      return;
    }
    
    // Don't process if we're already waiting for next or no player
    if (waitingForNext || !state?.currentPlayerId) {
      console.log('Not processing timer expiry - already waiting or no player');
      return;
    }
    
    // Save current player name before expiry for unsold case
    const currentPlayerName = state?.currentPlayer?.name;
    
    console.log('Timer expiry triggered, highestBidder:', state?.highestBidderTeam, 'player:', currentPlayerName);
    timerExpiredRef.current = true;
    
    try {
      const res = await fetch('/api/auction/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'timer_expired' }),
      });

      const data = await res.json();
      console.log('Timer expiry response:', data);
      
      if (res.ok) {
        // Use the response data directly to update UI
        if (data.playerName && data.teamName) {
          // Sale was made - update state with sale info
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
          // No sale - player went unsold
          setState(prev => prev ? {
            ...prev,
            currentPlayerId: null,
            currentPlayer: null,
            currentBid: 0,
            highestBidderId: null,
            highestBidderTeam: null,
            lastSale: null,
            lastUnsold: {
              playerName: currentPlayerName,
            },
          } : prev);
        }
        
        setMessage({ type: 'success', text: data.message || 'Timer expired' });
        setWaitingForNext(true);
        
        // Delay fetch to allow server to complete
        setTimeout(() => {
          fetchState();
        }, 500);
      } else {
        console.error('Timer expiry failed:', data.error);
        // Still go to waiting state on error to prevent getting stuck
        setWaitingForNext(true);
        fetchState();
      }
    } catch (error) {
      console.error('Timer expiry error:', error);
      // Still go to waiting state on error to prevent getting stuck
      setWaitingForNext(true);
      fetchState();
    }
    
    // Reset the ref after a delay to allow for next player
    setTimeout(() => {
      timerExpiredRef.current = false;
      console.log('Timer expiry ref reset');
    }, 3000);
  }, [fetchState, waitingForNext, state?.currentPlayerId, state?.highestBidderTeam, state?.currentPlayer?.name]);

  // Polling for real-time updates
  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 1500);
    return () => clearInterval(interval);
  }, [fetchState]);

  // Watch for timer expiry - trigger when timer reaches 0
  useEffect(() => {
    // Check if we should trigger timer expiry
    const shouldExpire = 
      state?.isActive && 
      state?.currentPlayerId && 
      !state?.isPaused && 
      displayTimer <= 0 && // Timer has hit 0
      !timerExpiredRef.current &&
      !waitingForNext;
    
    if (shouldExpire) {
      console.log('Timer expiry conditions met, displayTimer:', displayTimer, 'highestBidder:', state?.highestBidderTeam);
      handleTimerExpiry();
    }
  }, [displayTimer, state?.isActive, state?.currentPlayerId, state?.isPaused, state?.highestBidderTeam, waitingForNext, handleTimerExpiry]);

  // Backup timer expiry - if server shows timer should have expired
  useEffect(() => {
    if (
      state?.isActive && 
      state?.currentPlayerId && 
      !state?.isPaused && 
      state?.remainingTime !== undefined &&
      state.remainingTime <= 0 &&
      !timerExpiredRef.current &&
      !waitingForNext
    ) {
      console.log('Server says timer expired, triggering expiry');
      handleTimerExpiry();
    }
  }, [state?.isActive, state?.currentPlayerId, state?.isPaused, state?.remainingTime, waitingForNext, handleTimerExpiry]);

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
          setDisplayTimer(INITIAL_TIMER);
          setTargetTimer(INITIAL_TIMER);
          
          // Check if round completed
          if (data.roundCompleted) {
            setRoundCompleted(true);
          }
        }
        if (action === 'start') {
          setDisplayTimer(INITIAL_TIMER);
          setTargetTimer(INITIAL_TIMER);
        }
        if (action === 'resume' && data.remainingTime) {
          // Resume with the time that was remaining when paused
          setDisplayTimer(data.remainingTime);
          setTargetTimer(data.remainingTime);
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

  const placeBid = async () => {
    if (bidLoading) return; // Prevent double-clicks
    
    setBidLoading(true);
    setMessage(null);
    lastBidTimeRef.current = Date.now();

    // Optimistic timer update - immediately show new timer
    setDisplayTimer(BID_TIMER);
    setTargetTimer(BID_TIMER);

    try {
      const res = await fetch('/api/auction/bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: data.message });
        // Sync with server timer
        if (data.remainingTime) {
          setTargetTimer(data.remainingTime);
        }
        fetchState();
      } else if (data.retry) {
        // Race condition - retry after short delay
        setTimeout(() => {
          setBidLoading(false);
          placeBid();
        }, 100);
        return;
      } else {
        setMessage({ type: 'error', text: data.error });
        // Revert timer on error - sync with server
        fetchState();
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Bid failed' });
      fetchState();
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

  // Calculate smooth progress bar percentage
  const getTimerProgress = () => {
    const maxTime = INITIAL_TIMER;
    return Math.max(0, Math.min(100, (displayTimer / maxTime) * 100));
  };

  // Get timer color based on remaining time
  const getTimerColor = () => {
    if (displayTimer <= 3) return 'bg-red-500';
    if (displayTimer <= 6) return 'bg-yellow-500';
    return 'bg-accent';
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
                // Clear round on server first
                try {
                  await fetch('/api/auction/control', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'clear_round' }),
                  });
                } catch (e) {
                  console.error('Error clearing round:', e);
                }
                // Then clear local state
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
          <div className="flex gap-2">
            <Link href="/auction-summary" className="btn-secondary text-sm">
              📊 Summary
            </Link>
          </div>
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
            <div className="text-sm text-gray-400 mb-1">Remaining in Queue</div>
            <div className="text-3xl font-bold text-accent">{state.pendingPlayers.length}</div>
          </div>

          {isAdmin && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {state.pendingPlayers.length > 0 ? (
                <button
                  onClick={() => executeAction('next')}
                  disabled={actionLoading}
                  className="btn-primary text-lg px-8 py-3"
                >
                  {actionLoading ? 'Loading...' : `⏭️ Next: ${state.pendingPlayers[0]?.name || 'Player'}`}
                </button>
              ) : (
                <button
                  onClick={() => executeAction('end_round')}
                  disabled={actionLoading}
                  className="btn-warning text-lg px-8 py-3"
                >
                  {actionLoading ? 'Ending...' : '🏁 End Round'}
                </button>
              )}
              <button
                onClick={() => executeAction('stop')}
                disabled={actionLoading}
                className="btn-danger"
              >
                🛑 Stop Auction
              </button>
            </div>
          )}
        </div>

        {/* Your Team Info */}
        {userTeam && (
          <div className="card">
            <h3 className="font-semibold mb-4">Your Team: {userTeam.name}</h3>
            <div className="grid grid-cols-2 gap-4 text-center">
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">
          {state?.isActive ? '🔴 Live Auction' : 'Auction'}
        </h1>
        <div className="flex gap-2">
          <Link href="/auction-summary" className="btn-secondary text-sm">
            📊 Summary
          </Link>
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

      {/* Active Auction */}
      {state?.isActive && state.currentPlayer && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Auction Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status Badge */}
            <div className="flex items-center gap-3">
              <span className={`px-4 py-2 rounded-full text-sm font-bold ${
                state.isPaused 
                  ? 'bg-yellow-500/20 text-yellow-400' 
                  : 'bg-red-500/20 text-red-400 animate-pulse'
              }`}>
                {state.isPaused ? '⏸️ PAUSED' : '🔴 LIVE'}
              </span>
              <span className="text-gray-400">
                Round {state.currentRound?.roundNumber}: {state.currentRound?.name}
              </span>
            </div>

            {/* Current Player Card */}
            <div className="card bg-gradient-to-br from-surface to-surface-light">
              <div className="text-center mb-6">
                <div className="text-sm text-gray-400 mb-2">{state.currentPlayer.category}</div>
                <h2 className="text-4xl font-bold mb-2">{state.currentPlayer.name}</h2>
                {state.currentPlayer.playerId && (
                  <div className="text-xs text-gray-500 font-mono">ID: {state.currentPlayer.playerId}</div>
                )}
              </div>

              {/* Timer Bar - Smooth animation */}
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Time Remaining</span>
                  <span className={`font-mono font-bold ${
                    displayTimer <= 3 ? 'text-red-400' : displayTimer <= 6 ? 'text-yellow-400' : 'text-accent'
                  }`}>
                    {Math.max(0, Math.ceil(displayTimer))}s
                  </span>
                </div>
                <div className="w-full bg-surface rounded-full h-4 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-100 ease-linear ${getTimerColor()}`}
                    style={{ width: `${getTimerProgress()}%` }}
                  />
                </div>
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
                  disabled={bidLoading || state.isPaused || actionLoading}
                  className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                    state.isPaused 
                      ? 'bg-gray-600 cursor-not-allowed opacity-50'
                      : bidLoading
                        ? 'bg-accent/50 cursor-wait'
                        : 'bg-accent hover:bg-accent/80 text-black'
                  }`}
                >
                  {bidLoading ? '⏳ Placing Bid...' : state.isPaused ? '⏸️ Bidding Paused' : `💰 Place Bid (${userTeam?.name})`}
                </button>
              )}

              {!isTeamOwner && session && (
                <div className="text-center text-gray-500 py-4">
                  You do not own a team. Only team owners can bid.
                </div>
              )}

              {!session && (
                <Link href="/login" className="btn-secondary w-full text-center block">
                  Sign in to bid
                </Link>
              )}
            </div>

            {/* Admin Controls */}
            {isAdmin && (
              <div className="flex flex-wrap gap-3">
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
                    🏁 Last player!
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
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteRound(round.id);
                            }}
                            className="text-xs bg-red-500 text-white px-2 py-1 rounded"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm(null);
                            }}
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
      {userTeam && !waitingForNext && (
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
