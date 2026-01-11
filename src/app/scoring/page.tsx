'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

interface Match {
  id: number;
  matchNumber: number;
  team1Id: number;
  team2Id: number;
  team1Name: string;
  team2Name: string;
  venue: string;
  status: string;
}

interface Player {
  id: number;
  name: string;
  category: string;
}

interface LiveState {
  matchId: number;
  currentInningsId: number;
  currentInningsNumber: number;
  battingTeamId: number;
  bowlingTeamId: number;
  strikerId: number | null;
  strikerName: string | null;
  nonStrikerId: number | null;
  nonStrikerName: string | null;
  currentBowlerId: number | null;
  currentBowlerName: string | null;
  currentOver: number;
  currentBall: number;
  isLive: boolean;
}

interface InningsData {
  id: number;
  teamId: number;
  inningsNumber: number;
  totalRuns: number;
  wickets: number;
  overs: number;
  extras: number;
  target: number | null;
}

interface BattingPerf {
  playerId: number;
  playerName: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  howOut: string | null;
  isOut: boolean;
}

interface BowlingPerf {
  playerId: number;
  playerName: string;
  overs: number;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
}

export default function ScoringPage() {
  const { data: session, status } = useSession();
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [liveState, setLiveState] = useState<LiveState | null>(null);
  const [inningsData, setInningsData] = useState<InningsData[]>([]);
  const [battingData, setBattingData] = useState<BattingPerf[]>([]);
  const [bowlingData, setBowlingData] = useState<BowlingPerf[]>([]);
  const [battingTeamPlayers, setBattingTeamPlayers] = useState<Player[]>([]);
  const [bowlingTeamPlayers, setBowlingTeamPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [showMatchSetup, setShowMatchSetup] = useState(false);
  const [tossWinner, setTossWinner] = useState<number | null>(null);
  const [tossDecision, setTossDecision] = useState<'bat' | 'bowl'>('bat');

  const [showBatsmanSelect, setShowBatsmanSelect] = useState(false);
  const [showBowlerSelect, setShowBowlerSelect] = useState(false);
  const [selectedStriker, setSelectedStriker] = useState<number | null>(null);
  const [selectedNonStriker, setSelectedNonStriker] = useState<number | null>(null);
  const [selectedBowler, setSelectedBowler] = useState<number | null>(null);

  const [showWicketModal, setShowWicketModal] = useState(false);
  const [wicketType, setWicketType] = useState('bowled');
  const [dismissedBatsman, setDismissedBatsman] = useState<'striker' | 'nonstriker'>('striker');
  const [fielder, setFielder] = useState<number | null>(null);
  const [pendingRuns, setPendingRuns] = useState(0);

  const ADMIN_IDS = ['256972361918578688', '1111497896018313268'];
  const isAdmin = session?.user?.id && ADMIN_IDS.includes(session.user.id);

  useEffect(() => {
    async function fetchMatches() {
      try {
        const res = await fetch('/api/scoring?type=matches');
        if (res.ok) setMatches(await res.json());
      } catch (error) {
        console.error('Error fetching matches:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchMatches();
  }, []);

  const fetchScorecard = useCallback(async () => {
    if (!selectedMatch) return;
    try {
      const res = await fetch(`/api/scoring?type=scorecard&matchId=${selectedMatch.id}`);
      if (res.ok) {
        const data = await res.json();
        setLiveState(data.liveState);
        setInningsData(data.innings);
        setBattingData(data.batting.filter((b: BattingPerf) => 
          data.liveState && data.batting.find((x: any) => x.inningsId === data.liveState.currentInningsId && x.playerId === b.playerId)
        ));
        setBowlingData(data.bowling.filter((b: BowlingPerf) =>
          data.liveState && data.bowling.find((x: any) => x.inningsId === data.liveState.currentInningsId && x.playerId === b.playerId)
        ));
      }
    } catch (error) {
      console.error('Error fetching scorecard:', error);
    }
  }, [selectedMatch]);

  const fetchPlayers = useCallback(async (battingTeamId: number, bowlingTeamId: number) => {
    try {
      const [battingRes, bowlingRes] = await Promise.all([
        fetch(`/api/scoring?type=players&teamId=${battingTeamId}`),
        fetch(`/api/scoring?type=players&teamId=${bowlingTeamId}`),
      ]);
      if (battingRes.ok) setBattingTeamPlayers(await battingRes.json());
      if (bowlingRes.ok) setBowlingTeamPlayers(await bowlingRes.json());
    } catch (error) {
      console.error('Error fetching players:', error);
    }
  }, []);

  useEffect(() => {
    if (selectedMatch) {
      fetchScorecard();
      const interval = setInterval(fetchScorecard, 3000);
      return () => clearInterval(interval);
    }
  }, [selectedMatch, fetchScorecard]);

  useEffect(() => {
    if (liveState?.battingTeamId && liveState?.bowlingTeamId) {
      fetchPlayers(liveState.battingTeamId, liveState.bowlingTeamId);
    }
  }, [liveState?.battingTeamId, liveState?.bowlingTeamId, fetchPlayers]);

  const startMatch = async () => {
    if (!selectedMatch || !tossWinner) return;
    try {
      const res = await fetch('/api/scoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_match', matchId: selectedMatch.id, tossWinnerId: tossWinner, tossDecision }),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Match started!' });
        setShowMatchSetup(false);
        fetchScorecard();
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to start match' });
    }
  };

  const setBatsmen = async () => {
    if (!selectedMatch || !liveState || !selectedStriker || !selectedNonStriker) return;
    const striker = battingTeamPlayers.find(p => p.id === selectedStriker);
    const nonStriker = battingTeamPlayers.find(p => p.id === selectedNonStriker);
    try {
      const res = await fetch('/api/scoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_batsmen', matchId: selectedMatch.id, inningsId: liveState.currentInningsId,
          strikerId: selectedStriker, strikerName: striker?.name,
          nonStrikerId: selectedNonStriker, nonStrikerName: nonStriker?.name,
        }),
      });
      if (res.ok) {
        setShowBatsmanSelect(false);
        setSelectedStriker(null);
        setSelectedNonStriker(null);
        fetchScorecard();
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to set batsmen' });
    }
  };

  const setBowler = async () => {
    if (!selectedMatch || !liveState || !selectedBowler) return;
    const bowler = bowlingTeamPlayers.find(p => p.id === selectedBowler);
    try {
      const res = await fetch('/api/scoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_bowler', matchId: selectedMatch.id, inningsId: liveState.currentInningsId, bowlerId: selectedBowler, bowlerName: bowler?.name }),
      });
      if (res.ok) {
        setShowBowlerSelect(false);
        setSelectedBowler(null);
        fetchScorecard();
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to set bowler' });
    }
  };

  const recordDelivery = async (runs: number, options: any = {}) => {
    if (!selectedMatch || !liveState) return;
    try {
      const res = await fetch('/api/scoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'record_delivery', matchId: selectedMatch.id, inningsId: liveState.currentInningsId, runs, ...options }),
      });
      const data = await res.json();
      if (res.ok) {
        fetchScorecard();
        if (options.isWicket) setShowBatsmanSelect(true);
        if (data.overs && data.overs.endsWith('.1') && liveState.currentBall === 6) setShowBowlerSelect(true);
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to record delivery' });
    }
  };

  const handleWicket = async () => {
    if (!liveState) return;
    const dismissedId = dismissedBatsman === 'striker' ? liveState.strikerId : liveState.nonStrikerId;
    const dismissedName = dismissedBatsman === 'striker' ? liveState.strikerName : liveState.nonStrikerName;
    const fielderPlayer = fielder ? bowlingTeamPlayers.find(p => p.id === fielder) : null;
    await recordDelivery(pendingRuns, {
      isWicket: true, wicketType, dismissedBatsmanId: dismissedId, dismissedBatsmanName: dismissedName,
      fielderId: fielder, fielderName: fielderPlayer?.name,
    });
    setShowWicketModal(false);
    setWicketType('bowled');
    setDismissedBatsman('striker');
    setFielder(null);
    setPendingRuns(0);
    setShowBatsmanSelect(true);
  };

  const swapBatsmen = async () => {
    if (!selectedMatch) return;
    await fetch('/api/scoring', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'swap_batsmen', matchId: selectedMatch.id }) });
    fetchScorecard();
  };

  const endInnings = async () => {
    if (!selectedMatch || !liveState || !confirm('End this innings?')) return;
    const res = await fetch('/api/scoring', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'end_innings', matchId: selectedMatch.id, inningsId: liveState.currentInningsId }) });
    if (res.ok) { setMessage({ type: 'success', text: 'Innings ended' }); fetchScorecard(); }
  };

  const endMatch = async () => {
    if (!selectedMatch) return;
    const result = prompt('Enter match result:');
    if (!result) return;
    const winnerIdStr = prompt('Enter winner team ID (blank for tie):');
    const res = await fetch('/api/scoring', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'end_match', matchId: selectedMatch.id, result, winnerId: winnerIdStr ? parseInt(winnerIdStr) : null }) });
    if (res.ok) { setMessage({ type: 'success', text: 'Match ended!' }); setSelectedMatch(null); setLiveState(null); }
  };

  const currentInnings = inningsData.find(i => i.id === liveState?.currentInningsId);

  if (status === 'loading' || loading) return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center"><div className="text-xl">Loading...</div></div>;
  if (!isAdmin) return <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center"><h1 className="text-2xl font-bold mb-4">Access Denied</h1><p className="text-gray-400">Only admins can access scoring.</p><Link href="/" className="mt-4 text-blue-400 hover:underline">Go Home</Link></div>;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">🏏 Live Scoring</h1>
          <Link href="/" className="text-blue-400 hover:underline">← Back</Link>
        </div>

        {message && <div className={`p-3 rounded mb-4 ${message.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>{message.text}</div>}

        {!selectedMatch && (
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-4">Select Match to Score</h2>
            <div className="grid gap-3">
              {matches.filter(m => m.status !== 'completed').map(match => (
                <button key={match.id} onClick={() => { setSelectedMatch(match); if (match.status === 'upcoming') setShowMatchSetup(true); }} className="bg-gray-700 p-4 rounded-lg text-left hover:bg-gray-600">
                  <div className="font-semibold">Match #{match.matchNumber}</div>
                  <div className="text-lg">{match.team1Name} vs {match.team2Name}</div>
                  <div className="text-sm text-gray-400">{match.venue}</div>
                  <span className={`text-xs px-2 py-1 rounded ${match.status === 'live' ? 'bg-red-600' : 'bg-blue-600'}`}>{match.status.toUpperCase()}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {showMatchSetup && selectedMatch && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4">
              <h2 className="text-xl font-bold mb-4">Start Match</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-2">Toss Winner</label>
                  <select value={tossWinner || ''} onChange={(e) => setTossWinner(parseInt(e.target.value))} className="w-full bg-gray-700 rounded p-2">
                    <option value="">Select...</option>
                    <option value={selectedMatch.team1Id}>{selectedMatch.team1Name}</option>
                    <option value={selectedMatch.team2Id}>{selectedMatch.team2Name}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-2">Elected to</label>
                  <div className="flex gap-4">
                    <button onClick={() => setTossDecision('bat')} className={`flex-1 p-3 rounded ${tossDecision === 'bat' ? 'bg-green-600' : 'bg-gray-700'}`}>🏏 Bat</button>
                    <button onClick={() => setTossDecision('bowl')} className={`flex-1 p-3 rounded ${tossDecision === 'bowl' ? 'bg-green-600' : 'bg-gray-700'}`}>⚾ Bowl</button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={startMatch} disabled={!tossWinner} className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 p-3 rounded font-semibold">Start Match</button>
                  <button onClick={() => { setShowMatchSetup(false); setSelectedMatch(null); }} className="px-4 bg-gray-600 hover:bg-gray-700 rounded">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedMatch && liveState?.isLive && (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-semibold">{selectedMatch.team1Name} vs {selectedMatch.team2Name}</h2>
                  <p className="text-gray-400 text-sm">Innings {liveState.currentInningsNumber}</p>
                </div>
                <button onClick={() => setSelectedMatch(null)} className="text-gray-400 hover:text-white">✕</button>
              </div>

              <div className="text-center py-4 bg-gray-900 rounded-lg mb-4">
                <div className="text-4xl font-bold">{currentInnings?.totalRuns || 0}/{currentInnings?.wickets || 0}</div>
                <div className="text-xl text-gray-400">({liveState.currentOver}.{liveState.currentBall} overs)</div>
                {currentInnings?.target && <div className="text-lg text-yellow-400">Target: {currentInnings.target} | Need {currentInnings.target - (currentInnings?.totalRuns || 0)}</div>}
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-900 rounded p-3">
                  <div className="text-sm text-gray-400 mb-2">Batting</div>
                  {liveState.strikerName ? (
                    <div className="space-y-1">
                      <div className="flex justify-between"><span className="font-semibold">⚾ {liveState.strikerName}*</span><span>{battingData.find(b => b.playerId === liveState.strikerId)?.runs || 0}({battingData.find(b => b.playerId === liveState.strikerId)?.balls || 0})</span></div>
                      <div className="flex justify-between text-gray-400"><span>{liveState.nonStrikerName}</span><span>{battingData.find(b => b.playerId === liveState.nonStrikerId)?.runs || 0}({battingData.find(b => b.playerId === liveState.nonStrikerId)?.balls || 0})</span></div>
                    </div>
                  ) : <button onClick={() => setShowBatsmanSelect(true)} className="w-full bg-blue-600 hover:bg-blue-700 p-2 rounded">Select Batsmen</button>}
                  <button onClick={swapBatsmen} className="mt-2 text-xs text-blue-400 hover:underline">🔄 Swap Strike</button>
                </div>
                <div className="bg-gray-900 rounded p-3">
                  <div className="text-sm text-gray-400 mb-2">Bowling</div>
                  {liveState.currentBowlerName ? (
                    <div className="flex justify-between font-semibold"><span>🎯 {liveState.currentBowlerName}</span><span>{bowlingData.find(b => b.playerId === liveState.currentBowlerId)?.wickets || 0}-{bowlingData.find(b => b.playerId === liveState.currentBowlerId)?.runs || 0}</span></div>
                  ) : <button onClick={() => setShowBowlerSelect(true)} className="w-full bg-blue-600 hover:bg-blue-700 p-2 rounded">Select Bowler</button>}
                  <button onClick={() => setShowBowlerSelect(true)} className="mt-2 text-xs text-blue-400 hover:underline">🔄 Change Bowler</button>
                </div>
              </div>

              {liveState.strikerName && liveState.currentBowlerName && (
                <div className="space-y-3">
                  <div className="grid grid-cols-7 gap-2">
                    {[0, 1, 2, 3, 4, 5, 6].map(runs => (
                      <button key={runs} onClick={() => recordDelivery(runs, { isFour: runs === 4, isSix: runs === 6 })} className={`p-4 rounded font-bold text-xl ${runs === 4 ? 'bg-blue-600' : runs === 6 ? 'bg-purple-600' : 'bg-gray-700'} hover:opacity-80`}>{runs}</button>
                    ))}
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    <button onClick={() => recordDelivery(0, { extraType: 'wide', extraRuns: 1 })} className="p-3 bg-yellow-600 hover:bg-yellow-700 rounded font-semibold">Wide</button>
                    <button onClick={() => recordDelivery(0, { extraType: 'noball', extraRuns: 1 })} className="p-3 bg-yellow-600 hover:bg-yellow-700 rounded font-semibold">No Ball</button>
                    <button onClick={() => recordDelivery(0, { extraType: 'bye', extraRuns: 1 })} className="p-3 bg-gray-600 hover:bg-gray-700 rounded font-semibold">Bye</button>
                    <button onClick={() => recordDelivery(0, { extraType: 'legbye', extraRuns: 1 })} className="p-3 bg-gray-600 hover:bg-gray-700 rounded font-semibold">Leg Bye</button>
                    <button onClick={() => setShowWicketModal(true)} className="p-3 bg-red-600 hover:bg-red-700 rounded font-semibold">WICKET</button>
                  </div>
                  <div className="flex gap-2 pt-4 border-t border-gray-700">
                    <button onClick={endInnings} className="flex-1 bg-orange-600 hover:bg-orange-700 p-3 rounded font-semibold">End Innings</button>
                    <button onClick={endMatch} className="flex-1 bg-red-600 hover:bg-red-700 p-3 rounded font-semibold">End Match</button>
                    <Link href={`/scorecard?matchId=${selectedMatch.id}`} target="_blank" className="px-4 bg-blue-600 hover:bg-blue-700 p-3 rounded font-semibold text-center">📺 View</Link>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-semibold mb-3">Batting</h3>
              <table className="w-full text-sm">
                <thead><tr className="text-gray-400 text-left"><th>Batsman</th><th className="text-center">R</th><th className="text-center">B</th><th className="text-center">4s</th><th className="text-center">6s</th><th className="text-center">SR</th></tr></thead>
                <tbody>
                  {battingData.map(bat => (
                    <tr key={bat.playerId} className="border-t border-gray-700">
                      <td className="py-2">{bat.playerName}{bat.playerId === liveState.strikerId && ' *'}{bat.howOut && <span className="text-gray-400 text-xs ml-2">({bat.howOut})</span>}</td>
                      <td className="text-center">{bat.runs}</td><td className="text-center">{bat.balls}</td><td className="text-center">{bat.fours}</td><td className="text-center">{bat.sixes}</td><td className="text-center">{bat.strikeRate?.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-semibold mb-3">Bowling</h3>
              <table className="w-full text-sm">
                <thead><tr className="text-gray-400 text-left"><th>Bowler</th><th className="text-center">O</th><th className="text-center">M</th><th className="text-center">R</th><th className="text-center">W</th><th className="text-center">Econ</th></tr></thead>
                <tbody>
                  {bowlingData.map(bowl => (
                    <tr key={bowl.playerId} className="border-t border-gray-700">
                      <td className="py-2">{bowl.playerName}{bowl.playerId === liveState.currentBowlerId && ' *'}</td>
                      <td className="text-center">{bowl.overs?.toFixed(1)}</td><td className="text-center">{bowl.maidens}</td><td className="text-center">{bowl.runs}</td><td className="text-center">{bowl.wickets}</td><td className="text-center">{bowl.economy?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showBatsmanSelect && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4">
              <h2 className="text-xl font-bold mb-4">Select Batsmen</h2>
              <div className="space-y-4">
                <div><label className="block text-sm mb-2">Striker</label><select value={selectedStriker || ''} onChange={(e) => setSelectedStriker(parseInt(e.target.value))} className="w-full bg-gray-700 rounded p-2"><option value="">Select...</option>{battingTeamPlayers.filter(p => !battingData.some(b => b.playerId === p.id && b.isOut) && p.id !== selectedNonStriker).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                <div><label className="block text-sm mb-2">Non-Striker</label><select value={selectedNonStriker || ''} onChange={(e) => setSelectedNonStriker(parseInt(e.target.value))} className="w-full bg-gray-700 rounded p-2"><option value="">Select...</option>{battingTeamPlayers.filter(p => !battingData.some(b => b.playerId === p.id && b.isOut) && p.id !== selectedStriker).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                <div className="flex gap-2"><button onClick={setBatsmen} disabled={!selectedStriker || !selectedNonStriker} className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 p-3 rounded font-semibold">Confirm</button><button onClick={() => setShowBatsmanSelect(false)} className="px-4 bg-gray-600 rounded">Cancel</button></div>
              </div>
            </div>
          </div>
        )}

        {showBowlerSelect && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4">
              <h2 className="text-xl font-bold mb-4">Select Bowler</h2>
              <div className="space-y-4">
                <div><label className="block text-sm mb-2">Bowler</label><select value={selectedBowler || ''} onChange={(e) => setSelectedBowler(parseInt(e.target.value))} className="w-full bg-gray-700 rounded p-2"><option value="">Select...</option>{bowlingTeamPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                <div className="flex gap-2"><button onClick={setBowler} disabled={!selectedBowler} className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 p-3 rounded font-semibold">Confirm</button><button onClick={() => setShowBowlerSelect(false)} className="px-4 bg-gray-600 rounded">Cancel</button></div>
              </div>
            </div>
          </div>
        )}

        {showWicketModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4">
              <h2 className="text-xl font-bold mb-4 text-red-400">⚠️ WICKET</h2>
              <div className="space-y-4">
                <div><label className="block text-sm mb-2">Type</label><select value={wicketType} onChange={(e) => setWicketType(e.target.value)} className="w-full bg-gray-700 rounded p-2"><option value="bowled">Bowled</option><option value="caught">Caught</option><option value="lbw">LBW</option><option value="runout">Run Out</option><option value="stumped">Stumped</option><option value="hitwicket">Hit Wicket</option></select></div>
                <div><label className="block text-sm mb-2">Who got out?</label><div className="flex gap-2"><button onClick={() => setDismissedBatsman('striker')} className={`flex-1 p-2 rounded ${dismissedBatsman === 'striker' ? 'bg-red-600' : 'bg-gray-700'}`}>{liveState?.strikerName}</button><button onClick={() => setDismissedBatsman('nonstriker')} className={`flex-1 p-2 rounded ${dismissedBatsman === 'nonstriker' ? 'bg-red-600' : 'bg-gray-700'}`}>{liveState?.nonStrikerName}</button></div></div>
                {['caught', 'runout', 'stumped'].includes(wicketType) && <div><label className="block text-sm mb-2">Fielder</label><select value={fielder || ''} onChange={(e) => setFielder(parseInt(e.target.value))} className="w-full bg-gray-700 rounded p-2"><option value="">Select...</option>{bowlingTeamPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>}
                <div><label className="block text-sm mb-2">Runs</label><div className="flex gap-2">{[0, 1, 2, 3].map(r => <button key={r} onClick={() => setPendingRuns(r)} className={`flex-1 p-2 rounded ${pendingRuns === r ? 'bg-blue-600' : 'bg-gray-700'}`}>{r}</button>)}</div></div>
                <div className="flex gap-2"><button onClick={handleWicket} className="flex-1 bg-red-600 hover:bg-red-700 p-3 rounded font-semibold">Confirm</button><button onClick={() => setShowWicketModal(false)} className="px-4 bg-gray-600 rounded">Cancel</button></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
