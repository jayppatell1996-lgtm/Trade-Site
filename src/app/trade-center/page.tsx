'use client';

import { useState, useEffect } from 'react';
import { ArrowLeftRight, X, Check, AlertCircle } from 'lucide-react';

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

export default function TradeCenter() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [team1, setTeam1] = useState<Team | null>(null);
  const [team2, setTeam2] = useState<Team | null>(null);
  const [selectedPlayers1, setSelectedPlayers1] = useState<string[]>([]);
  const [selectedPlayers2, setSelectedPlayers2] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/teams')
      .then(res => res.json())
      .then(data => {
        setTeams(data);
        setLoading(false);
      });
  }, []);

  const handleTeamSelect = (teamName: string, isTeam1: boolean) => {
    const team = teams.find(t => t.name === teamName) || null;
    if (isTeam1) {
      setTeam1(team);
      setSelectedPlayers1([]);
    } else {
      setTeam2(team);
      setSelectedPlayers2([]);
    }
    setMessage(null);
  };

  const togglePlayer = (playerId: string, isTeam1: boolean) => {
    if (isTeam1) {
      setSelectedPlayers1(prev => 
        prev.includes(playerId) 
          ? prev.filter(id => id !== playerId)
          : prev.length < 5 ? [...prev, playerId] : prev
      );
    } else {
      setSelectedPlayers2(prev => 
        prev.includes(playerId) 
          ? prev.filter(id => id !== playerId)
          : prev.length < 5 ? [...prev, playerId] : prev
      );
    }
    setMessage(null);
  };

  const handleSubmit = async () => {
    if (!team1 || !team2 || selectedPlayers1.length === 0 || selectedPlayers2.length === 0) {
      setMessage({ type: 'error', text: 'Please select teams and at least one player from each side' });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team1Name: team1.name,
          team2Name: team2.name,
          player1Ids: selectedPlayers1,
          player2Ids: selectedPlayers2,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Trade completed successfully!' });
        // Refresh teams data
        const teamsRes = await fetch('/api/teams');
        const teamsData = await teamsRes.json();
        setTeams(teamsData);
        setTeam1(teamsData.find((t: Team) => t.name === team1.name) || null);
        setTeam2(teamsData.find((t: Team) => t.name === team2.name) || null);
        setSelectedPlayers1([]);
        setSelectedPlayers2([]);
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch {
      setMessage({ type: 'error', text: 'An error occurred' });
    }

    setSubmitting(false);
  };

  const canTrade = team1 && team2 && team1.name !== team2.name && 
                   selectedPlayers1.length > 0 && selectedPlayers2.length > 0;

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: '32px', textAlign: 'center' }}>
        <p className="loading">Loading teams...</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: '32px', maxWidth: '900px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ 
          fontSize: '32px', 
          fontWeight: 700, 
          marginBottom: '8px',
          letterSpacing: '-0.5px',
        }}>
          TRADE CENTER
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Propose transactions between franchises.
        </p>
      </div>

      {/* Message */}
      {message && (
        <div 
          className="card fade-in"
          style={{ 
            marginBottom: '24px',
            borderColor: message.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)',
            background: message.type === 'success' ? 'var(--accent-green-glow)' : 'rgba(255,68,68,0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {message.type === 'success' ? (
              <Check size={20} style={{ color: 'var(--accent-green)' }} />
            ) : (
              <AlertCircle size={20} style={{ color: 'var(--accent-red)' }} />
            )}
            <span>{message.text}</span>
          </div>
        </div>
      )}

      {/* Team Selection Panels */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Your Team */}
        <TeamPanel
          label="YOUR TEAM"
          labelColor="var(--accent-green)"
          teams={teams.filter(t => t.name !== team2?.name)}
          selectedTeam={team1}
          selectedPlayers={selectedPlayers1}
          onTeamSelect={(name) => handleTeamSelect(name, true)}
          onPlayerToggle={(id) => togglePlayer(id, true)}
        />

        {/* Arrow */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div className="trade-arrow">
            <ArrowLeftRight size={20} />
          </div>
        </div>

        {/* Target Team */}
        <TeamPanel
          label="TARGET TEAM"
          labelColor="var(--accent-orange)"
          teams={teams.filter(t => t.name !== team1?.name)}
          selectedTeam={team2}
          selectedPlayers={selectedPlayers2}
          onTeamSelect={(name) => handleTeamSelect(name, false)}
          onPlayerToggle={(id) => togglePlayer(id, false)}
        />
      </div>

      {/* Trade Summary */}
      <div className="card" style={{ marginTop: '24px' }}>
        <h3 style={{ 
          fontSize: '14px', 
          fontWeight: 600, 
          marginBottom: '16px',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          color: 'var(--text-secondary)',
        }}>
          Trade Summary
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Review the transaction details before proposing.
        </p>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
              OFFERING
            </div>
            {selectedPlayers1.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {selectedPlayers1.map(id => {
                  const player = team1?.players.find(p => p.playerId === id);
                  return player ? (
                    <span key={id} className="player-chip outgoing">
                      {player.name}
                    </span>
                  ) : null;
                })}
              </div>
            ) : (
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No players offered
              </span>
            )}
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
              REQUESTING
            </div>
            {selectedPlayers2.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {selectedPlayers2.map(id => {
                  const player = team2?.players.find(p => p.playerId === id);
                  return player ? (
                    <span key={id} className="player-chip incoming">
                      {player.name}
                    </span>
                  ) : null;
                })}
              </div>
            ) : (
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No players requested
              </span>
            )}
          </div>
        </div>

        <button 
          className="btn btn-primary" 
          style={{ width: '100%' }}
          disabled={!canTrade || submitting}
          onClick={handleSubmit}
        >
          {submitting ? 'Processing...' : 'PROPOSE TRADE'}
        </button>
      </div>
    </div>
  );
}

function TeamPanel({
  label,
  labelColor,
  teams,
  selectedTeam,
  selectedPlayers,
  onTeamSelect,
  onPlayerToggle,
}: {
  label: string;
  labelColor: string;
  teams: Team[];
  selectedTeam: Team | null;
  selectedPlayers: string[];
  onTeamSelect: (name: string) => void;
  onPlayerToggle: (id: string) => void;
}) {
  return (
    <div className="card">
      <div style={{ 
        fontSize: '12px', 
        fontWeight: 600, 
        marginBottom: '12px',
        color: labelColor,
        letterSpacing: '1px',
      }}>
        {label}
      </div>
      
      <select
        value={selectedTeam?.name || ''}
        onChange={(e) => onTeamSelect(e.target.value)}
        style={{ marginBottom: '16px' }}
      >
        <option value="">Select Team</option>
        {teams.map(team => (
          <option key={team.id} value={team.name}>{team.name}</option>
        ))}
      </select>

      <div style={{ 
        minHeight: '200px',
        background: 'var(--bg-secondary)',
        borderRadius: '8px',
        padding: '16px',
        border: '1px dashed var(--border-color)',
      }}>
        {selectedTeam ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {selectedTeam.players.map(player => (
              <div
                key={player.playerId}
                onClick={() => onPlayerToggle(player.playerId)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: selectedPlayers.includes(player.playerId) 
                    ? 'var(--accent-green-glow)' 
                    : 'var(--bg-tertiary)',
                  border: `1px solid ${selectedPlayers.includes(player.playerId) 
                    ? 'var(--accent-green)' 
                    : 'var(--border-color)'}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span>{player.name}</span>
                  <span className="player-id">{player.playerId}</span>
                </div>
                {selectedPlayers.includes(player.playerId) && (
                  <Check size={16} style={{ color: 'var(--accent-green)' }} />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-muted)',
            fontSize: '14px',
          }}>
            Select a team to view roster
          </div>
        )}
      </div>
    </div>
  );
}
