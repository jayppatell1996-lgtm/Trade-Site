'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface AuctionLog {
  id: number;
  roundId: number | null;
  message: string;
  logType: string | null;
  timestamp: string;
}

interface Team {
  id: number;
  name: string;
  ownerId: string;
  purse: number;
  maxSize: number;
}

interface Player {
  id: number;
  name: string;
  teamId: number;
  boughtFor: number | null;
  category: string | null;
}

interface AuctionRound {
  id: number;
  roundNumber: number;
  name: string;
  isActive: number;
  isCompleted: number;
}

interface Stats {
  totalPlayersSold: number;
  totalAmountSpent: number;
  averageSalePrice: number;
  highestSale: { player: string; team: string; amount: number } | null;
  lowestSale: { player: string; team: string; amount: number } | null;
  mostActiveTeam: { name: string; purchases: number } | null;
  biggestSpender: { name: string; spent: number } | null;
  teamStats: { name: string; players: number; spent: number; purse: number }[];
}

export default function AuctionSummaryPage() {
  const [logs, setLogs] = useState<AuctionLog[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [rounds, setRounds] = useState<AuctionRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterRound, setFilterRound] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [logsRes, teamsRes, roundsRes] = await Promise.all([
        fetch('/api/auction/logs'),
        fetch('/api/teams'),
        fetch('/api/auction/rounds'),
      ]);

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData.logs || []);
      }

      if (teamsRes.ok) {
        const teamsData = await teamsRes.json();
        setTeams(teamsData.teams || []);
        setPlayers(teamsData.players || []);
      }

      if (roundsRes.ok) {
        const roundsData = await roundsRes.json();
        setRounds(roundsData.rounds || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const calculateStats = (): Stats => {
    const saleLogs = logs.filter(l => l.logType === 'sale');
    const teamPurchases: Record<string, { count: number; spent: number }> = {};

    let highestSale: Stats['highestSale'] = null;
    let lowestSale: Stats['lowestSale'] = null;
    let totalSpent = 0;

    saleLogs.forEach(log => {
      // Parse "Player sold to Team for $X"
      const match = log.message.match(/(.+) sold to (.+) for \$?([\d,]+)/i);
      if (match) {
        const [, player, team, amountStr] = match;
        const amount = parseFloat(amountStr.replace(/,/g, ''));
        
        totalSpent += amount;

        if (!teamPurchases[team]) {
          teamPurchases[team] = { count: 0, spent: 0 };
        }
        teamPurchases[team].count++;
        teamPurchases[team].spent += amount;

        if (!highestSale || amount > highestSale.amount) {
          highestSale = { player, team, amount };
        }
        if (!lowestSale || amount < lowestSale.amount) {
          lowestSale = { player, team, amount };
        }
      }
    });

    const teamStats = teams.map(team => {
      const teamPlayers = players.filter(p => p.teamId === team.id);
      const spent = teamPlayers.reduce((sum, p) => sum + (p.boughtFor || 0), 0);
      return {
        name: team.name,
        players: teamPlayers.length,
        spent,
        purse: team.purse,
      };
    }).sort((a, b) => b.spent - a.spent);

    const mostActive = Object.entries(teamPurchases)
      .sort((a, b) => b[1].count - a[1].count)[0];
    const biggestSpender = Object.entries(teamPurchases)
      .sort((a, b) => b[1].spent - a[1].spent)[0];

    return {
      totalPlayersSold: saleLogs.length,
      totalAmountSpent: totalSpent,
      averageSalePrice: saleLogs.length > 0 ? totalSpent / saleLogs.length : 0,
      highestSale,
      lowestSale,
      mostActiveTeam: mostActive ? { name: mostActive[0], purchases: mostActive[1].count } : null,
      biggestSpender: biggestSpender ? { name: biggestSpender[0], spent: biggestSpender[1].spent } : null,
      teamStats,
    };
  };

  const stats = calculateStats();

  // Filter logs
  const filteredLogs = logs.filter(log => {
    if (filterType !== 'all' && log.logType !== filterType) return false;
    if (filterRound !== 'all' && log.roundId !== filterRound) return false;
    if (searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const formatAmount = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(2)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`;
    }
    return `$${amount.toFixed(0)}`;
  };

  const getLogIcon = (type: string | null) => {
    switch (type) {
      case 'sale': return '💰';
      case 'unsold': return '❌';
      case 'bid': return '🔨';
      case 'start': return '▶️';
      case 'pause': return '⏸️';
      case 'resume': return '▶️';
      case 'stop': return '🛑';
      default: return '📝';
    }
  };

  const getLogColor = (type: string | null) => {
    switch (type) {
      case 'sale': return 'text-green-400';
      case 'unsold': return 'text-red-400';
      case 'bid': return 'text-yellow-400';
      case 'start': return 'text-blue-400';
      case 'pause': return 'text-orange-400';
      case 'resume': return 'text-blue-400';
      case 'stop': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-accent mx-auto mb-4" />
          <p className="text-gray-400">Loading auction data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Auction Summary</h1>
          <p className="text-gray-400">Complete auction history and statistics</p>
        </div>
        <Link href="/auction" className="btn-secondary">
          ← Back to Auction
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <div className="text-4xl font-bold text-accent">{stats.totalPlayersSold}</div>
          <div className="text-sm text-gray-400 mt-1">Players Sold</div>
        </div>
        <div className="card text-center">
          <div className="text-4xl font-bold text-green-400">{formatAmount(stats.totalAmountSpent)}</div>
          <div className="text-sm text-gray-400 mt-1">Total Spent</div>
        </div>
        <div className="card text-center">
          <div className="text-4xl font-bold text-yellow-400">{formatAmount(stats.averageSalePrice)}</div>
          <div className="text-sm text-gray-400 mt-1">Avg Sale Price</div>
        </div>
        <div className="card text-center">
          <div className="text-4xl font-bold text-purple-400">{logs.length}</div>
          <div className="text-sm text-gray-400 mt-1">Total Events</div>
        </div>
      </div>

      {/* Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.highestSale && (
          <div className="card bg-gradient-to-br from-yellow-500/10 to-transparent border-yellow-500/30">
            <div className="text-sm text-yellow-400 mb-2">🏆 Highest Sale</div>
            <div className="font-bold text-lg">{stats.highestSale.player}</div>
            <div className="text-sm text-gray-400">
              to {stats.highestSale.team} for <span className="text-accent">{formatAmount(stats.highestSale.amount)}</span>
            </div>
          </div>
        )}
        {stats.lowestSale && (
          <div className="card bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/30">
            <div className="text-sm text-blue-400 mb-2">💎 Best Value</div>
            <div className="font-bold text-lg">{stats.lowestSale.player}</div>
            <div className="text-sm text-gray-400">
              to {stats.lowestSale.team} for <span className="text-accent">{formatAmount(stats.lowestSale.amount)}</span>
            </div>
          </div>
        )}
        {stats.mostActiveTeam && (
          <div className="card bg-gradient-to-br from-green-500/10 to-transparent border-green-500/30">
            <div className="text-sm text-green-400 mb-2">🔥 Most Active</div>
            <div className="font-bold text-lg">{stats.mostActiveTeam.name}</div>
            <div className="text-sm text-gray-400">
              {stats.mostActiveTeam.purchases} purchases
            </div>
          </div>
        )}
        {stats.biggestSpender && (
          <div className="card bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/30">
            <div className="text-sm text-purple-400 mb-2">💸 Biggest Spender</div>
            <div className="font-bold text-lg">{stats.biggestSpender.name}</div>
            <div className="text-sm text-gray-400">
              spent <span className="text-accent">{formatAmount(stats.biggestSpender.spent)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Team Leaderboard */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">📊 Team Leaderboard</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-400 text-sm border-b border-border">
                <th className="pb-3 pr-4">#</th>
                <th className="pb-3 pr-4">Team</th>
                <th className="pb-3 pr-4 text-right">Players</th>
                <th className="pb-3 pr-4 text-right">Spent</th>
                <th className="pb-3 text-right">Purse Left</th>
              </tr>
            </thead>
            <tbody>
              {stats.teamStats.map((team, index) => (
                <tr key={team.name} className="border-b border-border/50 hover:bg-surface-light transition-colors">
                  <td className="py-3 pr-4 text-gray-500">{index + 1}</td>
                  <td className="py-3 pr-4 font-medium">{team.name}</td>
                  <td className="py-3 pr-4 text-right">{team.players}</td>
                  <td className="py-3 pr-4 text-right text-green-400">{formatAmount(team.spent)}</td>
                  <td className="py-3 text-right text-accent">{formatAmount(team.purse)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Auction Logs */}
      <div className="card">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
          <h2 className="text-xl font-semibold">📜 Auction Log</h2>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input text-sm px-3 py-1.5"
            />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="select text-sm px-3 py-1.5"
            >
              <option value="all">All Types</option>
              <option value="sale">Sales</option>
              <option value="unsold">Unsold</option>
              <option value="bid">Bids</option>
              <option value="start">Start</option>
              <option value="pause">Pause/Resume</option>
              <option value="stop">Stop</option>
            </select>
            <select
              value={filterRound}
              onChange={(e) => setFilterRound(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
              className="select text-sm px-3 py-1.5"
            >
              <option value="all">All Rounds</option>
              {rounds.map(round => (
                <option key={round.id} value={round.id}>Round {round.roundNumber}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-sm text-gray-400 mb-4">
          Showing {filteredLogs.length} of {logs.length} entries
        </div>

        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">📭</div>
              <p>No logs found</p>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3 bg-surface-light rounded-lg hover:bg-surface transition-colors"
              >
                <span className="text-lg">{getLogIcon(log.logType)}</span>
                <div className="flex-1 min-w-0">
                  <p className={`${getLogColor(log.logType)}`}>{log.message}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    <span>{new Date(log.timestamp).toLocaleString()}</span>
                    {log.roundId && (
                      <>
                        <span>•</span>
                        <span>Round {rounds.find(r => r.id === log.roundId)?.roundNumber || log.roundId}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-gray-500 pt-8">
        Built for Wispbyte Server. Powered by Discord.
      </div>
    </div>
  );
}
