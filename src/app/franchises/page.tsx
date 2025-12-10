import { db } from '@/db';
import { teams, players } from '@/db/schema';

export const revalidate = 30;

export default async function FranchisesPage() {
  const allTeams = await db.select().from(teams);
  const allPlayers = await db.select().from(players);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">League Franchises</h1>
          <p className="text-gray-400">View active rosters and contracts.</p>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Search teams or players..."
            className="input pl-10 w-64"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {allTeams.map((team) => {
          const teamPlayers = allPlayers.filter(p => p.teamId === team.id);
          
          return (
            <div key={team.id} className="card">
              {/* Team Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                    <span className="text-accent font-bold text-sm">{team.name}</span>
                  </div>
                  <div>
                    <h2 className="font-bold">{team.name}</h2>
                    <p className="text-xs text-gray-500">ID: {team.ownerId}</p>
                  </div>
                </div>
                <div className="bg-accent text-black text-xs font-bold px-2 py-1 rounded">
                  {teamPlayers.length}/{team.maxSize}
                </div>
              </div>

              {/* Purse Display */}
              <div className="bg-surface-light rounded-lg p-3 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Remaining Purse</span>
                  <span className="text-lg font-bold text-accent font-mono">
                    ${(team.purse / 1000000).toFixed(2)}M
                  </span>
                </div>
              </div>

              {/* Players List */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {teamPlayers.map((player, index) => (
                  <div 
                    key={player.id} 
                    className="flex items-center justify-between p-2 bg-surface-light rounded-lg hover:bg-surface transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500 text-sm w-4">{index + 1}</span>
                      <span className="font-medium">{player.name}</span>
                    </div>
                    <span className="text-xs text-gray-500 font-mono bg-surface px-2 py-1 rounded">
                      {player.playerId}
                    </span>
                  </div>
                ))}
                {teamPlayers.length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-4">No players yet</p>
                )}
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

      {/* Footer */}
      <div className="text-center text-sm text-gray-500 pt-8">
        Built for Wispbyte Server. Powered by Discord.
      </div>
    </div>
  );
}
