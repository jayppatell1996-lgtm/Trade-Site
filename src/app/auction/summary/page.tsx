'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface AuctionLog {
  id: number;
  roundId: number | null;
  message: string;
  logType: string;
  timestamp: string;
}

interface Round {
  id: number;
  roundNumber: number;
  name: string;
  isActive: boolean;
  isCompleted: boolean;
}

interface Team {
  id: number;
  name: string;
  purse: number;
  maxSize: number;
}

interface Player {
  id: number;
  name: string;
  teamId: number;
  boughtFor: number | null;
}

interface Stats {
  totalSpent: number;
  totalSold: number;
  totalUnsold: number;
  highestSale: { player: string; team: string; amount: number } | null;
  lowestSale: { player: string; team: string; amount: number } | null;
  averagePrice: number;
  teamSpending: { name: string; spent: number; players: number }[];
  mostActiveTeam: { name: string; players: number } | null;
  biggestSpender: { name: string; spent: number } | null;
}

export default function AuctionSummaryPage() {
  const [logs, setLogs] = useState<AuctionLog[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [summaryRes, teamsRes] = await Promise.all([
        fetch('/api/auction/summary'),
        fetch('/api/teams'),
      ]);
      
      const summaryData = await summaryRes.json();
      const teamsData = await teamsRes.json();
      
      setLogs(summaryData.logs || []);
      setRounds(summaryData.rounds || []);
      setTeams(teamsData.teams || []);
      setPlayers(teamsData.players || []);
      
      // Calculate stats
      calculateStats(summaryData.logs || [], teamsData.teams || [], teamsData.players || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (logsData: AuctionLog[], teamsData: Team[], playersData: Player[]) => {
    const saleLogs = logsData.filter(log => log.logType === 'sale');
    const unsoldLogs = logsData.filter(log => log.logType === 'unsold');
    
    // Parse sale logs to extract amounts
    const sales: { player: string; team: string; amount: number }[] = [];
    
    saleLogs.forEach(log => {
      // Format: "Player Name sold to Team for $Amount"
      const match = log.message.match(/(.+) sold to (.+) for \$(.+)/);
      if (match) {
        sales.push({
          player: match[1],
          team: match[2],
          amount: parseFloat(match[3].replace(/,/g, '')),
        });
      }
    });

    const totalSpent = sales.reduce((sum, s) => sum + s.amount, 0);
    const averagePrice = sales.length > 0 ? totalSpent / sales.length : 0;
    
    // Find highest and lowest
    const sortedSales = [...sales].sort((a, b) => b.amount - a.amount);
    const highestSale = sortedSales[0] || null;
    const lowestSale = sortedSales[sortedSales.length - 1] || null;

    // Calculate team spending
    const teamStats: Record<string, { spent: number; players: number }> = {};
    sales.forEach(sale => {
      if (!teamStats[sale.team]) {
        teamStats[sale.team] = { spent: 0, players: 0 };
      }
      teamStats[sale.team].spent += sale.amount;
      teamStats[sale.team].players += 1;
    });

    const teamSpending = Object.entries(teamStats)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.spent - a.spent);

    const mostActiveTeam = teamSpending.length > 0 
      ? teamSpending.reduce((max, t) => t.players > max.players ? t : max)
      : null;
    
    const biggestSpender = teamSpending[0] || null;

    setStats({
      totalSpent,
      totalSold: sales.length,
      totalUnsold: unsoldLogs.length,
      highestSale,
      lowestSale,
      averagePrice,
      teamSpending,
      mostActiveTeam: mostActiveTeam ? { name: mostActiveTeam.name, players: mostActiveTeam.players } : null,
      biggestSpender: biggestSpender ? { name: biggestSpender.name, spent: biggestSpender.spent } : null,
    });
  };

  const formatMoney = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(2)}M`;
    }
    return `$${amount.toLocaleString()}`;
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const filteredLogs = selectedRound 
    ? logs.filter(log => log.roundId === selectedRound)
    : logs;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-accent mx-auto mb-4" />
          <p className="text-gray-400">Loading auction summary...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Auction Summary</h1>
          <p className="text-gray-400">Complete auction history and statistics</p>
        </div>
        <Link href="/auction" className="btn-secondary">
          ← Back to Auction
        </Link>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card text-center">
            <div className="text-3xl font-bold text-accent font-mono">{formatMoney(stats.totalSpent)}</div>
            <div className="text-sm text-gray-400 mt-1">Total Spent</div>
          </div>
          <div className="card text-center">
            <div className="text-3xl font-bold text-green-400">{stats.totalSold}</div>
            <div className="text-sm text-gray-400 mt-1">Players Sold</div>
          </div>
          <div className="card text-center">
            <div className="text-3xl font-bold text-red-400">{stats.totalUnsold}</div>
            <div className="text-sm text-gray-400 mt-1">Unsold</div>
          </div>
          <div className="card text-center">
            <div className="text-3xl font-bold text-blue-400 font-mono">{formatMoney(stats.averagePrice)}</div>
            <div className="text-sm text-gray-400 mt-1">Average Price</div>
          </div>
        </div>
      )}

      {/* Interesting Stats */}
      {stats && (stats.highestSale || stats.biggestSpender) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Highest Sale */}
          {stats.highestSale && (
            <div className="card bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/30">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">🏆</span>
                <h3 className="font-semibold text-yellow-400">Highest Sale</h3>
              </div>
              <div className="text-2xl font-bold mb-1">{stats.highestSale.player}</div>
              <div className="text-gray-400">
                to <span className="text-white">{stats.highestSale.team}</span>
              </div>
              <div className="text-xl font-mono text-accent mt-2">
                {formatMoney(stats.highestSale.amount)}
              </div>
            </div>
          )}

          {/* Lowest Sale */}
          {stats.lowestSale && stats.lowestSale.player !== stats.highestSale?.player && (
            <div className="card bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/30">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">💎</span>
                <h3 className="font-semibold text-blue-400">Best Value</h3>
              </div>
              <div className="text-2xl font-bold mb-1">{stats.lowestSale.player}</div>
              <div className="text-gray-400">
                to <span className="text-white">{stats.lowestSale.team}</span>
              </div>
              <div className="text-xl font-mono text-accent mt-2">
                {formatMoney(stats.lowestSale.amount)}
              </div>
            </div>
          )}

          {/* Biggest Spender */}
          {stats.biggestSpender && (
            <div className="card bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">💰</span>
                <h3 className="font-semibold text-green-400">Biggest Spender</h3>
              </div>
              <div className="text-2xl font-bold mb-1">{stats.biggestSpender.name}</div>
              <div className="text-xl font-mono text-accent mt-2">
                {formatMoney(stats.biggestSpender.spent)}
              </div>
            </div>
          )}

          {/* Most Active */}
          {stats.mostActiveTeam && (
            <div className="card bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">⚡</span>
                <h3 className="font-semibold text-purple-400">Most Active</h3>
              </div>
              <div className="text-2xl font-bold mb-1">{stats.mostActiveTeam.name}</div>
              <div className="text-xl font-mono text-accent mt-2">
                {stats.mostActiveTeam.players} players bought
              </div>
            </div>
          )}
        </div>
      )}

      {/* Team Spending Table */}
      {stats && stats.teamSpending.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Team Spending Breakdown</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 text-sm text-gray-400">Rank</th>
                  <th className="text-left p-3 text-sm text-gray-400">Team</th>
                  <th className="text-left p-3 text-sm text-gray-400">Players Bought</th>
                  <th className="text-left p-3 text-sm text-gray-400">Total Spent</th>
                  <th className="text-left p-3 text-sm text-gray-400">Avg. per Player</th>
                </tr>
              </thead>
              <tbody>
                {stats.teamSpending.map((team, index) => (
                  <tr key={team.name} className="border-b border-border/50 hover:bg-surface-light/50">
                    <td className="p-3">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                    </td>
                    <td className="p-3 font-medium">{team.name}</td>
                    <td className="p-3">{team.players}</td>
                    <td className="p-3 font-mono text-accent">{formatMoney(team.spent)}</td>
                    <td className="p-3 font-mono text-gray-400">
                      {formatMoney(team.players > 0 ? team.spent / team.players : 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Auction Logs */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Auction Logs</h2>
          <select
            value={selectedRound || ''}
            onChange={(e) => setSelectedRound(e.target.value ? parseInt(e.target.value) : null)}
            className="select"
          >
            <option value="">All Rounds</option>
            {rounds.map(round => (
              <option key={round.id} value={round.id}>
                Round {round.roundNumber}: {round.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredLogs.length > 0 ? (
            filteredLogs.map(log => (
              <div 
                key={log.id} 
                className={`p-3 rounded-lg ${
                  log.logType === 'sale' 
                    ? 'bg-green-500/10 border-l-4 border-green-500' 
                    : log.logType === 'unsold'
                      ? 'bg-red-500/10 border-l-4 border-red-500'
                      : 'bg-surface-light border-l-4 border-gray-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`${
                    log.logType === 'sale' ? 'text-green-400' :
                    log.logType === 'unsold' ? 'text-red-400' : 'text-gray-300'
                  }`}>
                    {log.logType === 'sale' && '✅ '}
                    {log.logType === 'unsold' && '❌ '}
                    {log.message}
                  </span>
                  <span className="text-xs text-gray-500 ml-4 whitespace-nowrap">
                    {formatDate(log.timestamp)}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              No auction logs yet
            </div>
          )}
        </div>
      </div>

      {/* Round Status */}
      {rounds.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Round Status</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {rounds.map(round => (
              <div 
                key={round.id}
                className={`p-4 rounded-lg text-center ${
                  round.isCompleted 
                    ? 'bg-green-500/10 border border-green-500/30' 
                    : round.isActive
                      ? 'bg-yellow-500/10 border border-yellow-500/30'
                      : 'bg-surface-light border border-border'
                }`}
              >
                <div className="font-bold">Round {round.roundNumber}</div>
                <div className="text-sm text-gray-400">{round.name}</div>
                <div className={`text-xs mt-2 ${
                  round.isCompleted ? 'text-green-400' :
                  round.isActive ? 'text-yellow-400' : 'text-gray-500'
                }`}>
                  {round.isCompleted ? '✅ Completed' : round.isActive ? '🔴 Active' : '⏳ Pending'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
