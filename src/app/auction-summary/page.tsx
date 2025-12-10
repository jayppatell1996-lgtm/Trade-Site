'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Log {
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
  totalPlayers: number;
  pendingPlayers: number;
  soldPlayers: number;
}

interface Team {
  id: number;
  name: string;
  ownerId: string;
  purse: number;
  maxSize: number;
  playerCount: number;
}

interface Stats {
  totalSold: number;
  totalUnsold: number;
  totalSpent: number;
  avgPrice: number;
  highestSale: { player: string; team: string; amount: number } | null;
  lowestSale: { player: string; team: string; amount: number } | null;
  teamStats: Array<{
    name: string;
    spent: number;
    players: number;
    remaining: number;
  }>;
}

export default function AuctionSummaryPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterRound, setFilterRound] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [stateRes, roundsRes, logsRes] = await Promise.all([
        fetch('/api/auction/state'),
        fetch('/api/auction/rounds'),
        fetch('/api/auction/logs'),
      ]);

      const stateData = await stateRes.json();
      const roundsData = await roundsRes.json();
      const logsData = await logsRes.json();

      const teams = stateData.teams || [];
      setRounds(Array.isArray(roundsData) ? roundsData : roundsData.rounds || []);
      setLogs(Array.isArray(logsData) ? logsData : logsData.logs || []);

      // Calculate stats from logs
      const allLogs = Array.isArray(logsData) ? logsData : logsData.logs || [];
      const saleLogs = allLogs.filter((l: Log) => l.logType === 'sale');
      const unsoldLogs = allLogs.filter((l: Log) => l.logType === 'unsold');

      // Parse sale logs for amounts
      const sales: Array<{ player: string; team: string; amount: number }> = [];
      const teamSpending: Record<string, number> = {};
      const teamPlayerCount: Record<string, number> = {};

      for (const log of saleLogs) {
        const match = log.message.match(/(.+) sold to (.+) for \$([0-9,]+)/);
        if (match) {
          const player = match[1];
          const team = match[2];
          const amount = parseInt(match[3].replace(/,/g, ''));
          sales.push({ player, team, amount });
          teamSpending[team] = (teamSpending[team] || 0) + amount;
          teamPlayerCount[team] = (teamPlayerCount[team] || 0) + 1;
        }
      }

      const totalSpent = sales.reduce((sum, s) => sum + s.amount, 0);
      const avgPrice = sales.length > 0 ? totalSpent / sales.length : 0;
      const sortedSales = [...sales].sort((a, b) => b.amount - a.amount);

      const teamStats = teams.map((t: Team) => ({
        name: t.name,
        spent: teamSpending[t.name] || 0,
        players: teamPlayerCount[t.name] || 0,
        remaining: t.purse,
      })).sort((a: { spent: number }, b: { spent: number }) => b.spent - a.spent);

      setStats({
        totalSold: sales.length,
        totalUnsold: unsoldLogs.length,
        totalSpent,
        avgPrice,
        highestSale: sortedSales[0] || null,
        lowestSale: sortedSales[sortedSales.length - 1] || null,
        teamStats,
      });

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter logs
  const filteredLogs = logs.filter(log => {
    if (filterType !== 'all' && log.logType !== filterType) return false;
    if (filterRound !== null && log.roundId !== filterRound) return false;
    if (searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const formatMoney = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toLocaleString()}`;
  };

  const getLogTypeColor = (type: string) => {
    switch (type) {
      case 'sale': return 'text-green-400 bg-green-500/10';
      case 'unsold': return 'text-red-400 bg-red-500/10';
      case 'bid': return 'text-yellow-400 bg-yellow-500/10';
      case 'start': return 'text-blue-400 bg-blue-500/10';
      case 'pause': return 'text-orange-400 bg-orange-500/10';
      case 'resume': return 'text-cyan-400 bg-cyan-500/10';
      case 'stop': return 'text-gray-400 bg-gray-500/10';
      default: return 'text-gray-400 bg-gray-500/10';
    }
  };

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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Auction Summary</h1>
          <p className="text-gray-400">Complete history and statistics from all auction rounds</p>
        </div>
        <Link href="/auction" className="btn-secondary">
          ← Back to Auction
        </Link>
      </div>

      {/* Key Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card text-center">
            <div className="text-3xl font-bold text-green-400">{stats.totalSold}</div>
            <div className="text-sm text-gray-400">Players Sold</div>
          </div>
          <div className="card text-center">
            <div className="text-3xl font-bold text-red-400">{stats.totalUnsold}</div>
            <div className="text-sm text-gray-400">Unsold</div>
          </div>
          <div className="card text-center">
            <div className="text-3xl font-bold text-accent font-mono">{formatMoney(stats.totalSpent)}</div>
            <div className="text-sm text-gray-400">Total Spent</div>
          </div>
          <div className="card text-center">
            <div className="text-3xl font-bold text-accent font-mono">{formatMoney(stats.avgPrice)}</div>
            <div className="text-sm text-gray-400">Avg Price</div>
          </div>
        </div>
      )}

      {/* Highest/Lowest Sales */}
      {stats && (stats.highestSale || stats.lowestSale) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.highestSale && (
            <div className="card border-l-4 border-green-500">
              <div className="text-sm text-gray-400 mb-1">🏆 Highest Sale</div>
              <div className="text-xl font-bold">{stats.highestSale.player}</div>
              <div className="text-sm text-gray-400">
                to <span className="text-accent">{stats.highestSale.team}</span> for{' '}
                <span className="text-green-400 font-mono">{formatMoney(stats.highestSale.amount)}</span>
              </div>
            </div>
          )}
          {stats.lowestSale && stats.totalSold > 1 && (
            <div className="card border-l-4 border-orange-500">
              <div className="text-sm text-gray-400 mb-1">📉 Lowest Sale</div>
              <div className="text-xl font-bold">{stats.lowestSale.player}</div>
              <div className="text-sm text-gray-400">
                to <span className="text-accent">{stats.lowestSale.team}</span> for{' '}
                <span className="text-orange-400 font-mono">{formatMoney(stats.lowestSale.amount)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Team Spending Stats */}
      {stats && stats.teamStats.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Team Spending</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-4">Team</th>
                  <th className="text-right py-2 px-4">Spent</th>
                  <th className="text-right py-2 px-4">Players</th>
                  <th className="text-right py-2 px-4">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {stats.teamStats.map((team, idx) => (
                  <tr key={team.name} className={`border-b border-border/50 ${idx === 0 ? 'bg-accent/5' : ''}`}>
                    <td className="py-2 px-4 font-medium">
                      {idx === 0 && '👑 '}{team.name}
                    </td>
                    <td className="py-2 px-4 text-right font-mono text-accent">
                      {formatMoney(team.spent)}
                    </td>
                    <td className="py-2 px-4 text-right">{team.players}</td>
                    <td className="py-2 px-4 text-right font-mono text-gray-400">
                      {formatMoney(team.remaining)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Round Progress */}
      {rounds.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Round Progress</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rounds.map(round => {
              const progress = round.totalPlayers > 0 
                ? ((round.soldPlayers + (round.totalPlayers - round.pendingPlayers - round.soldPlayers)) / round.totalPlayers) * 100
                : 0;
              return (
                <div key={round.id} className="bg-surface-light rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Round {round.roundNumber}</span>
                    {round.isCompleted ? (
                      <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">Complete</span>
                    ) : round.isActive ? (
                      <span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded">Active</span>
                    ) : (
                      <span className="text-xs bg-gray-500/20 text-gray-400 px-2 py-1 rounded">Pending</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-400 mb-2">{round.name}</div>
                  <div className="w-full bg-surface rounded-full h-2 mb-2">
                    <div 
                      className="bg-accent h-2 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500">
                    {round.soldPlayers} sold • {round.totalPlayers - round.pendingPlayers - round.soldPlayers} unsold • {round.pendingPlayers} remaining
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Activity Log */}
      <div className="card">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <h2 className="text-xl font-semibold">Activity Log ({logs.length} total)</h2>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input py-1 px-3 text-sm w-40"
            />
            <select 
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
              className="select py-1 px-3 text-sm"
            >
              <option value="all">All Types</option>
              <option value="sale">Sales</option>
              <option value="unsold">Unsold</option>
              <option value="bid">Bids</option>
              <option value="start">Starts</option>
              <option value="pause">Pauses</option>
              <option value="stop">Stops</option>
            </select>
            <select 
              value={filterRound || ''} 
              onChange={(e) => setFilterRound(e.target.value ? parseInt(e.target.value) : null)}
              className="select py-1 px-3 text-sm"
            >
              <option value="">All Rounds</option>
              {rounds.map(r => (
                <option key={r.id} value={r.id}>Round {r.roundNumber}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {filteredLogs.length > 0 ? (
            filteredLogs.map(log => (
              <div key={log.id} className={`p-3 rounded-lg ${getLogTypeColor(log.logType)}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs mr-2 ${getLogTypeColor(log.logType)}`}>
                      {log.logType}
                    </span>
                    <span>{log.message}</span>
                  </div>
                  <div className="text-xs text-gray-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              No logs found matching your filters
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-border text-sm text-gray-500">
          Showing {filteredLogs.length} of {logs.length} logs
        </div>
      </div>
    </div>
  );
}
