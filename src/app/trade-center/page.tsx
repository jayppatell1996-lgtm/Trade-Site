'use client';

import { useState, useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { ArrowLeftRight, Check, AlertCircle, Lock, LogIn } from 'lucide-react';

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
  const { data: session, status } = useSession();
  const [teams, setTeams] = useState<Team[]>([]);
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [targetTeam, setTargetTeam] = useState<Team | null>(null);
  const [selectedPlayers1, setSelectedPlayers1] = useState<string[]>([]);
  const [selectedPlayers2, setSelectedPlayers2] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const userDiscordId = (session?.user as any)?.discordId;

  useEffect(() => {
    fetch('/api/teams')
      .then(res => res.json())
      .then(data => {
        setTeams(data);
        setLoading(false);
        
        // Auto-select user's team if they own one
        if (userDiscordId) {
          const ownedTeam = data.find((t: Team) => t.ownerId === userDiscordId);
          if (ownedTeam) {
            setMyTeam(ownedTeam);
          }
        }
      });
  }, [userDiscordId]);

  // Get teams owned by the current user
  const myTeams = teams.filter(t => t.ownerId === userDiscordId);
  
  // Get teams available for trading (not owned by user)
  const otherTeams = teams.filter(t => t.ownerId !== userDiscordId && t.name !== myTeam?.name);

  const handleMyTeamSelect = (teamName: string) => {
    const team = teams.find(t => t.name === teamName) || null;
    setMyTeam(team);
    setSelectedPlayers1([]);
    setMessage(null);
  };

  const handleTargetTeamSelect = (teamName: string) => {
    const team = teams.find(t => t.name === teamName) || null;
    setTargetTeam(team);
    setSelectedPlayers2([]);
    setMessage(null);
  };

  const togglePlayer = (playerId: string, isMyTeam: boolean) => {
    if (isMyTeam) {
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
    if (!myTeam || !targetTeam || selectedPlayers1.length === 0 || selectedPlayers2.length === 0) {
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
          team1Name: myTeam.name,
          team2Name: targetTeam.name,
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
        setMyTeam(teamsData.find((t: Team) => t.name === myTeam.name) || null);
        setTargetTeam(teamsData.find((t: Team) => t.name === targetTeam.name) || null);
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

  const canTrade = myTeam && targetTeam && myTeam.name !== targetTeam.name && 
                   selectedPlayers1.length > 0 && selectedPlayers2.length > 0;

  // Not logged in
  if (status === 'unauthenticated') {
    return (
      <div className="container" style={{ paddingTop: '60px', maxWidth: '500px' }}>
        <div className="card" style={{ textAlign: 'center', padding: '60px 40px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            background: 'var(--bg-tertiary)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
          }}>
            <Lock size={36} style={{ color: 'var(--text-muted)' }} />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>
            Authentication Required
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', lineHeight: 1.6 }}>
            You must sign in with Discord to propose trades. Only team owners can trade their players.
          </p>
          <button
            onClick={() => signIn('discord')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: '14px 28px',
              background: '#5865F2',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <LogIn size={20} />
            Sign in with Discord
          </button>
        </div>
      </div>
    );
  }

  // Loading
  if (status === 'loading' || loading) {
    return (
      <div className="container" style={{ paddingTop: '32px', textAlign: 'center' }}>
        <p className="loading">Loading...</p>
      </div>
    );
  }

  // User doesn't own any team
  if (myTeams.length === 0) {
    return (
      <div className="container" style={{ paddingTop: '60px', maxWidth: '500px' }}>
        <div className="card" style={{ textAlign: 'center', padding: '60px 40px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            background: 'rgba(255, 149, 0, 0.1)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            border: '1px solid rgba(255, 149, 0, 0.3)',
          }}>
            <AlertCircle size={36} style={{ color: 'var(--accent-orange)' }} />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>
            No Team Ownership
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.6 }}>
            Your Discord account (<strong>{session?.user?.name}</strong>) is not registered as an owner of any team in the league.
          </p>
          <p style={{ 
            color: 'var(--text-muted)', 
            fontSize: '13px',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            Discord ID: {userDiscordId}
          </p>
        </div>
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
          Propose transactions between franchises. You can only trade players from teams you own.
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
        <div className="card">
          <div style={{ 
            fontSize: '12px', 
            fontWeight: 600, 
            marginBottom: '12px',
            color: 'var(--accent-green)',
            letterSpacing: '1px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            YOUR TEAM
            <span style={{ 
              fontSize: '10px', 
              color: 'var(--text-muted)',
              fontWeight: 400,
            }}>
              (Teams you own)
            </span>
          </div>
          
          <select
            value={myTeam?.name || ''}
            onChange={(e) => handleMyTeamSelect(e.target.value)}
            style={{ marginBottom: '16px' }}
          >
            <option value="">Select Your Team</option>
            {myTeams.map(team => (
              <option key={team.id} value={team.name}>{team.name}</option>
            ))}
          </select>

          <PlayerList 
            team={myTeam}
            selectedPlayers={selectedPlayers1}
            onPlayerToggle={(id) => togglePlayer(id, true)}
          />
        </div>

        {/* Arrow */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div className="trade-arrow">
            <ArrowLeftRight size={20} />
          </div>
        </div>

        {/* Target Team */}
        <div className="card">
          <div style={{ 
            fontSize: '12px', 
            fontWeight: 600, 
            marginBottom: '12px',
            color: 'var(--accent-orange)',
            letterSpacing: '1px',
          }}>
            TARGET TEAM
          </div>
          
          <select
            value={targetTeam?.name || ''}
            onChange={(e) => handleTargetTeamSelect(e.target.value)}
            style={{ marginBottom: '16px' }}
          >
            <option value="">Select Target Team</option>
            {otherTeams.map(team => (
              <option key={team.id} value={team.name}>{team.name}</option>
            ))}
          </select>

          <PlayerList 
            team={targetTeam}
            selectedPlayers={selectedPlayers2}
            onPlayerToggle={(id) => togglePlayer(id, false)}
          />
        </div>
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
              OFFERING ({myTeam?.name || '—'})
            </div>
            {selectedPlayers1.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {selectedPlayers1.map(id => {
                  const player = myTeam?.players.find(p => p.playerId === id);
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
              REQUESTING ({targetTeam?.name || '—'})
            </div>
            {selectedPlayers2.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {selectedPlayers2.map(id => {
                  const player = targetTeam?.players.find(p => p.playerId === id);
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
          {submitting ? 'Processing...' : 'EXECUTE TRADE'}
        </button>
      </div>
    </div>
  );
}

function PlayerList({
  team,
  selectedPlayers,
  onPlayerToggle,
}: {
  team: Team | null;
  selectedPlayers: string[];
  onPlayerToggle: (id: string) => void;
}) {
  return (
    <div style={{ 
      minHeight: '200px',
      maxHeight: '300px',
      overflowY: 'auto',
      background: 'var(--bg-secondary)',
      borderRadius: '8px',
      padding: '16px',
      border: '1px dashed var(--border-color)',
    }}>
      {team ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {team.players.map(player => (
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
  );
}
