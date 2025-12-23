'use client';

import { useState, useEffect, useCallback } from 'react';

interface Team {
  id: number;
  name: string;
}

interface GroupTeam {
  id: number;
  teamId: number;
  teamName: string;
  played: number;
  won: number;
  lost: number;
  tied: number;
  nrr: number;
  points: number;
}

interface Group {
  id: number;
  name: string;
  teams: GroupTeam[];
}

interface Match {
  id: number;
  matchNumber: number;
  team1Id: number;
  team2Id: number;
  team1Name: string;
  team2Name: string;
  venue: string;
  city: string | null;
  matchDate: string | null;
  matchTime: string | null;
  pitchType: string | null;
  pitchSurface: string | null;
  cracks: string | null;
  status: string;
  team1Score: string | null;
  team2Score: string | null;
  winnerId: number | null;
  result: string | null;
}

interface Tournament {
  id: number;
  name: string;
  country: string;
  numberOfGroups: number;
  roundRobinType: string;
  status: string;
  totalMatches: number;
  completedMatches: number;
}

interface TournamentDetails {
  tournament: Tournament;
  groups: Group[];
  matches: Match[];
}

export default function FixturesPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<TournamentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const fetchTournaments = useCallback(async () => {
    try {
      const res = await fetch('/api/fixtures');
      if (res.ok) {
        const data = await res.json();
        setTournaments(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching tournaments:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTournamentDetails = async (tournamentId: number) => {
    setLoadingDetails(true);
    try {
      const res = await fetch(`/api/fixtures?type=tournament&tournamentId=${tournamentId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedTournament(data);
      }
    } catch (error) {
      console.error('Error fetching tournament details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    fetchTournaments();
  }, [fetchTournaments]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-accent mx-auto mb-4" />
          <p className="text-gray-400">Loading fixtures...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Fixtures</h1>
        <p className="text-gray-400">View tournament schedules and match details</p>
      </div>

      {tournaments.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-6xl mb-4">🏏</div>
          <h2 className="text-xl font-semibold mb-2">No Tournaments Yet</h2>
          <p className="text-gray-400">Check back later for upcoming fixtures.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Tournament List */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-lg font-semibold">Tournaments</h2>
            {tournaments.map(tournament => (
              <button
                key={tournament.id}
                onClick={() => fetchTournamentDetails(tournament.id)}
                className={`w-full text-left p-4 rounded-lg transition-colors ${
                  selectedTournament?.tournament.id === tournament.id
                    ? 'bg-accent/20 border border-accent'
                    : 'bg-surface-light hover:bg-surface border border-transparent'
                }`}
              >
                <h3 className="font-medium">{tournament.name}</h3>
                <p className="text-sm text-gray-400">{tournament.country}</p>
                <div className="flex gap-4 mt-2 text-xs">
                  <span className={`px-2 py-0.5 rounded ${
                    tournament.status === 'ongoing' ? 'bg-green-500/20 text-green-400' :
                    tournament.status === 'completed' ? 'bg-gray-500/20 text-gray-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
                  </span>
                  <span className="text-gray-500">
                    {tournament.completedMatches}/{tournament.totalMatches} matches
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Tournament Details */}
          <div className="lg:col-span-3">
            {loadingDetails ? (
              <div className="card flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-accent" />
              </div>
            ) : selectedTournament ? (
              <div className="space-y-6">
                {/* Tournament Header */}
                <div className="card">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-2xl font-bold">{selectedTournament.tournament.name}</h2>
                      <p className="text-gray-400">
                        {selectedTournament.tournament.country} • {selectedTournament.tournament.roundRobinType === 'double' ? 'Double' : 'Single'} Round Robin
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      selectedTournament.tournament.status === 'ongoing' ? 'bg-green-500/20 text-green-400' :
                      selectedTournament.tournament.status === 'completed' ? 'bg-gray-500/20 text-gray-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {selectedTournament.tournament.status.charAt(0).toUpperCase() + selectedTournament.tournament.status.slice(1)}
                    </span>
                  </div>
                </div>

                {/* Points Table */}
                {selectedTournament.groups.map(group => (
                  <div key={group.id} className="card">
                    <h3 className="text-lg font-semibold mb-4">{group.name} - Points Table</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-gray-400 border-b border-border">
                            <th className="text-left py-2 px-2">#</th>
                            <th className="text-left py-2 px-2">Team</th>
                            <th className="text-center py-2 px-2">P</th>
                            <th className="text-center py-2 px-2">W</th>
                            <th className="text-center py-2 px-2">L</th>
                            <th className="text-center py-2 px-2">T</th>
                            <th className="text-center py-2 px-2">NRR</th>
                            <th className="text-center py-2 px-2">Pts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.teams.map((team, index) => (
                            <tr key={team.id} className="border-b border-border/50 hover:bg-surface-light">
                              <td className="py-3 px-2 text-gray-400">{index + 1}</td>
                              <td className="py-3 px-2 font-medium">{team.teamName}</td>
                              <td className="py-3 px-2 text-center">{team.played}</td>
                              <td className="py-3 px-2 text-center text-green-400">{team.won}</td>
                              <td className="py-3 px-2 text-center text-red-400">{team.lost}</td>
                              <td className="py-3 px-2 text-center">{team.tied}</td>
                              <td className="py-3 px-2 text-center">{team.nrr?.toFixed(3) || '0.000'}</td>
                              <td className="py-3 px-2 text-center font-bold text-accent">{team.points}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}

                {/* Match Schedule */}
                <div className="card">
                  <h3 className="text-lg font-semibold mb-4">Match Schedule</h3>
                  <div className="space-y-4">
                    {selectedTournament.matches.length === 0 ? (
                      <p className="text-gray-400 text-center py-4">No matches scheduled</p>
                    ) : (
                      selectedTournament.matches.map(match => (
                        <div 
                          key={match.id} 
                          className={`p-4 rounded-lg ${
                            match.status === 'completed' ? 'bg-surface-light/50' :
                            match.status === 'live' ? 'bg-green-500/10 border border-green-500/30' :
                            'bg-surface-light'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-xs text-gray-500">Match {match.matchNumber}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              match.status === 'live' ? 'bg-green-500/20 text-green-400' :
                              match.status === 'completed' ? 'bg-gray-500/20 text-gray-400' :
                              'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {match.status === 'live' ? '🔴 LIVE' : match.status.toUpperCase()}
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex-1">
                              <p className={`font-medium ${match.winnerId === match.team1Id ? 'text-green-400' : ''}`}>
                                {match.team1Name}
                                {match.team1Score && <span className="ml-2 text-gray-400">{match.team1Score}</span>}
                              </p>
                            </div>
                            <div className="px-4 text-gray-500">vs</div>
                            <div className="flex-1 text-right">
                              <p className={`font-medium ${match.winnerId === match.team2Id ? 'text-green-400' : ''}`}>
                                {match.team2Name}
                                {match.team2Score && <span className="mr-2 text-gray-400">{match.team2Score}</span>}
                              </p>
                            </div>
                          </div>

                          {match.result && (
                            <p className="text-sm text-accent mb-2">{match.result}</p>
                          )}

                          <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                            <span>📍 {match.venue}{match.city ? `, ${match.city}` : ''}</span>
                            {match.matchDate && <span>📅 {match.matchDate}</span>}
                            {match.matchTime && <span>🕐 {match.matchTime}</span>}
                          </div>

                          {(match.pitchType || match.pitchSurface || match.cracks) && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {match.pitchType && (
                                <span className="text-xs bg-surface px-2 py-1 rounded">
                                  Pitch: {match.pitchType}
                                </span>
                              )}
                              {match.pitchSurface && (
                                <span className="text-xs bg-surface px-2 py-1 rounded">
                                  Surface: {match.pitchSurface}
                                </span>
                              )}
                              {match.cracks && match.cracks !== 'None' && (
                                <span className="text-xs bg-surface px-2 py-1 rounded">
                                  Cracks: {match.cracks}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="card text-center py-12">
                <div className="text-4xl mb-4">👈</div>
                <p className="text-gray-400">Select a tournament to view details</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
