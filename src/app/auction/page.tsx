'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';

// Timer constants (in seconds for display)
const BID_INCREMENT_TIME = 12; // Initial timer
const BID_CONTINUE_TIME = 8;   // Timer after bid

interface AuctionPlayer {
  id: number;
  playerId?: number;
  name: string;
  category: string;
  basePrice: number;
  status?: string;
}

interface AuctionRound {
  id: number;
  name: string;
  status: string;
  createdAt: string;
}

interface AuctionState {
  isActive: boolean;
  currentPlayerId: number | null;
  currentPlayer: AuctionPlayer | null;
  currentBid: number;
  highestBidderId: string | null;
  highestBidderName: string | null;
  remainingTime: number;
  isPaused: boolean;
  roundId: number | null;
}

interface Team {
  id: number;
  name: string;
  ownerId: string;
  purse: number;
  maxSize: number;
  players: string;
}

const ADMIN_IDS = ['256972361918578688', '1111497896018313268'];

export default function AuctionPage() {
  const { data: session } = useSession();
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null);
  const [pendingPlayers, setPendingPlayers] = useState<AuctionPlayer[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [rounds, setRounds] = useState<AuctionRound[]>([]);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [bidLoading, setBidLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRoundList, setShowRoundList] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Local timer for smooth countdown
  const [localTimer, setLocalTimer] = useState(0);
  const lastServerSync = useRef<number>(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const isAdmin = session?.user?.id && ADMIN_IDS.includes(session.user.id);
  const userTeam = teams.find(t => t.ownerId === session?.user?.id);

  // Fetch auction rounds
  const fetchRounds = useCallback(async () => {
    try {
      const res = await fetch('/api/auction/rounds');
      if (res.ok) {
        const data = await res.json();
        setRounds(data.rounds || []);
      }
    } catch (err) {
      console.error('Error fetching rounds:', err);
    }
  }, []);

  // Fetch teams
  const fetchTeams = useCallback(async () => {
    try {
      const res = await fetch('/api/teams');
      if (res.ok) {
        const data = await res.json();
        setTeams(data.teams || []);
      }
    } catch (err) {
      console.error('Error fetching teams:', err);
    }
  }, []);

  // Fetch auction state
  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/auction/state');
      if (res.ok) {
        const data = await res.json();
        setAuctionState(data);
        
        // Sync local timer with server (but not too often)
        const now = Date.now();
        if (now - lastServerSync.current > 1500 || !data.isPaused) {
          // Ensure remainingTime is a valid number
          let serverTime = Number(data.remainingTime) || 0;
          if (!Number.isFinite(serverTime) || serverTime < 0) {
            serverTime = 0;
          }
          if (serverTime > BID_INCREMENT_TIME) {
            serverTime = BID_INCREMENT_TIME;
          }
          setLocalTimer(serverTime);
          lastServerSync.current = now;
        }
      }
    } catch (err) {
      console.error('Error fetching state:', err);
    }
  }, []);

  // Fetch pending players for selected round
  const fetchPendingPlayers = useCallback(async (roundId: number) => {
    try {
      const res = await fetch(`/api/auction/rounds/${roundId}/players`);
      if (res.ok) {
        const data = await res.json();
        setPendingPlayers(data.players?.filter((p: AuctionPlayer) => p.status === 'pending') || []);
      }
    } catch (err) {
      console.error('Error fetching players:', err);
    }
  }, []);

  // Local timer countdown
  useEffect(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    if (auctionState?.isActive && !auctionState?.isPaused && localTimer > 0) {
      timerIntervalRef.current = setInterval(() => {
        setLocalTimer(prev => {
          const newVal = prev - 0.1; // Smooth 100ms decrement
          return newVal > 0 ? Math.round(newVal * 10) / 10 : 0;
        });
      }, 100);
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [auctionState?.isActive, auctionState?.isPaused, localTimer > 0]);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchRounds(), fetchTeams(), fetchState()]);
      setLoading(false);
    };
    init();
  }, [fetchRounds, fetchTeams, fetchState]);

  // Poll for updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchState();
      fetchTeams();
      if (selectedRound) {
        fetchPendingPlayers(selectedRound);
      }
    }, 1500); // Poll every 1.5 seconds

    return () => clearInterval(interval);
  }, [fetchState, fetchTeams, fetchPendingPlayers, selectedRound]);

  // Handle selecting a round
  const handleSelectRound = async (roundId: number) => {
    setSelectedRound(roundId);
    setShowRoundList(false);
    await fetchPendingPlayers(roundId);
  };

  // Handle starting auction for a player
  const handleStartAuction = async (playerId: number) => {
    try {
      const res = await fetch('/api/auction/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', playerId, roundId: selectedRound })
      });
      
      if (res.ok) {
        setLocalTimer(BID_INCREMENT_TIME);
        await fetchState();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to start auction');
      }
    } catch (err) {
      setError('Failed to start auction');
    }
  };

  // Handle placing a bid
  const handleBid = async () => {
    if (bidLoading) return;
    
    setBidLoading(true);
    setError(null);

    const attemptBid = async (retries = 2): Promise<boolean> => {
      try {
        const res = await fetch('/api/auction/bid', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await res.json();
        
        if (res.status === 429 && data.retry && retries > 0) {
          // Server busy, retry after short delay
          await new Promise(r => setTimeout(r, 100));
          return attemptBid(retries - 1);
        }
        
        if (res.ok) {
          // Optimistic update - set timer to 8 seconds immediately
          setLocalTimer(BID_CONTINUE_TIME);
          await fetchState();
          return true;
        } else {
          setError(data.error || 'Bid failed');
          return false;
        }
      } catch (err) {
        if (retries > 0) {
          await new Promise(r => setTimeout(r, 100));
          return attemptBid(retries - 1);
        }
        setError('Network error');
        return false;
      }
    };

    await attemptBid();
    setBidLoading(false);
  };

  // Handle admin controls
  const handleControl = async (action: 'pause' | 'resume' | 'skip' | 'stop') => {
    try {
      const res = await fetch('/api/auction/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      
      if (res.ok) {
        if (action === 'resume') {
          setLocalTimer(BID_INCREMENT_TIME); // Resume resets to 12s
        }
        await fetchState();
        if (selectedRound) {
          await fetchPendingPlayers(selectedRound);
        }
      } else {
        const data = await res.json();
        setError(data.error || `Failed to ${action}`);
      }
    } catch (err) {
      setError(`Failed to ${action}`);
    }
  };

  // Handle selling player
  const handleSold = async () => {
    try {
      const res = await fetch('/api/auction/sold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (res.ok) {
        await fetchState();
        await fetchTeams();
        if (selectedRound) {
          await fetchPendingPlayers(selectedRound);
        }
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to sell player');
      }
    } catch (err) {
      setError('Failed to sell player');
    }
  };

  // Handle delete round
  const handleDeleteRound = async (roundId: number) => {
    try {
      const res = await fetch(`/api/auction/rounds?id=${roundId}`, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        setDeleteConfirmId(null);
        await fetchRounds();
        if (selectedRound === roundId) {
          setSelectedRound(null);
          setPendingPlayers([]);
        }
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to delete round');
      }
    } catch (err) {
      setError('Failed to delete round');
    }
  };

  // Format currency
  const formatCurrency = (amount: number): string => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(2)}M`;
    }
    return `$${amount.toLocaleString()}`;
  };

  // Calculate progress percentage (smooth)
  const getProgressPercent = (): number => {
    const maxTime = BID_INCREMENT_TIME;
    const percent = (localTimer / maxTime) * 100;
    return Math.max(0, Math.min(100, percent));
  };

  // Get timer color
  const getTimerColor = (): string => {
    if (localTimer <= 3) return 'text-red-500';
    if (localTimer <= 6) return 'text-yellow-500';
    return 'text-green-500';
  };

  // Get progress bar color
  const getProgressColor = (): string => {
    if (localTimer <= 3) return 'bg-red-500';
    if (localTimer <= 6) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading auction...</div>
      </div>
    );
  }

  // Round selection screen
  if (!selectedRound || showRoundList) {
    return (
      <div className="min-h-screen bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-6">🏏 Auction Rounds</h1>
          
          {rounds.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-400 text-lg">No auction rounds available</p>
              <p className="text-gray-500 mt-2">Create a round to get started</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {rounds.map(round => (
                <div 
                  key={round.id}
                  className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-green-500 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-white">{round.name}</h3>
                      <p className="text-gray-400 text-sm">
                        Status: <span className={round.status === 'active' ? 'text-green-400' : 'text-gray-500'}>
                          {round.status}
                        </span>
                      </p>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSelectRound(round.id)}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                      >
                        Select
                      </button>
                      
                      {isAdmin && (
                        <>
                          {deleteConfirmId === round.id ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleDeleteRound(round.id)}
                                className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(round.id)}
                              className="px-3 py-2 bg-gray-700 hover:bg-red-600 text-white rounded-lg transition-colors"
                              title="Delete round"
                            >
                              🗑️
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Check if round is complete
  if (pendingPlayers.length === 0 && !auctionState?.isActive) {
    return (
      <div className="min-h-screen bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gray-800 rounded-lg p-8 border border-gray-700">
            <h2 className="text-4xl mb-4">🎉</h2>
            <h2 className="text-2xl font-bold text-white mb-4">Round Completed!</h2>
            <p className="text-gray-400 mb-6">All players in this round have been auctioned.</p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setShowRoundList(true)}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
              >
                Select Another Round
              </button>
              <a
                href="/auction-summary"
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
              >
                View Auction Summary
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white">🏏 Live Auction</h1>
          <button
            onClick={() => setShowRoundList(true)}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
          >
            📋 Change Round
          </button>
        </div>

        {/* Error display */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
            {error}
            <button onClick={() => setError(null)} className="ml-4 text-red-400 hover:text-red-300">✕</button>
          </div>
        )}

        {/* Live Auction Card */}
        {auctionState?.isActive && auctionState.currentPlayer ? (
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-6">
            {/* Status Badge */}
            <div className="flex justify-between items-start mb-4">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                auctionState.isPaused 
                  ? 'bg-yellow-500/20 text-yellow-400' 
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {auctionState.isPaused ? '⏸️ PAUSED' : '🔴 LIVE'}
              </span>
              <span className="text-gray-400">{auctionState.currentPlayer.category}</span>
            </div>

            {/* Player Name */}
            <h2 className="text-3xl md:text-4xl font-bold text-green-400 text-center mb-2">
              {auctionState.currentPlayer.name}
            </h2>
            <p className="text-center text-gray-400 mb-6">
              Base Price: {formatCurrency(auctionState.currentPlayer.basePrice)}
            </p>

            {/* Timer */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-400">Time Remaining</span>
                <span className={`text-2xl font-bold font-mono ${getTimerColor()}`}>
                  {Math.max(0, Math.ceil(localTimer))}s
                </span>
              </div>
              <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${getProgressColor()} transition-all duration-100 ease-linear`}
                  style={{ width: `${getProgressPercent()}%` }}
                />
              </div>
            </div>

            {/* Bid Info */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                <p className="text-gray-400 text-sm">Current Bid</p>
                <p className="text-2xl font-bold text-green-400">
                  {formatCurrency(auctionState.currentBid)}
                </p>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                <p className="text-gray-400 text-sm">Highest Bidder</p>
                <p className="text-xl font-bold text-white">
                  {auctionState.highestBidderName || 'No bids yet'}
                </p>
              </div>
            </div>

            {/* Bid Button */}
            {userTeam && !auctionState.isPaused && (
              <button
                onClick={handleBid}
                disabled={bidLoading}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                  bidLoading
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-green-500 hover:bg-green-600 active:scale-[0.98]'
                } text-white`}
              >
                {bidLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    Bidding...
                  </span>
                ) : (
                  `💰 Place Bid (${userTeam.name})`
                )}
              </button>
            )}

            {/* Admin Controls */}
            {isAdmin && (
              <div className="grid grid-cols-4 gap-2 mt-4">
                <button
                  onClick={() => handleControl('skip')}
                  className="py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors active:scale-95"
                >
                  ⏭️ Skip
                </button>
                <button
                  onClick={handleSold}
                  disabled={!auctionState.highestBidderId}
                  className={`py-3 rounded-lg font-medium transition-colors active:scale-95 ${
                    auctionState.highestBidderId
                      ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  🔨 Sell Now
                </button>
                <button
                  onClick={() => handleControl(auctionState.isPaused ? 'resume' : 'pause')}
                  className={`py-3 rounded-lg font-medium transition-colors active:scale-95 ${
                    auctionState.isPaused
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-orange-600 hover:bg-orange-700'
                  } text-white`}
                >
                  {auctionState.isPaused ? '▶️ Resume' : '⏸️ Pause'}
                </button>
                <button
                  onClick={() => handleControl('stop')}
                  className="py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors active:scale-95"
                >
                  🛑 Stop
                </button>
              </div>
            )}
          </div>
        ) : (
          /* No Active Auction */
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-6 text-center">
            <p className="text-gray-400 text-lg mb-4">No auction in progress</p>
            {isAdmin && pendingPlayers.length > 0 && (
              <p className="text-gray-500">Select a player below to start the auction</p>
            )}
          </div>
        )}

        {/* Team Purses */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 mb-6">
          <h3 className="text-lg font-semibold text-white mb-3">💼 Team Purses</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {teams.map(team => (
              <div 
                key={team.id}
                className={`p-2 rounded-lg text-center ${
                  team.ownerId === session?.user?.id 
                    ? 'bg-green-900/30 border border-green-500/50' 
                    : 'bg-gray-700/50'
                }`}
              >
                <p className="text-sm font-medium text-white truncate">{team.name}</p>
                <p className="text-xs text-green-400">{formatCurrency(team.purse)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Players Queue */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-3">
            📋 Players Queue ({pendingPlayers.length} remaining)
          </h3>
          
          {pendingPlayers.length === 0 ? (
            <p className="text-gray-400 text-center py-4">No more players in queue</p>
          ) : (
            <div className="grid gap-2">
              {pendingPlayers.slice(0, 10).map((player, index) => (
                <div 
                  key={player.id}
                  className={`flex justify-between items-center p-3 rounded-lg ${
                    index === 0 ? 'bg-green-900/30 border border-green-500/30' : 'bg-gray-700/50'
                  }`}
                >
                  <div>
                    <span className="text-gray-500 mr-2">#{index + 1}</span>
                    <span className="text-white font-medium">{player.name}</span>
                    <span className="text-gray-400 ml-2 text-sm">({player.category})</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-green-400">{formatCurrency(player.basePrice)}</span>
                    {isAdmin && !auctionState?.isActive && (
                      <button
                        onClick={() => handleStartAuction(player.id)}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors active:scale-95"
                      >
                        Start
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {pendingPlayers.length > 10 && (
                <p className="text-gray-500 text-center py-2">
                  And {pendingPlayers.length - 10} more players...
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
