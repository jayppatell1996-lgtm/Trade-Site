import { db } from '@/db';
import { teams, players } from '@/db/schema';

export const revalidate = 30;

export default async function FranchisesPage() {
  const allTeams = await db.select().from(teams);
  const allPlayers = await db.select().from(players);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Franchises</h1>
        <p className="text-gray-400">View all teams, rosters, and remaining purse</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {allTeams.map((team) => {
          const teamPlayers = allPlayers.filter(p => p.teamId === team.id);
          const rosterPercent = (teamPlayers.length / team.maxSize) * 100;
          
          return (
            <div key={team.id} className="card">
              {/* Team Header */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-border">
                <div>
                  <h2 className="text-xl font-bold text-accent">{team.name}</h2>
                  {team.ownerName && (
                    <p className="text-sm text-gray-400">Owner: {team.ownerName}</p>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold font-mono text-accent">
                    ${(team.purse / 1000000).toFixed(2)}M
                  </div>
                  <div className="text-xs text-gray-500">Remaining Purse</div>
                </div>
              </div>

              {/* Roster Progress */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-400">Roster</span>
                  <span className="font-mono">{teamPlayers.length}/{team.maxSize}</span>
                </div>
                <div className="w-full bg-background rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all ${
                      rosterPercent >= 90 ? 'bg-red-500' :
                      rosterPercent >= 70 ? 'bg-yellow-500' :
                      'bg-accent'
                    }`}
                    style={{ width: `${rosterPercent}%` }}
                  />
                </div>
              </div>

              {/* Players List */}
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">Players</h3>
                {teamPlayers.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {teamPlayers.map((player) => (
                      <div 
                        key={player.id} 
                        className="px-3 py-1 bg-surface-light rounded-full text-sm flex items-center gap-2"
                      >
                        <span>{player.name}</span>
                        {player.boughtFor && (
                          <span className="text-xs text-accent font-mono">
                            ${(player.boughtFor / 1000000).toFixed(1)}M
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No players yet</p>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
                <div className="text-center">
                  <div className="text-lg font-bold">{teamPlayers.length}</div>
                  <div className="text-xs text-gray-500">Players</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold">{team.maxSize - teamPlayers.length}</div>
                  <div className="text-xs text-gray-500">Slots Left</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold font-mono">
                    ${(team.purse / 1000000).toFixed(1)}M
                  </div>
                  <div className="text-xs text-gray-500">Budget</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {allTeams.length === 0 && (
        <div className="card text-center py-12">
          <div className="text-6xl mb-4">🏟️</div>
          <h2 className="text-xl font-semibold mb-2">No Franchises Yet</h2>
          <p className="text-gray-400">Teams will appear here once created by admins.</p>
        </div>
      )}
    </div>
  );
}
