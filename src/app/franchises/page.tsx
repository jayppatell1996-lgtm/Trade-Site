'use client';

import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';

type Player = {
  id: number;
  playerId: string;
  name: string;
};

type Team = {
  id: number;
  name: string;
  ownerId: string;
  maxSize: number;
  players: Player[];
};

export default function Franchises() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/teams')
      .then(res => res.json())
      .then(data => {
        setTeams(data);
        setLoading(false);
      });
  }, []);

  const filteredTeams = teams.filter(team => {
    const searchLower = search.toLowerCase();
    return (
      team.name.toLowerCase().includes(searchLower) ||
      team.players.some(p => 
        p.name.toLowerCase().includes(searchLower) ||
        p.playerId.toLowerCase().includes(searchLower)
      )
    );
  });

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: '32px', textAlign: 'center' }}>
        <p className="loading">Loading franchises...</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: '32px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '32px',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        <div>
          <h1 style={{ 
            fontSize: '32px', 
            fontWeight: 700, 
            marginBottom: '8px',
            letterSpacing: '-0.5px',
          }}>
            LEAGUE FRANCHISES
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            View active rosters and contracts.
          </p>
        </div>
        
        <div style={{ position: 'relative', width: '300px' }}>
          <Search 
            size={18} 
            style={{ 
              position: 'absolute', 
              left: '14px', 
              top: '50%', 
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }} 
          />
          <input
            type="text"
            placeholder="Search teams or players..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '44px' }}
          />
        </div>
      </div>

      {/* Teams Grid */}
      <div className="teams-grid">
        {filteredTeams.map(team => (
          <TeamCard key={team.id} team={team} search={search} />
        ))}
      </div>

      {filteredTeams.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
          <p style={{ color: 'var(--text-muted)' }}>No teams or players match your search.</p>
        </div>
      )}
    </div>
  );
}

function TeamCard({ team, search }: { team: Team; search: string }) {
  const percentage = Math.round((team.players.length / team.maxSize) * 100);
  const searchLower = search.toLowerCase();

  return (
    <div className="card fade-in">
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            background: 'var(--accent-green)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--bg-primary)',
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 700,
            fontSize: '14px',
          }}>
            {team.name}
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>{team.name}</div>
            <div style={{ 
              fontSize: '11px', 
              color: 'var(--text-muted)',
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              ID: {team.ownerId.slice(0, 8)}...
            </div>
          </div>
        </div>
        <div className="badge badge-success">
          {team.players.length}/{team.maxSize}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="progress-bar" style={{ marginBottom: '16px' }}>
        <div className="progress-bar-fill" style={{ width: `${percentage}%` }} />
      </div>

      {/* Player List */}
      <div style={{ 
        maxHeight: '280px', 
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}>
        {team.players.map((player, index) => {
          const isMatch = search && (
            player.name.toLowerCase().includes(searchLower) ||
            player.playerId.toLowerCase().includes(searchLower)
          );

          return (
            <div 
              key={player.playerId}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                borderRadius: '6px',
                background: isMatch ? 'var(--accent-green-glow)' : 'transparent',
                border: isMatch ? '1px solid var(--accent-green)' : '1px solid transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ 
                  color: 'var(--text-muted)', 
                  fontSize: '12px',
                  fontFamily: 'JetBrains Mono, monospace',
                  width: '20px',
                }}>
                  {index + 1}
                </span>
                <span style={{ fontSize: '14px' }}>{player.name}</span>
              </div>
              <span className="player-id">{player.playerId}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
