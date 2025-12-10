'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/auction';

interface Team {
  id: number;
  name: string;
  purse: number;
  playerCount: number;
  maxSize: number;
}

interface Round {
  id: number;
  roundNumber: number;
  name: string;
  status: string;
  totalPlayers: number;
  soldPlayers: number;
  unsoldPlayers: number;
}

interface AuctionState {
  status: string;
  currentPlayer?: {
    name: string;
    basePrice: number;
  };
  currentBid?: number;
  highestBidderName?: string;
}

export default function Dashboard() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch teams
        const teamsRes = await fetch('/api/teams');
        const teamsData = await teamsRes.json();
        setTeams(teamsData);

        // Fetch rounds
        const roundsRes = await fetch('/api/rounds');
        const roundsData = await roundsRes.json();
        setRounds(roundsData);

        // Fetch auction state
        const auctionRes = await fetch('/api/auction');
        const auctionData = await auctionRes.json();
        setAuctionState({
          status: auctionData.state?.status || 'idle',
          currentPlayer: auctionData.currentPlayer,
          currentBid: auctionData.state?.currentBid,
          highestBidderName: auctionData.state?.highestBidderName,
        });
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // Poll for auction state updates
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Calculate stats
  const totalTeams = teams.length;
  const totalPlayers = teams.reduce((sum, t) => sum + t.playerCount, 0);
  const totalPurse = teams.reduce((sum, t) => sum + t.purse, 0);
  const totalAuctionPlayers = rounds.reduce((sum, r) => sum + r.totalPlayers, 0);
  const soldPlayers = rounds.reduce((sum, r) => sum + r.soldPlayers, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">🏏 League Dashboard</h1>
          <p className="text-gray-400">Overview of your cricket league</p>
        </div>

        {/* Live Auction Banner */}
        {auctionState?.status === 'active' && (
          <Link href="/auction">
            <div className="bg-red-600 rounded-xl p-6 mb-8 cursor-pointer hover:bg-red-700 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="animate-pulse text-3xl">🔴</span>
                  <div>
                    <h2 className="text-xl font-bold">LIVE AUCTION</h2>
                    {auctionState.currentPlayer && (
                      <p className="text-red-200">
                        Now Bidding: {auctionState.currentPlayer.name} - 
                        Current: {formatCurrency(auctionState.currentBid || auctionState.currentPlayer.basePrice)}
                        {auctionState.highestBidderName && ` (${auctionState.highestBidderName})`}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-2xl">→</span>
              </div>
            </div>
          </Link>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total Teams"
            value={totalTeams.toString()}
            icon="🏏"
          />
          <StatCard
            label="Players Rostered"
            value={totalPlayers.toString()}
            icon="👥"
          />
          <StatCard
            label="Total Purse Remaining"
            value={formatCurrency(totalPurse)}
            icon="💰"
            color="green"
          />
          <StatCard
            label="Auction Progress"
            value={`${soldPlayers}/${totalAuctionPlayers}`}
            icon="📊"
            color="yellow"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Team Leaderboard */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Team Standings</h2>
              <Link href="/franchises" className="text-indigo-400 hover:text-indigo-300 text-sm">
                View All →
              </Link>
            </div>
            <div className="space-y-3">
              {teams
                .sort((a, b) => b.playerCount - a.playerCount)
                .slice(0, 5)
                .map((team, idx) => (
                  <div 
                    key={team.id}
                    className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400 font-mono w-6">#{idx + 1}</span>
                      <span className="font-semibold">{team.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-400">{team.playerCount} players</div>
                      <div className="text-green-400 text-sm">{formatCurrency(team.purse)}</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Auction Rounds */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Auction Rounds</h2>
              <Link href="/auction" className="text-indigo-400 hover:text-indigo-300 text-sm">
                Go to Auction →
              </Link>
            </div>
            <div className="space-y-3">
              {rounds.map((round) => (
                <div 
                  key={round.id}
                  className="p-3 bg-gray-700/50 rounded-lg"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold">{round.name}</span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      round.status === 'active' ? 'bg-green-600' :
                      round.status === 'completed' ? 'bg-gray-600' :
                      'bg-yellow-600'
                    }`}>
                      {round.status}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>{round.totalPlayers} players</span>
                    <span>
                      {round.soldPlayers} sold | {round.unsoldPlayers} unsold
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2 w-full h-1 bg-gray-600 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500"
                      style={{ 
                        width: `${round.totalPlayers > 0 
                          ? ((round.soldPlayers + round.unsoldPlayers) / round.totalPlayers) * 100 
                          : 0}%` 
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/auction">
            <div className="bg-gray-800 hover:bg-gray-700 rounded-xl p-6 text-center cursor-pointer transition-colors border border-gray-700">
              <span className="text-3xl mb-2 block">🔴</span>
              <span className="font-semibold">Live Auction</span>
            </div>
          </Link>
          <Link href="/franchises">
            <div className="bg-gray-800 hover:bg-gray-700 rounded-xl p-6 text-center cursor-pointer transition-colors border border-gray-700">
              <span className="text-3xl mb-2 block">🏏</span>
              <span className="font-semibold">Franchises</span>
            </div>
          </Link>
          <Link href="/trades">
            <div className="bg-gray-800 hover:bg-gray-700 rounded-xl p-6 text-center cursor-pointer transition-colors border border-gray-700">
              <span className="text-3xl mb-2 block">🔄</span>
              <span className="font-semibold">Trade Center</span>
            </div>
          </Link>
          <Link href="/admin">
            <div className="bg-gray-800 hover:bg-gray-700 rounded-xl p-6 text-center cursor-pointer transition-colors border border-gray-700">
              <span className="text-3xl mb-2 block">🔐</span>
              <span className="font-semibold">Admin Panel</span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({ 
  label, 
  value, 
  icon, 
  color = 'white' 
}: { 
  label: string; 
  value: string; 
  icon: string; 
  color?: string;
}) {
  const colorClass = color === 'green' ? 'text-green-400' : 
                     color === 'yellow' ? 'text-yellow-400' : 
                     'text-white';
  
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{icon}</span>
        <span className="text-gray-400 text-sm">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
    </div>
  );
}
