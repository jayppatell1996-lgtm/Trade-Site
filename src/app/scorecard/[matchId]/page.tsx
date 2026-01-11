'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function ScorecardPage() {
  const params = useParams();
  const matchId = params.matchId as string;
  
  const [loading, setLoading] = useState(true);
  const [scorecard, setScorecard] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'scorecard' | 'commentary'>('scorecard');

  const fetchScorecard = useCallback(async () => {
    try {
      const res = await fetch(`/api/scoring?type=scorecard&matchId=${matchId}`);
      if (res.ok) {
        const data = await res.json();
        setScorecard(data);
      }
    } catch (error) {
      console.error('Error fetching scorecard:', error);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    fetchScorecard();
    // Auto-refresh for live matches
    const interval = setInterval(fetchScorecard, 10000);
    return () => clearInterval(interval);
  }, [fetchScorecard]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-accent" />
      </div>
    );
  }

  if (!scorecard) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-400">Scorecard not found</p>
          <Link href="/fixtures" className="text-accent hover:underline mt-2 inline-block">
            ← Back to Fixtures
          </Link>
        </div>
      </div>
    );
  }

  const { match, innings } = scorecard;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Match Header */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <Link href="/fixtures" className="text-sm text-gray-400 hover:text-white">
              ← Back to Fixtures
            </Link>
            <span className={`text-xs px-2 py-1 rounded ${
              match.status === 'completed' ? 'bg-green-500/20 text-green-400' :
              match.status === 'live' ? 'bg-red-500/20 text-red-400' :
              'bg-yellow-500/20 text-yellow-400'
            }`}>
              {match.status === 'live' && '🔴 '}{match.status.toUpperCase()}
            </span>
          </div>

          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">
              {match.team1Name} vs {match.team2Name}
            </h1>
            <p className="text-gray-400">
              {match.venue}{match.city && `, ${match.city}`}
              {match.matchDate && ` • ${match.matchDate}`}
            </p>
          </div>

          {/* Scores Summary */}
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className={`text-center p-4 rounded-lg ${match.winnerId === match.team1Id ? 'bg-green-500/10 ring-1 ring-green-500' : 'bg-surface-light'}`}>
              <p className="font-medium mb-1">{match.team1Name}</p>
              <p className="text-2xl font-bold">{match.team1Score || 'Yet to bat'}</p>
            </div>
            <div className={`text-center p-4 rounded-lg ${match.winnerId === match.team2Id ? 'bg-green-500/10 ring-1 ring-green-500' : 'bg-surface-light'}`}>
              <p className="font-medium mb-1">{match.team2Name}</p>
              <p className="text-2xl font-bold">{match.team2Score || 'Yet to bat'}</p>
            </div>
          </div>

          {match.result && (
            <div className="mt-4 text-center">
              <p className="text-accent font-medium">{match.result}</p>
            </div>
          )}

          {match.tossWinnerId && (
            <p className="text-sm text-gray-400 text-center mt-2">
              Toss: {match.tossWinnerId === match.team1Id ? match.team1Name : match.team2Name} won and elected to {match.tossDecision}
            </p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('scorecard')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'scorecard' ? 'bg-accent text-white' : 'bg-surface-light hover:bg-surface'
            }`}
          >
            Scorecard
          </button>
          <button
            onClick={() => setActiveTab('commentary')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'commentary' ? 'bg-accent text-white' : 'bg-surface-light hover:bg-surface'
            }`}
          >
            Commentary
          </button>
        </div>

        {activeTab === 'scorecard' && (
          <div className="space-y-6">
            {innings.map((inn: any, index: number) => (
              <div key={inn.id} className="card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">
                    {inn.teamName} - {inn.inningsNumber === 1 ? '1st' : '2nd'} Innings
                  </h2>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{inn.totalRuns || 0}/{inn.totalWickets || 0}</p>
                    <p className="text-sm text-gray-400">({inn.totalOvers || 0} overs)</p>
                  </div>
                </div>

                {/* Batting Card */}
                <div className="mb-6">
                  <h3 className="text-sm text-gray-400 mb-2 uppercase tracking-wide">Batting</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-400 border-b border-gray-700">
                          <th className="pb-2">Batsman</th>
                          <th className="pb-2 text-right">R</th>
                          <th className="pb-2 text-right">B</th>
                          <th className="pb-2 text-right">4s</th>
                          <th className="pb-2 text-right">6s</th>
                          <th className="pb-2 text-right">SR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inn.batting?.map((bat: any) => (
                          <tr key={bat.id} className="border-b border-gray-800">
                            <td className="py-2">
                              <div>
                                <span className="font-medium">{bat.playerName}</span>
                                {bat.isNotOut && <span className="text-accent ml-1">*</span>}
                                {bat.didNotBat && <span className="text-gray-500 ml-1">(DNB)</span>}
                              </div>
                              {bat.howOut && (
                                <p className="text-xs text-gray-500">
                                  {bat.howOut === 'bowled' && `b ${bat.bowlerName}`}
                                  {bat.howOut === 'caught' && `c ${bat.fielderName} b ${bat.bowlerName}`}
                                  {bat.howOut === 'lbw' && `lbw b ${bat.bowlerName}`}
                                  {bat.howOut === 'runout' && `run out (${bat.fielderName || 'direct'})`}
                                  {bat.howOut === 'stumped' && `st ${bat.fielderName} b ${bat.bowlerName}`}
                                  {bat.howOut === 'hitwicket' && `hit wicket b ${bat.bowlerName}`}
                                </p>
                              )}
                            </td>
                            <td className="py-2 text-right font-medium">{bat.runs || 0}</td>
                            <td className="py-2 text-right text-gray-400">{bat.balls || 0}</td>
                            <td className="py-2 text-right text-gray-400">{bat.fours || 0}</td>
                            <td className="py-2 text-right text-gray-400">{bat.sixes || 0}</td>
                            <td className="py-2 text-right text-gray-400">{(bat.strikeRate || 0).toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Extras */}
                  <div className="mt-3 text-sm text-gray-400">
                    <span>Extras: </span>
                    <span className="text-white">{inn.extras || 0}</span>
                    <span className="ml-2">
                      (Wd {inn.wides || 0}, Nb {inn.noBalls || 0}, B {inn.byes || 0}, Lb {inn.legByes || 0})
                    </span>
                  </div>
                </div>

                {/* Bowling Card */}
                <div className="mb-6">
                  <h3 className="text-sm text-gray-400 mb-2 uppercase tracking-wide">Bowling</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-400 border-b border-gray-700">
                          <th className="pb-2">Bowler</th>
                          <th className="pb-2 text-right">O</th>
                          <th className="pb-2 text-right">M</th>
                          <th className="pb-2 text-right">R</th>
                          <th className="pb-2 text-right">W</th>
                          <th className="pb-2 text-right">Econ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inn.bowling?.map((bowl: any) => (
                          <tr key={bowl.id} className="border-b border-gray-800">
                            <td className="py-2 font-medium">{bowl.playerName}</td>
                            <td className="py-2 text-right">{bowl.overs || 0}</td>
                            <td className="py-2 text-right text-gray-400">{bowl.maidens || 0}</td>
                            <td className="py-2 text-right">{bowl.runs || 0}</td>
                            <td className="py-2 text-right font-medium text-accent">{bowl.wickets || 0}</td>
                            <td className="py-2 text-right text-gray-400">{(bowl.economy || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Fall of Wickets */}
                {inn.fallOfWickets?.length > 0 && (
                  <div>
                    <h3 className="text-sm text-gray-400 mb-2 uppercase tracking-wide">Fall of Wickets</h3>
                    <div className="flex flex-wrap gap-2 text-sm">
                      {inn.fallOfWickets.map((fow: any, i: number) => (
                        <span key={i} className="bg-surface-light px-2 py-1 rounded">
                          {fow.score}/{fow.wicketNumber} ({fow.batsmanName}, {fow.overs} ov)
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Partnerships */}
                {inn.partnerships?.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm text-gray-400 mb-2 uppercase tracking-wide">Partnerships</h3>
                    <div className="space-y-2">
                      {inn.partnerships.map((p: any, i: number) => (
                        <div key={i} className="bg-surface-light p-2 rounded text-sm flex justify-between">
                          <span>
                            {p.batsman1Name} ({p.batsman1Runs}) & {p.batsman2Name} ({p.batsman2Runs})
                          </span>
                          <span className="font-medium">{p.totalRuns} runs ({p.totalBalls} balls)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'commentary' && (
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Ball-by-Ball Commentary</h2>
            <p className="text-gray-500 text-center py-8">Commentary will appear here during live matches</p>
          </div>
        )}

        {/* Match Info */}
        <div className="card mt-6">
          <h2 className="text-lg font-semibold mb-4">Match Info</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400">Venue</p>
              <p>{match.venue}{match.city && `, ${match.city}`}</p>
            </div>
            {match.matchDate && (
              <div>
                <p className="text-gray-400">Date</p>
                <p>{match.matchDate} {match.matchTime && `at ${match.matchTime}`}</p>
              </div>
            )}
            {match.pitchType && (
              <div>
                <p className="text-gray-400">Pitch</p>
                <p>{match.pitchType} • {match.pitchSurface || 'Medium'}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
