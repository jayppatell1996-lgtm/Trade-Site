import { getLeagueStats, getRecentTrades } from '@/lib/queries';
import { Users, Zap, TrendingUp, ArrowUpRight, ArrowLeftRight } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

function StatCard({ 
  label, 
  value, 
  subtitle, 
  icon: Icon 
}: { 
  label: string; 
  value: string | number; 
  subtitle: string; 
  icon: any;
}) {
  return (
    <div className="card stat-card">
      <div className="stat-label">
        {label}
        <Icon size={20} style={{ color: 'var(--accent-green)' }} />
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-subtitle">{subtitle}</div>
    </div>
  );
}

function FranchiseStatus({ 
  name, 
  playerCount, 
  maxSize 
}: { 
  name: string; 
  playerCount: number; 
  maxSize: number;
}) {
  const percentage = Math.round((playerCount / maxSize) * 100);
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      padding: '12px 0',
      borderBottom: '1px solid var(--border-color)',
    }}>
      <div className="badge badge-team">{name}</div>
      <div style={{ flex: 1 }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginBottom: '6px',
          fontSize: '13px',
        }}>
          <span style={{ color: 'var(--text-secondary)' }}>{playerCount} Players</span>
          <span style={{ color: 'var(--text-muted)' }}>{percentage}% Cap</span>
        </div>
        <div className="progress-bar">
          <div 
            className="progress-bar-fill" 
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function TradeCard({ 
  trade 
}: { 
  trade: {
    timestamp: string;
    team1Name: string;
    team2Name: string;
    players1: { id: string; name: string }[];
    players2: { id: string; name: string }[];
  };
}) {
  const date = new Date(trade.timestamp);
  const dateStr = date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
  const timeStr = date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });

  return (
    <div className="card" style={{ marginBottom: '12px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
      }}>
        <span style={{ 
          fontFamily: 'JetBrains Mono, monospace', 
          fontSize: '13px',
          color: 'var(--text-muted)',
        }}>
          {dateStr} • {timeStr}
        </span>
        <span className="badge badge-success">COMPLETED</span>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Team 1 sending */}
        <div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            marginBottom: '8px',
          }}>
            <span className="badge badge-team">{trade.team1Name}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>sent</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {trade.players1.map(p => (
              <div key={p.id} className="player-chip outgoing">
                <span style={{ color: 'var(--accent-red)' }}>−</span>
                {p.name}
              </div>
            ))}
          </div>
        </div>

        <div className="trade-arrow">
          <ArrowLeftRight size={18} />
        </div>

        {/* Team 2 sending */}
        <div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            marginBottom: '8px',
          }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>sent</span>
            <span className="badge badge-team">{trade.team2Name}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {trade.players2.map(p => (
              <div key={p.id} className="player-chip incoming">
                <span style={{ color: 'var(--accent-green)' }}>+</span>
                {p.name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function Dashboard() {
  const stats = await getLeagueStats();
  const recentTrades = await getRecentTrades(5);

  return (
    <div className="container" style={{ paddingTop: '32px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '32px',
      }}>
        <div>
          <h1 style={{ 
            fontSize: '32px', 
            fontWeight: 700, 
            marginBottom: '8px',
            letterSpacing: '-0.5px',
          }}>
            LEAGUE DASHBOARD
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Real-time market analysis and roster tracking.
          </p>
        </div>
        <Link href="/trade-center" className="btn btn-primary">
          <ArrowUpRight size={18} />
          NEW TRADE PROPOSAL
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid" style={{ marginBottom: '32px' }}>
        <StatCard 
          label="Active Franchises" 
          value={stats.totalTeams}
          subtitle="Teams competing this season"
          icon={Users}
        />
        <StatCard 
          label="Player Pool" 
          value={stats.totalPlayers}
          subtitle="Total active contracts"
          icon={Zap}
        />
        <StatCard 
          label="Market Volume" 
          value={stats.totalTrades}
          subtitle="Completed transactions"
          icon={TrendingUp}
        />
      </div>

      {/* Main Content Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 400px',
        gap: '24px',
      }}>
        {/* Recent Market Activity */}
        <div>
          <h2 style={{ 
            fontSize: '14px', 
            fontWeight: 600, 
            marginBottom: '16px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color: 'var(--text-secondary)',
          }}>
            Recent Market Activity
          </h2>
          {recentTrades.length > 0 ? (
            recentTrades.map(trade => (
              <TradeCard key={trade.id} trade={trade} />
            ))
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ color: 'var(--text-muted)' }}>No trades yet</p>
            </div>
          )}
        </div>

        {/* Franchise Status */}
        <div>
          <h2 style={{ 
            fontSize: '14px', 
            fontWeight: 600, 
            marginBottom: '16px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color: 'var(--text-secondary)',
          }}>
            Franchise Status
          </h2>
          <div className="card">
            {stats.teams
              .sort((a, b) => b.playerCount - a.playerCount)
              .map(team => (
                <FranchiseStatus 
                  key={team.id}
                  name={team.name}
                  playerCount={team.playerCount}
                  maxSize={team.maxSize}
                />
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
}
