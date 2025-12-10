import { db } from '@/db';
import { teams, players, trades, auctionLogs, auctionRounds } from '@/db/schema';
import { desc } from 'drizzle-orm';
import Link from 'next/link';

export const revalidate = 30;

export default async function DashboardPage() {
  const allTeams = await db.select().from(teams);
  const allPlayers = await db.select().from(players);
  const allTrades = await db.select().from(trades).orderBy(desc(trades.id)).limit(5);
  const recentLogs = await db.select().from(auctionLogs).orderBy(desc(auctionLogs.id)).limit(5);
  const rounds = await db.select().from(auctionRounds);

  const totalPlayers = allPlayers.length;
  const totalTrades = allTrades.length;
  const activeRound = rounds.find(r => r.isActive);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">League Dashboard</h1>
          <p className="text-gray-400">Real-time market analysis and roster tracking</p>
        </div>
        {activeRound && (
          <Link href="/auction" className="btn-primary flex items-center gap-2">
            <span className="animate-pulse">🔴</span>
            Live Auction
          </Link>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <div className="text-gray-400 text-sm mb-1">Total Franchises</div>
          <div className="text-3xl font-bold text-accent">{allTeams.length}</div>
        </div>
        <div className="card">
          <div className="text-gray-400 text-sm mb-1">Total Players</div>
          <div className="text-3xl font-bold">{totalPlayers}</div>
        </div>
        <div className="card">
          <div className="text-gray-400 text-sm mb-1">Total Trades</div>
          <div className="text-3xl font-bold">{totalTrades}</div>
        </div>
        <div className="card">
          <div className="text-gray-400 text-sm mb-1">Auction Rounds</div>
          <div className="text-3xl font-bold">{rounds.length}</div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Activity */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Recent Auction Activity</h2>
          {recentLogs.length > 0 ? (
            <div className="space-y-3">
              {recentLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-3 bg-surface-light rounded-lg">
                  <span className={`text-lg ${
                    log.logType === 'sale' ? 'text-green-400' :
                    log.logType === 'unsold' ? 'text-red-400' :
                    'text-yellow-400'
                  }`}>
                    {log.logType === 'sale' ? '💰' :
                     log.logType === 'unsold' ? '❌' :
                     log.logType === 'start' ? '▶️' :
                     log.logType === 'pause' ? '⏸️' :
                     log.logType === 'resume' ? '▶️' :
                     '🛑'}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm">{log.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(log.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No auction activity yet</p>
          )}
        </div>

        {/* Recent Trades */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Recent Trades</h2>
          {allTrades.length > 0 ? (
            <div className="space-y-3">
              {allTrades.map((trade) => {
                const players1 = JSON.parse(trade.players1);
                const players2 = JSON.parse(trade.players2);
                return (
                  <div key={trade.id} className="p-3 bg-surface-light rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-accent">{trade.team1Name}</span>
                      <span className="text-gray-500">↔</span>
                      <span className="font-medium text-accent">{trade.team2Name}</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {players1.join(', ')} ↔ {players2.join(', ')}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(trade.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No trades yet</p>
          )}
        </div>
      </div>

      {/* Franchise Overview */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Franchise Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allTeams.map((team) => {
            const teamPlayers = allPlayers.filter(p => p.teamId === team.id);
            const rosterPercent = (teamPlayers.length / team.maxSize) * 100;
            return (
              <div key={team.id} className="p-4 bg-surface-light rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{team.name}</span>
                  <span className="text-sm text-accent font-mono">
                    ${(team.purse / 1000000).toFixed(1)}M
                  </span>
                </div>
                <div className="w-full bg-background rounded-full h-2">
                  <div 
                    className="bg-accent h-2 rounded-full transition-all"
                    style={{ width: `${rosterPercent}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {teamPlayers.length}/{team.maxSize} players
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
