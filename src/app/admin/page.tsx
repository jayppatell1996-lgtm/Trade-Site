'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ADMIN_IDS } from '@/lib/auth';

interface Team {
  id: number;
  name: string;
  ownerId: string;
  ownerName: string | null;
  maxSize: number;
  purse: number;
}

interface Player {
  id: number;
  playerId: string;
  name: string;
  teamId: number;
  category: string | null;
}

interface Round {
  id: number;
  roundNumber: number;
  name: string;
  isActive: boolean;
  isCompleted: boolean;
}

interface AuctionPlayer {
  id: number;
  roundId: number;
  name: string;
  category: string;
  basePrice: number;
  status: string;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'teams' | 'rounds' | 'upload'>('teams');
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [auctionPlayers, setAuctionPlayers] = useState<AuctionPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit states
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [newPlayer, setNewPlayer] = useState({ teamId: 0, playerId: '', name: '', category: '' });
  const [newTeam, setNewTeam] = useState({ name: '', ownerId: '', maxSize: 20, purse: 50000000 });
  const [showCreateTeam, setShowCreateTeam] = useState(false);

  // Upload states
  const [uploadType, setUploadType] = useState<'teams' | 'round' | 'unsold'>('teams');
  const [roundNumber, setRoundNumber] = useState(1);
  const [roundName, setRoundName] = useState('');
  const [fileContent, setFileContent] = useState('');

  const isAdmin = session?.user?.discordId && ADMIN_IDS.includes(session.user.discordId);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session || !isAdmin) {
      router.push('/');
      return;
    }
    fetchData();
  }, [session, status, isAdmin, router]);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/admin');
      const data = await res.json();
      if (res.ok) {
        setTeams(data.teams);
        setPlayers(data.players);
        setRounds(data.rounds);
        setAuctionPlayers(data.auctionPlayers);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      
      if (file.name.endsWith('.json')) {
        setFileContent(content);
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
        setMessage({ type: 'error', text: 'Spreadsheet parsing coming soon. Please use JSON format.' });
      }
    };
    reader.readAsText(file);
  };

  const processUpload = async () => {
    if (!fileContent) {
      setMessage({ type: 'error', text: 'Please select a file first' });
      return;
    }

    try {
      const parsedData = JSON.parse(fileContent);
      let action = '';
      let data: any = {};

      switch (uploadType) {
        case 'teams':
          action = 'import_teams';
          data = parsedData;
          break;
        case 'round':
          action = 'import_auction_round';
          data = {
            roundNumber,
            name: roundName || `Round ${roundNumber}`,
            players: parsedData.players_for_auction || parsedData,
          };
          break;
        case 'unsold':
          action = 'import_unsold';
          data = parsedData.unsold || parsedData;
          break;
      }

      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, data }),
      });

      const result = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: result.message });
        setFileContent('');
        fetchData();
      } else {
        setMessage({ type: 'error', text: result.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Invalid JSON format' });
    }
  };

  const updateTeam = async () => {
    if (!editingTeam) return;

    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_team',
          data: editingTeam,
        }),
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Team updated' });
        setEditingTeam(null);
        fetchData();
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update team' });
    }
  };

  const deleteTeam = async (teamId: number, teamName: string) => {
    if (!confirm(`Are you sure you want to DELETE team "${teamName}"?\n\nThis will permanently remove the team and ALL its players. This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_team',
          data: { teamId },
        }),
      });

      const result = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: result.message });
        fetchData();
      } else {
        setMessage({ type: 'error', text: result.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete team' });
    }
  };

  const createTeam = async () => {
    if (!newTeam.name || !newTeam.ownerId) {
      setMessage({ type: 'error', text: 'Team name and owner ID are required' });
      return;
    }

    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_team',
          data: newTeam,
        }),
      });

      const result = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: result.message });
        setNewTeam({ name: '', ownerId: '', maxSize: 20, purse: 50000000 });
        setShowCreateTeam(false);
        fetchData();
      } else {
        setMessage({ type: 'error', text: result.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to create team' });
    }
  };

  const addPlayer = async () => {
    if (!newPlayer.teamId || !newPlayer.name || !newPlayer.playerId) {
      setMessage({ type: 'error', text: 'Please fill in Team, Player ID, and Name' });
      return;
    }

    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_player',
          data: {
            teamId: newPlayer.teamId,
            playerId: newPlayer.playerId,
            playerName: newPlayer.name,
            category: newPlayer.category,
          },
        }),
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Player added' });
        setNewPlayer({ teamId: 0, playerId: '', name: '', category: '' });
        fetchData();
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to add player' });
    }
  };

  const removePlayer = async (playerId: number) => {
    if (!confirm('Remove this player?')) return;

    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove_player',
          data: { playerId },
        }),
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Player removed' });
        fetchData();
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to remove player' });
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-accent" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="card text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-gray-400">This page is only accessible to league administrators.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Admin Panel</h1>
        <p className="text-gray-400">Manage teams, players, and auction rounds</p>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-4">
        {(['teams', 'rounds', 'upload'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'bg-accent text-black'
                : 'bg-surface hover:bg-surface-light'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Teams Tab */}
      {activeTab === 'teams' && (
        <div className="space-y-6">
          {/* Create Team Button */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowCreateTeam(!showCreateTeam)}
              className="btn-primary"
            >
              {showCreateTeam ? 'Cancel' : '+ Create Team'}
            </button>
          </div>

          {/* Create Team Form */}
          {showCreateTeam && (
            <div className="card bg-surface-light">
              <h3 className="font-semibold mb-4">Create New Team</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <input
                  type="text"
                  placeholder="Team Name *"
                  value={newTeam.name}
                  onChange={e => setNewTeam({ ...newTeam, name: e.target.value })}
                  className="input"
                />
                <input
                  type="text"
                  placeholder="Owner Discord ID *"
                  value={newTeam.ownerId}
                  onChange={e => setNewTeam({ ...newTeam, ownerId: e.target.value })}
                  className="input"
                />
                <input
                  type="number"
                  placeholder="Max Size"
                  value={newTeam.maxSize}
                  onChange={e => setNewTeam({ ...newTeam, maxSize: parseInt(e.target.value) })}
                  className="input"
                />
                <input
                  type="number"
                  placeholder="Purse"
                  value={newTeam.purse}
                  onChange={e => setNewTeam({ ...newTeam, purse: parseFloat(e.target.value) })}
                  className="input"
                />
              </div>
              <button onClick={createTeam} className="btn-primary mt-4">Create Team</button>
            </div>
          )}

          {/* Teams List */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Teams ({teams.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 text-sm text-gray-400">Team</th>
                    <th className="text-left p-3 text-sm text-gray-400">Owner ID</th>
                    <th className="text-left p-3 text-sm text-gray-400">Purse</th>
                    <th className="text-left p-3 text-sm text-gray-400">Max Size</th>
                    <th className="text-left p-3 text-sm text-gray-400">Players</th>
                    <th className="text-left p-3 text-sm text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map(team => {
                    const teamPlayers = players.filter(p => p.teamId === team.id);
                    return (
                      <tr key={team.id} className="border-b border-border/50 hover:bg-surface-light/50">
                        <td className="p-3 font-medium">{team.name}</td>
                        <td className="p-3 font-mono text-sm text-gray-400">{team.ownerId}</td>
                        <td className="p-3 font-mono text-accent">${(team.purse / 1000000).toFixed(2)}M</td>
                        <td className="p-3">{team.maxSize}</td>
                        <td className="p-3">{teamPlayers.length}</td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingTeam(team)}
                              className="text-accent hover:underline text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteTeam(team.id, team.name)}
                              className="text-red-400 hover:underline text-sm"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Edit Team Modal */}
          {editingTeam && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="card max-w-md w-full m-4">
                <h3 className="text-lg font-semibold mb-4">Edit Team: {editingTeam.name}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Team Name</label>
                    <input
                      type="text"
                      value={editingTeam.name}
                      onChange={e => setEditingTeam({ ...editingTeam, name: e.target.value })}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Owner Discord ID</label>
                    <input
                      type="text"
                      value={editingTeam.ownerId}
                      onChange={e => setEditingTeam({ ...editingTeam, ownerId: e.target.value })}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Purse ($)</label>
                    <input
                      type="number"
                      value={editingTeam.purse}
                      onChange={e => setEditingTeam({ ...editingTeam, purse: parseFloat(e.target.value) })}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Max Size</label>
                    <input
                      type="number"
                      value={editingTeam.maxSize}
                      onChange={e => setEditingTeam({ ...editingTeam, maxSize: parseInt(e.target.value) })}
                      className="input w-full"
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={updateTeam} className="btn-primary flex-1">Save</button>
                  <button onClick={() => setEditingTeam(null)} className="btn-secondary flex-1">Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* Players by Team */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Players</h2>
            
            {/* Add Player */}
            <div className="bg-surface-light rounded-lg p-4 mb-4">
              <h3 className="font-medium mb-3">Add Player</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <select
                  value={newPlayer.teamId}
                  onChange={e => setNewPlayer({ ...newPlayer, teamId: parseInt(e.target.value) })}
                  className="select"
                >
                  <option value={0}>Select Team</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Player ID *"
                  value={newPlayer.playerId}
                  onChange={e => setNewPlayer({ ...newPlayer, playerId: e.target.value })}
                  className="input"
                />
                <input
                  type="text"
                  placeholder="Player Name *"
                  value={newPlayer.name}
                  onChange={e => setNewPlayer({ ...newPlayer, name: e.target.value })}
                  className="input"
                />
                <input
                  type="text"
                  placeholder="Category"
                  value={newPlayer.category}
                  onChange={e => setNewPlayer({ ...newPlayer, category: e.target.value })}
                  className="input"
                />
                <button onClick={addPlayer} className="btn-primary">Add</button>
              </div>
            </div>

            {/* Players List */}
            <div className="space-y-4">
              {teams.map(team => {
                const teamPlayers = players.filter(p => p.teamId === team.id);
                return (
                  <div key={team.id} className="bg-surface-light rounded-lg p-4">
                    <h4 className="font-medium mb-2">{team.name} ({teamPlayers.length})</h4>
                    <div className="flex flex-wrap gap-2">
                      {teamPlayers.map(player => (
                        <div key={player.id} className="flex items-center gap-2 bg-surface px-3 py-1 rounded-full text-sm">
                          <span>{player.name}</span>
                          <span className="text-xs text-gray-500 font-mono">({player.playerId})</span>
                          <button
                            onClick={() => removePlayer(player.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {teamPlayers.length === 0 && (
                        <span className="text-gray-500 text-sm">No players</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Rounds Tab */}
      {activeTab === 'rounds' && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Auction Rounds</h2>
          {rounds.length > 0 ? (
            <div className="space-y-4">
              {rounds.map(round => {
                const roundAuctionPlayers = auctionPlayers.filter(p => p.roundId === round.id);
                const pending = roundAuctionPlayers.filter(p => p.status === 'pending').length;
                const sold = roundAuctionPlayers.filter(p => p.status === 'sold').length;
                const unsold = roundAuctionPlayers.filter(p => p.status === 'unsold').length;

                return (
                  <div key={round.id} className="bg-surface-light rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium">Round {round.roundNumber}: {round.name}</h3>
                      <div className="flex items-center gap-2">
                        {round.isActive && (
                          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">Active</span>
                        )}
                        {round.isCompleted && (
                          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">Completed</span>
                        )}
                        <button
                          onClick={async () => {
                            if (confirm(`Reset Round ${round.roundNumber}? All players will be set back to pending.${round.isActive ? '\n\n⚠️ This round is currently ACTIVE. This will stop the auction!' : ''}`)) {
                              try {
                                const res = await fetch('/api/admin', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ action: 'reset_round', roundId: round.id }),
                                });
                                const data = await res.json();
                                if (res.ok) {
                                  setMessage({ type: 'success', text: data.message });
                                  fetchData();
                                } else {
                                  setMessage({ type: 'error', text: data.error });
                                }
                              } catch (error) {
                                setMessage({ type: 'error', text: 'Failed to reset round' });
                              }
                            }
                          }}
                          className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded hover:bg-yellow-500/30"
                        >
                          🔄 Reset
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm(`DELETE Round ${round.roundNumber}: ${round.name}?\n\nThis will permanently delete the round and ALL players in it. This cannot be undone!${round.isActive ? '\n\n⚠️ This round is currently ACTIVE. This will stop the auction!' : ''}`)) {
                              try {
                                const res = await fetch('/api/admin', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ action: 'delete_round', roundId: round.id }),
                                });
                                const data = await res.json();
                                if (res.ok) {
                                  setMessage({ type: 'success', text: data.message });
                                  fetchData();
                                } else {
                                  setMessage({ type: 'error', text: data.error });
                                }
                              } catch (error) {
                                setMessage({ type: 'error', text: 'Failed to delete round' });
                              }
                            }
                          }}
                          className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded hover:bg-red-500/30"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">Total:</span> {roundAuctionPlayers.length}
                      </div>
                      <div>
                        <span className="text-gray-400">Pending:</span> {pending}
                      </div>
                      <div>
                        <span className="text-gray-400">Sold:</span> {sold}
                      </div>
                      <div>
                        <span className="text-gray-400">Unsold:</span> {unsold}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No rounds created. Use the Upload tab to import rounds.</p>
          )}

          {/* Danger Zone - Reset All Auction Data */}
          <div className="mt-8 pt-6 border-t border-red-500/30">
            <h3 className="text-lg font-semibold text-red-400 mb-4">⚠️ Danger Zone</h3>
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="font-medium text-red-400">Reset All Auction Data</h4>
                  <p className="text-sm text-gray-400 mt-1">
                    This will clear ALL auction logs, sold player records, unsold players, and reset all rounds to pending.
                    Team purses will remain unchanged. This action cannot be undone!
                  </p>
                </div>
                <button
                  onClick={async () => {
                    if (confirm('⚠️ DANGER: Reset ALL auction data?\n\nThis will:\n• Clear all auction logs\n• Remove all sold players from rosters\n• Reset all rounds to pending\n• Clear unsold players list\n\nTeam purses will NOT be reset.\n\nThis action CANNOT be undone!')) {
                      if (confirm('Are you ABSOLUTELY sure? Type "yes" mentally and click OK to proceed.')) {
                        try {
                          const res = await fetch('/api/admin', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'reset_auction_data' }),
                          });
                          const data = await res.json();
                          if (res.ok) {
                            setMessage({ type: 'success', text: data.message });
                            fetchData();
                          } else {
                            setMessage({ type: 'error', text: data.error });
                          }
                        } catch (error) {
                          setMessage({ type: 'error', text: 'Failed to reset auction data' });
                        }
                      }
                    }
                  }}
                  className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 whitespace-nowrap"
                >
                  🗑️ Reset All Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Import Data</h2>
          
          <div className="space-y-6">
            {/* Upload Type Selection */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">What are you uploading?</label>
              <div className="flex gap-3">
                {(['teams', 'round', 'unsold'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setUploadType(type)}
                    className={`px-4 py-2 rounded-lg capitalize ${
                      uploadType === type ? 'bg-accent text-black' : 'bg-surface-light'
                    }`}
                  >
                    {type === 'round' ? 'Auction Round' : type}
                  </button>
                ))}
              </div>
            </div>

            {/* Warning for Teams Upload */}
            {uploadType === 'teams' && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <span className="text-yellow-500 text-xl">⚠️</span>
                  <div>
                    <h4 className="font-medium text-yellow-400">Overwrite Warning</h4>
                    <p className="text-sm text-gray-400 mt-1">
                      Importing teams will <strong>overwrite all existing data</strong> for teams with matching names. 
                      This includes purse, owner ID, max size, and <strong>all players</strong> will be replaced.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Round-specific fields */}
            {uploadType === 'round' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Round Number</label>
                  <input
                    type="number"
                    value={roundNumber}
                    onChange={e => setRoundNumber(parseInt(e.target.value))}
                    className="input w-full"
                    min={1}
                    max={6}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Round Name</label>
                  <input
                    type="text"
                    value={roundName}
                    onChange={e => setRoundName(e.target.value)}
                    placeholder="e.g., Batsmen Round"
                    className="input w-full"
                  />
                </div>
              </div>
            )}

            {/* File Upload */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Upload File (JSON)</label>
              <input
                type="file"
                accept=".json,.xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-400
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-accent file:text-black
                  hover:file:bg-accent-dim
                  cursor-pointer"
              />
            </div>

            {/* File Preview */}
            {fileContent && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">Preview</label>
                <textarea
                  value={fileContent}
                  onChange={e => setFileContent(e.target.value)}
                  className="input w-full h-48 font-mono text-sm"
                />
              </div>
            )}

            {/* Format Examples */}
            <div className="bg-surface-light rounded-lg p-4">
              <h3 className="font-medium mb-2">Expected Format</h3>
              {uploadType === 'teams' && (
                <pre className="text-xs text-gray-400 overflow-x-auto">
{`{
  "teams": {
    "SKR": {
      "owner": "1127099249226690652",
      "max_size": 20,
      "purse": 50000000,
      "players": [
        { "name": "Player 1", "player_id": "abc123" },
        { "name": "Player 2", "player_id": "def456" }
      ]
    }
  }
}`}
                </pre>
              )}
              {uploadType === 'round' && (
                <pre className="text-xs text-gray-400 overflow-x-auto">
{`{
  "players_for_auction": [
    {
      "name": "Player Name",
      "player_id": "xyz789",
      "category": "Batsman",
      "base_price": 500000
    }
  ]
}`}
                </pre>
              )}
              {uploadType === 'unsold' && (
                <pre className="text-xs text-gray-400 overflow-x-auto">
{`{
  "unsold": [
    {
      "name": "Player Name",
      "player_id": "abc123",
      "category": "Bowler",
      "base_price": 100000
    }
  ]
}`}
                </pre>
              )}
            </div>

            <button
              onClick={processUpload}
              disabled={!fileContent}
              className="btn-primary w-full disabled:opacity-50"
            >
              Import Data
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
