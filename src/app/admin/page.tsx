'use client';

import { useState, useEffect, useRef } from 'react';
import { isAuthorizedAdmin, AUTHORIZED_ADMIN_IDS, formatCurrency, formatFullCurrency } from '@/lib/auction';

interface Team {
  id: number;
  name: string;
  ownerId: string;
  purse: number;
  maxSize: number;
  playerCount?: number;
  players?: Player[];
}

interface Player {
  id: number;
  playerId: string;
  name: string;
  teamId: number;
  purchasePrice: number;
}

interface AuctionPlayer {
  id: number;
  name: string;
  category: string;
  basePrice: number;
  status: string;
  roundId: number;
}

interface Round {
  id: number;
  roundNumber: number;
  name: string;
  status: string;
  totalPlayers: number;
  pendingPlayers: number;
  soldPlayers: number;
  unsoldPlayers: number;
}

interface Admin {
  id: number;
  discordId: string;
  name: string | null;
  role: string;
}

export default function AdminPage() {
  const [discordId, setDiscordId] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Data
  const [teams, setTeams] = useState<Team[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [selectedTeamPlayers, setSelectedTeamPlayers] = useState<Player[]>([]);
  const [selectedRoundPlayers, setSelectedRoundPlayers] = useState<AuctionPlayer[]>([]);
  
  // Active tab
  const [activeTab, setActiveTab] = useState<'teams' | 'players' | 'rounds' | 'auction-players' | 'import' | 'admins'>('teams');
  
  // Form states
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [selectedRoundId, setSelectedRoundId] = useState<number | null>(null);
  const [importJson, setImportJson] = useState('');
  const [importType, setImportType] = useState<'teams' | 'players' | 'rounds'>('teams');
  const [newAdminId, setNewAdminId] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  
  // New player form
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerCategory, setNewPlayerCategory] = useState('Batsman');
  const [newPlayerBasePrice, setNewPlayerBasePrice] = useState('500000');
  
  // File upload ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Check login on mount
  useEffect(() => {
    const savedId = localStorage.getItem('discordId');
    if (savedId) {
      setDiscordId(savedId);
      setIsLoggedIn(true);
      checkAdmin(savedId);
    }
  }, []);

  const checkAdmin = async (id: string) => {
    try {
      const res = await fetch(`/api/admin?discordId=${id}`);
      const data = await res.json();
      setIsAdmin(data.isAdmin);
      setAdmins(data.admins || []);
    } catch (error) {
      console.error('Failed to check admin status:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch teams with players
      const teamsRes = await fetch('/api/teams?includePlayers=true');
      const teamsData = await teamsRes.json();
      setTeams(teamsData);

      // Fetch rounds
      const roundsRes = await fetch('/api/rounds');
      const roundsData = await roundsRes.json();
      setRounds(roundsData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch players for a specific team
  const fetchTeamPlayers = async (teamId: number) => {
    try {
      const res = await fetch(`/api/teams?teamId=${teamId}&includePlayers=true`);
      const data = await res.json();
      setSelectedTeamPlayers(data.players || []);
    } catch (error) {
      console.error('Failed to fetch team players:', error);
    }
  };

  // Fetch players for a specific round
  const fetchRoundPlayers = async (roundId: number) => {
    try {
      const res = await fetch(`/api/rounds/${roundId}`);
      const data = await res.json();
      setSelectedRoundPlayers(data.players || []);
    } catch (error) {
      console.error('Failed to fetch round players:', error);
    }
  };

  useEffect(() => {
    if (isLoggedIn && isAdmin) {
      fetchData();
    }
  }, [isLoggedIn, isAdmin]);

  useEffect(() => {
    if (selectedTeamId) {
      fetchTeamPlayers(selectedTeamId);
    }
  }, [selectedTeamId]);

  useEffect(() => {
    if (selectedRoundId && activeTab === 'auction-players') {
      fetchRoundPlayers(selectedRoundId);
    }
  }, [selectedRoundId, activeTab]);

  const handleLogin = () => {
    if (discordId.trim()) {
      localStorage.setItem('discordId', discordId);
      setIsLoggedIn(true);
      checkAdmin(discordId);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  // Team update handler
  const handleUpdateTeam = async () => {
    if (!editingTeam) return;
    
    try {
      const res = await fetch('/api/teams', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: editingTeam.id,
          purse: editingTeam.purse,
          ownerId: editingTeam.ownerId,
          maxSize: editingTeam.maxSize,
        }),
      });

      if (res.ok) {
        showMessage('success', 'Team updated successfully');
        setEditingTeam(null);
        fetchData();
      } else {
        const data = await res.json();
        showMessage('error', data.error || 'Failed to update team');
      }
    } catch (error) {
      showMessage('error', 'Failed to update team');
    }
  };

  // Parse CSV to JSON
  const parseCSV = (csvText: string): any[] => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
    const data: any[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row: any = {};
      headers.forEach((header, index) => {
        let value: any = values[index] || '';
        // Try to parse as number if it looks like one
        if (/^\d+$/.test(value)) {
          value = parseInt(value, 10);
        } else if (/^\d+\.\d+$/.test(value)) {
          value = parseFloat(value);
        }
        row[header] = value;
      });
      data.push(row);
    }
    return data;
  };

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    
    try {
      const text = await file.text();
      let parsedData: any;

      if (file.name.endsWith('.json')) {
        parsedData = JSON.parse(text);
      } else if (file.name.endsWith('.csv')) {
        parsedData = parseCSV(text);
      } else {
        showMessage('error', 'Unsupported file type. Please use JSON or CSV.');
        return;
      }

      // Set the parsed data to the textarea for preview/editing
      if (importType === 'teams') {
        // Format for teams import
        if (Array.isArray(parsedData)) {
          // CSV format - convert to teams object
          const teamsObj: any = {};
          parsedData.forEach(row => {
            const teamName = row.team_name || row.name || row.team;
            if (teamName) {
              teamsObj[teamName] = {
                owner: row.owner_id || row.owner || row.discord_id || '',
                purse: row.purse || 20000000,
                max_size: row.max_size || row.maxsize || 20,
                players: row.players ? row.players.split(';').map((p: string) => p.trim()) : []
              };
            }
          });
          setImportJson(JSON.stringify({ teams: teamsObj }, null, 2));
        } else {
          setImportJson(JSON.stringify(parsedData, null, 2));
        }
      } else if (importType === 'players') {
        // Format for auction players
        if (Array.isArray(parsedData)) {
          const players = parsedData.map(row => ({
            name: row.name || row.player_name || row.player,
            category: row.category || row.type || row.role || 'Unknown',
            base_price: row.base_price || row.baseprice || row.price || 500000
          }));
          setImportJson(JSON.stringify({ players_for_auction: players }, null, 2));
        } else {
          setImportJson(JSON.stringify(parsedData, null, 2));
        }
      } else if (importType === 'rounds') {
        // Format for rounds
        if (Array.isArray(parsedData)) {
          const rounds = parsedData.map((row, idx) => ({
            round_number: row.round_number || row.roundnumber || row.number || idx,
            name: row.name || row.round_name || `Round ${idx}`,
            status: row.status || 'pending'
          }));
          setImportJson(JSON.stringify({ rounds }, null, 2));
        } else {
          setImportJson(JSON.stringify(parsedData, null, 2));
        }
      }

      showMessage('success', `File "${file.name}" loaded. Review and click Import.`);
    } catch (error) {
      showMessage('error', 'Failed to parse file');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Import handler
  const handleImport = async () => {
    try {
      const parsedJson = JSON.parse(importJson);
      
      if (importType === 'teams') {
        const res = await fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'importTeams',
            requestingUser: discordId,
            teamsData: parsedJson.teams || parsedJson,
          }),
        });

        if (res.ok) {
          showMessage('success', 'Teams imported successfully');
          setImportJson('');
          fetchData();
        } else {
          const data = await res.json();
          showMessage('error', data.error || 'Failed to import teams');
        }
      } else if (importType === 'players') {
        if (!selectedRoundId) {
          showMessage('error', 'Please select a round first');
          return;
        }

        const players = parsedJson.players_for_auction || parsedJson;
        
        const res = await fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'importAuctionPlayers',
            requestingUser: discordId,
            roundId: selectedRoundId,
            playersData: players,
          }),
        });

        if (res.ok) {
          showMessage('success', 'Players imported successfully');
          setImportJson('');
          fetchData();
        } else {
          const data = await res.json();
          showMessage('error', data.error || 'Failed to import players');
        }
      } else if (importType === 'rounds') {
        const rounds = parsedJson.rounds || parsedJson;
        
        const res = await fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'importRounds',
            requestingUser: discordId,
            roundsData: rounds,
          }),
        });

        if (res.ok) {
          showMessage('success', 'Rounds imported successfully');
          setImportJson('');
          fetchData();
        } else {
          const data = await res.json();
          showMessage('error', data.error || 'Failed to import rounds');
        }
      }
    } catch (error) {
      showMessage('error', 'Invalid JSON format');
    }
  };

  // Add admin
  const handleAddAdmin = async () => {
    if (!newAdminId.trim()) {
      showMessage('error', 'Please enter a Discord ID');
      return;
    }

    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addAdmin',
          requestingUser: discordId,
          adminDiscordId: newAdminId,
          adminName: newAdminName || null,
        }),
      });

      if (res.ok) {
        showMessage('success', 'Admin added successfully');
        setNewAdminId('');
        setNewAdminName('');
        checkAdmin(discordId);
      } else {
        const data = await res.json();
        showMessage('error', data.error || 'Failed to add admin');
      }
    } catch (error) {
      showMessage('error', 'Failed to add admin');
    }
  };

  // Remove admin
  const handleRemoveAdmin = async (adminId: string) => {
    if (AUTHORIZED_ADMIN_IDS.includes(adminId)) {
      showMessage('error', 'Cannot remove hardcoded admin');
      return;
    }

    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'removeAdmin',
          requestingUser: discordId,
          adminDiscordId: adminId,
        }),
      });

      if (res.ok) {
        showMessage('success', 'Admin removed');
        checkAdmin(discordId);
      } else {
        const data = await res.json();
        showMessage('error', data.error || 'Failed to remove admin');
      }
    } catch (error) {
      showMessage('error', 'Failed to remove admin');
    }
  };

  // Remove player from team
  const handleRemovePlayerFromTeam = async (playerId: number) => {
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'removePlayerFromTeam',
          requestingUser: discordId,
          playerId,
        }),
      });

      if (res.ok) {
        showMessage('success', 'Player removed from team');
        if (selectedTeamId) fetchTeamPlayers(selectedTeamId);
        fetchData();
      } else {
        const data = await res.json();
        showMessage('error', data.error || 'Failed to remove player');
      }
    } catch (error) {
      showMessage('error', 'Failed to remove player');
    }
  };

  // Add player to auction round
  const handleAddAuctionPlayer = async () => {
    if (!selectedRoundId || !newPlayerName.trim()) {
      showMessage('error', 'Please select a round and enter player name');
      return;
    }

    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addAuctionPlayer',
          requestingUser: discordId,
          roundId: selectedRoundId,
          playerName: newPlayerName,
          category: newPlayerCategory,
          basePrice: parseInt(newPlayerBasePrice, 10),
        }),
      });

      if (res.ok) {
        showMessage('success', 'Player added to auction');
        setNewPlayerName('');
        fetchRoundPlayers(selectedRoundId);
        fetchData();
      } else {
        const data = await res.json();
        showMessage('error', data.error || 'Failed to add player');
      }
    } catch (error) {
      showMessage('error', 'Failed to add player');
    }
  };

  // Remove auction player
  const handleRemoveAuctionPlayer = async (playerId: number) => {
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'removeAuctionPlayer',
          requestingUser: discordId,
          playerId,
        }),
      });

      if (res.ok) {
        showMessage('success', 'Player removed from auction');
        if (selectedRoundId) fetchRoundPlayers(selectedRoundId);
        fetchData();
      } else {
        const data = await res.json();
        showMessage('error', data.error || 'Failed to remove player');
      }
    } catch (error) {
      showMessage('error', 'Failed to remove player');
    }
  };

  // Clear round players
  const handleClearRound = async (roundId: number) => {
    if (!confirm('Are you sure you want to clear all players from this round?')) return;

    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clearRound',
          requestingUser: discordId,
          roundId,
        }),
      });

      if (res.ok) {
        showMessage('success', 'Round cleared');
        fetchData();
        if (selectedRoundId === roundId) {
          setSelectedRoundPlayers([]);
        }
      } else {
        const data = await res.json();
        showMessage('error', data.error || 'Failed to clear round');
      }
    } catch (error) {
      showMessage('error', 'Failed to clear round');
    }
  };

  // Reset auction
  const handleResetAuction = async () => {
    if (!confirm('⚠️ This will reset ALL auction data including history. Are you sure?')) return;
    if (!confirm('⚠️ FINAL WARNING: This cannot be undone. Type "RESET" mentally and click OK.')) return;

    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resetAuction',
          requestingUser: discordId,
        }),
      });

      if (res.ok) {
        showMessage('success', 'Auction reset completely');
        fetchData();
      } else {
        const data = await res.json();
        showMessage('error', data.error || 'Failed to reset auction');
      }
    } catch (error) {
      showMessage('error', 'Failed to reset auction');
    }
  };

  // Login screen
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="bg-gray-800 p-8 rounded-xl max-w-md w-full">
          <h1 className="text-2xl font-bold mb-6 text-center">🔐 Admin Login</h1>
          <p className="text-gray-400 mb-4 text-center">
            Enter your Discord ID to access the admin panel
          </p>
          <input
            type="text"
            value={discordId}
            onChange={(e) => setDiscordId(e.target.value)}
            placeholder="Your Discord ID"
            className="w-full p-3 bg-gray-700 rounded-lg mb-4 text-white"
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
          <button
            onClick={handleLogin}
            className="w-full bg-indigo-600 hover:bg-indigo-700 p-3 rounded-lg font-semibold"
          >
            Login
          </button>
          <p className="text-gray-500 text-sm mt-4 text-center">
            Only CT and PS owners can access this panel
          </p>
        </div>
      </div>
    );
  }

  // Not authorized
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="bg-gray-800 p-8 rounded-xl max-w-md w-full text-center">
          <span className="text-6xl mb-4 block">🚫</span>
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-gray-400 mb-4">
            You are not authorized to access the admin panel.
          </p>
          <p className="text-gray-500 text-sm">
            Only CT and PS owners (Discord IDs: {AUTHORIZED_ADMIN_IDS.join(', ')}) can access this page.
          </p>
          <button
            onClick={() => { setIsLoggedIn(false); setDiscordId(''); }}
            className="mt-6 bg-gray-700 hover:bg-gray-600 px-6 py-2 rounded-lg"
          >
            Try Different ID
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">🔐 Admin Panel</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-400">Logged in as: {discordId}</span>
            <button
              onClick={() => { localStorage.removeItem('discordId'); setIsLoggedIn(false); }}
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`p-4 rounded-lg mb-4 ${
            message.type === 'success' 
              ? 'bg-green-900/50 border border-green-500 text-green-200'
              : 'bg-red-900/50 border border-red-500 text-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-700 pb-2">
          {[
            { id: 'teams', label: '👥 Teams' },
            { id: 'players', label: '🏏 Team Players' },
            { id: 'rounds', label: '🔄 Rounds' },
            { id: 'auction-players', label: '📋 Auction Players' },
            { id: 'import', label: '📤 Import Data' },
            { id: 'admins', label: '🔑 Admins' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-2 rounded-t-lg transition-colors font-semibold ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Teams Tab */}
        {activeTab === 'teams' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.map((team) => (
                <div key={team.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                  {editingTeam?.id === team.id ? (
                    // Edit mode
                    <div className="space-y-3">
                      <div className="font-bold text-lg text-indigo-400">{team.name}</div>
                      <div>
                        <label className="text-sm text-gray-400">Owner Discord ID</label>
                        <input
                          type="text"
                          value={editingTeam.ownerId}
                          onChange={(e) => setEditingTeam({ ...editingTeam, ownerId: e.target.value })}
                          className="w-full bg-gray-700 p-2 rounded mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-gray-400">Purse ($)</label>
                        <input
                          type="number"
                          value={editingTeam.purse}
                          onChange={(e) => setEditingTeam({ ...editingTeam, purse: parseInt(e.target.value) || 0 })}
                          className="w-full bg-gray-700 p-2 rounded mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-gray-400">Max Size</label>
                        <input
                          type="number"
                          value={editingTeam.maxSize}
                          onChange={(e) => setEditingTeam({ ...editingTeam, maxSize: parseInt(e.target.value) || 18 })}
                          className="w-full bg-gray-700 p-2 rounded mt-1"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleUpdateTeam}
                          className="flex-1 bg-green-600 hover:bg-green-700 p-2 rounded font-semibold"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingTeam(null)}
                          className="flex-1 bg-gray-600 hover:bg-gray-500 p-2 rounded"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <div className="font-bold text-lg">{team.name}</div>
                        <button
                          onClick={() => setEditingTeam(team)}
                          className="text-indigo-400 hover:text-indigo-300 text-sm"
                        >
                          ✏️ Edit
                        </button>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Owner ID:</span>
                          <span className="font-mono text-xs">{team.ownerId}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Purse:</span>
                          <span className="text-green-400 font-bold">{formatFullCurrency(team.purse)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Roster:</span>
                          <span>{team.playerCount || 0}/{team.maxSize}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Team Players Tab */}
        {activeTab === 'players' && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <h3 className="text-lg font-bold mb-4">Select Team to View/Edit Players</h3>
              <select
                value={selectedTeamId || ''}
                onChange={(e) => setSelectedTeamId(Number(e.target.value) || null)}
                className="w-full bg-gray-700 p-3 rounded-lg"
              >
                <option value="">Choose a team...</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} ({team.playerCount || 0} players)
                  </option>
                ))}
              </select>
            </div>

            {selectedTeamId && (
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <h3 className="text-lg font-bold mb-4">
                  Players in {teams.find(t => t.id === selectedTeamId)?.name}
                </h3>
                {selectedTeamPlayers.length > 0 ? (
                  <div className="space-y-2">
                    {selectedTeamPlayers.map((player) => (
                      <div 
                        key={player.id}
                        className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg"
                      >
                        <div>
                          <div className="font-semibold">{player.name}</div>
                          <div className="text-sm text-gray-400">
                            ID: {player.playerId} | Paid: {formatFullCurrency(player.purchasePrice)}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemovePlayerFromTeam(player.id)}
                          className="text-red-400 hover:text-red-300 px-3 py-1 bg-red-900/30 rounded"
                        >
                          🗑️ Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500 text-center py-8">
                    No players in this team
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Rounds Tab */}
        {activeTab === 'rounds' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rounds.map((round) => (
                <div key={round.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-bold">{round.name}</div>
                      <div className="text-sm text-gray-400">Round #{round.roundNumber}</div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${
                      round.status === 'active' ? 'bg-green-600' :
                      round.status === 'completed' ? 'bg-gray-600' :
                      'bg-yellow-600'
                    }`}>
                      {round.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div className="bg-gray-700/50 p-2 rounded text-center">
                      <div className="text-gray-400">Total</div>
                      <div className="font-bold">{round.totalPlayers}</div>
                    </div>
                    <div className="bg-gray-700/50 p-2 rounded text-center">
                      <div className="text-gray-400">Pending</div>
                      <div className="font-bold text-yellow-400">{round.pendingPlayers}</div>
                    </div>
                    <div className="bg-gray-700/50 p-2 rounded text-center">
                      <div className="text-gray-400">Sold</div>
                      <div className="font-bold text-green-400">{round.soldPlayers}</div>
                    </div>
                    <div className="bg-gray-700/50 p-2 rounded text-center">
                      <div className="text-gray-400">Unsold</div>
                      <div className="font-bold text-red-400">{round.unsoldPlayers}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleClearRound(round.id)}
                    className="w-full bg-red-900/30 hover:bg-red-900/50 text-red-400 p-2 rounded text-sm"
                  >
                    🗑️ Clear All Players
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Auction Players Tab */}
        {activeTab === 'auction-players' && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <h3 className="text-lg font-bold mb-4">Select Round</h3>
              <select
                value={selectedRoundId || ''}
                onChange={(e) => setSelectedRoundId(Number(e.target.value) || null)}
                className="w-full bg-gray-700 p-3 rounded-lg"
              >
                <option value="">Choose a round...</option>
                {rounds.map((round) => (
                  <option key={round.id} value={round.id}>
                    {round.name} ({round.totalPlayers} players)
                  </option>
                ))}
              </select>
            </div>

            {selectedRoundId && (
              <>
                {/* Add New Player */}
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                  <h3 className="text-lg font-bold mb-4">➕ Add New Player</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <input
                      type="text"
                      value={newPlayerName}
                      onChange={(e) => setNewPlayerName(e.target.value)}
                      placeholder="Player Name"
                      className="bg-gray-700 p-3 rounded-lg"
                    />
                    <select
                      value={newPlayerCategory}
                      onChange={(e) => setNewPlayerCategory(e.target.value)}
                      className="bg-gray-700 p-3 rounded-lg"
                    >
                      <option value="Batsman">Batsman</option>
                      <option value="Bowler">Bowler</option>
                      <option value="All-Rounder">All-Rounder</option>
                      <option value="Wicket-Keeper">Wicket-Keeper</option>
                    </select>
                    <input
                      type="number"
                      value={newPlayerBasePrice}
                      onChange={(e) => setNewPlayerBasePrice(e.target.value)}
                      placeholder="Base Price"
                      className="bg-gray-700 p-3 rounded-lg"
                    />
                    <button
                      onClick={handleAddAuctionPlayer}
                      className="bg-green-600 hover:bg-green-700 p-3 rounded-lg font-semibold"
                    >
                      Add Player
                    </button>
                  </div>
                </div>

                {/* Players List */}
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                  <h3 className="text-lg font-bold mb-4">
                    Players in {rounds.find(r => r.id === selectedRoundId)?.name}
                  </h3>
                  {selectedRoundPlayers.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="text-left border-b border-gray-700">
                            <th className="pb-3 text-gray-400">Name</th>
                            <th className="pb-3 text-gray-400">Category</th>
                            <th className="pb-3 text-gray-400">Base Price</th>
                            <th className="pb-3 text-gray-400">Status</th>
                            <th className="pb-3 text-gray-400">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedRoundPlayers.map((player) => (
                            <tr key={player.id} className="border-b border-gray-700/50">
                              <td className="py-3 font-semibold">{player.name}</td>
                              <td className="py-3 text-gray-400">{player.category}</td>
                              <td className="py-3">{formatCurrency(player.basePrice)}</td>
                              <td className="py-3">
                                <span className={`text-xs px-2 py-1 rounded ${
                                  player.status === 'sold' ? 'bg-green-600' :
                                  player.status === 'unsold' ? 'bg-red-600' :
                                  'bg-yellow-600'
                                }`}>
                                  {player.status}
                                </span>
                              </td>
                              <td className="py-3">
                                <button
                                  onClick={() => handleRemoveAuctionPlayer(player.id)}
                                  className="text-red-400 hover:text-red-300 text-sm"
                                >
                                  🗑️ Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-gray-500 text-center py-8">
                      No players in this round
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Import Tab */}
        {activeTab === 'import' && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-xl font-bold mb-4">📤 Import Data</h3>
              
              {/* Import Type Selection */}
              <div className="mb-4">
                <label className="text-sm text-gray-400 mb-2 block">Import Type</label>
                <div className="flex gap-2">
                  {[
                    { id: 'teams', label: '👥 Teams & Franchises' },
                    { id: 'players', label: '🏏 Auction Players' },
                    { id: 'rounds', label: '🔄 Auction Rounds' },
                  ].map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setImportType(type.id as typeof importType)}
                      className={`px-4 py-2 rounded-lg ${
                        importType === type.id
                          ? 'bg-indigo-600'
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Round selection for players import */}
              {importType === 'players' && (
                <div className="mb-4">
                  <label className="text-sm text-gray-400 mb-2 block">Target Round</label>
                  <select
                    value={selectedRoundId || ''}
                    onChange={(e) => setSelectedRoundId(Number(e.target.value) || null)}
                    className="w-full bg-gray-700 p-3 rounded-lg"
                  >
                    <option value="">Select a round...</option>
                    {rounds.map((round) => (
                      <option key={round.id} value={round.id}>
                        {round.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* File Upload */}
              <div className="mb-4">
                <label className="text-sm text-gray-400 mb-2 block">Upload File (JSON or CSV)</label>
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                    className="bg-indigo-600 hover:bg-indigo-700 px-6 py-3 rounded-lg font-semibold flex items-center gap-2"
                  >
                    {uploadingFile ? '⏳ Loading...' : '📁 Choose File'}
                  </button>
                  <span className="text-gray-400 text-sm self-center">
                    Supports .json and .csv files
                  </span>
                </div>
              </div>

              {/* JSON Preview/Edit */}
              <div className="mb-4">
                <label className="text-sm text-gray-400 mb-2 block">
                  JSON Data (paste or upload)
                </label>
                <textarea
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                  placeholder={
                    importType === 'teams' 
                      ? '{\n  "teams": {\n    "TeamName": {\n      "owner": "discord_id",\n      "purse": 20000000,\n      "max_size": 20,\n      "players": ["Player1", "Player2"]\n    }\n  }\n}'
                      : importType === 'players'
                      ? '{\n  "players_for_auction": [\n    { "name": "Player Name", "category": "Batsman", "base_price": 500000 }\n  ]\n}'
                      : '{\n  "rounds": [\n    { "round_number": 1, "name": "Round 1 - Batsmen", "status": "pending" }\n  ]\n}'
                  }
                  rows={12}
                  className="w-full bg-gray-700 p-4 rounded-lg font-mono text-sm"
                />
              </div>

              {/* Import Button */}
              <button
                onClick={handleImport}
                disabled={!importJson.trim()}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 p-3 rounded-lg font-semibold"
              >
                📥 Import {importType === 'teams' ? 'Teams' : importType === 'players' ? 'Players' : 'Rounds'}
              </button>

              {/* CSV Format Help */}
              <div className="mt-6 bg-gray-700/50 rounded-lg p-4">
                <h4 className="font-bold mb-2">📋 CSV Format Examples</h4>
                {importType === 'teams' ? (
                  <pre className="text-xs text-gray-400 overflow-x-auto">
{`team_name,owner_id,purse,max_size,players
CT,256972361918578688,47250000,20,Steve Smith;Matt Henry;Sanju Samson
PS,1111497896018313268,52000000,20,Shubman Gill;Kagiso Rabada`}
                  </pre>
                ) : importType === 'players' ? (
                  <pre className="text-xs text-gray-400 overflow-x-auto">
{`name,category,base_price
Virat Kohli,Batsman,2000000
Jasprit Bumrah,Bowler,1500000
Ben Stokes,All-Rounder,2000000`}
                  </pre>
                ) : (
                  <pre className="text-xs text-gray-400 overflow-x-auto">
{`round_number,name,status
1,Round 1 - Batsmen,pending
2,Round 2 - Bowlers,pending
3,Round 3 - All-Rounders,pending`}
                  </pre>
                )}
              </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-red-900/20 rounded-xl p-6 border border-red-700">
              <h3 className="text-xl font-bold text-red-400 mb-4">⚠️ Danger Zone</h3>
              <p className="text-gray-400 mb-4">
                This will permanently delete all auction data including history, logs, and player statuses.
              </p>
              <button
                onClick={handleResetAuction}
                className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-lg font-semibold"
              >
                🔄 Reset Entire Auction
              </button>
            </div>
          </div>
        )}

        {/* Admins Tab */}
        {activeTab === 'admins' && (
          <div className="space-y-6">
            {/* Add Admin */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <h3 className="text-lg font-bold mb-4">➕ Add New Admin</h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newAdminId}
                  onChange={(e) => setNewAdminId(e.target.value)}
                  placeholder="Discord ID"
                  className="flex-1 bg-gray-700 p-3 rounded-lg"
                />
                <input
                  type="text"
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  placeholder="Name (optional)"
                  className="flex-1 bg-gray-700 p-3 rounded-lg"
                />
                <button
                  onClick={handleAddAdmin}
                  className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-semibold"
                >
                  Add Admin
                </button>
              </div>
            </div>

            {/* Admins List */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <h3 className="text-lg font-bold mb-4">Current Admins</h3>
              <div className="space-y-2">
                {/* Hardcoded admins */}
                {AUTHORIZED_ADMIN_IDS.map((id) => (
                  <div 
                    key={id}
                    className="flex justify-between items-center p-3 bg-indigo-900/30 rounded-lg border border-indigo-700"
                  >
                    <div>
                      <div className="font-semibold">
                        {id === '256972361918578688' ? 'CT Owner' : 'PS Owner'}
                      </div>
                      <div className="text-sm text-gray-400 font-mono">{id}</div>
                    </div>
                    <span className="text-yellow-400 text-sm">🔒 Permanent</span>
                  </div>
                ))}
                
                {/* Database admins */}
                {admins.filter(a => !AUTHORIZED_ADMIN_IDS.includes(a.discordId)).map((admin) => (
                  <div 
                    key={admin.id}
                    className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg"
                  >
                    <div>
                      <div className="font-semibold">{admin.name || 'Unnamed Admin'}</div>
                      <div className="text-sm text-gray-400 font-mono">{admin.discordId}</div>
                    </div>
                    <button
                      onClick={() => handleRemoveAdmin(admin.discordId)}
                      className="text-red-400 hover:text-red-300 px-3 py-1 bg-red-900/30 rounded"
                    >
                      🗑️ Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
