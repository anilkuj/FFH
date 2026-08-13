import { PLAYERS } from '../data.js';

// Valid formations for starting 11
const FORMATIONS = [
  { GKP: 1, DEF: 3, MID: 4, FWD: 3 },
  { GKP: 1, DEF: 3, MID: 5, FWD: 2 },
  { GKP: 1, DEF: 4, MID: 3, FWD: 3 },
  { GKP: 1, DEF: 4, MID: 4, FWD: 2 },
  { GKP: 1, DEF: 4, MID: 5, FWD: 1 },
  { GKP: 1, DEF: 5, MID: 3, FWD: 2 },
  { GKP: 1, DEF: 5, MID: 4, FWD: 1 },
  { GKP: 1, DEF: 5, MID: 2, FWD: 3 }
];

function getStartingXI(squad, gw) {
  // Find the best valid 11 starting players from the 15-player squad
  let bestPoints = -1;
  let best11 = [];

  const gkpList = squad.filter(p => p.position === 'GKP');
  const defList = squad.filter(p => p.position === 'DEF');
  const midList = squad.filter(p => p.position === 'MID');
  const fwdList = squad.filter(p => p.position === 'FWD');

  for (const form of FORMATIONS) {
    // Sort each position by expected points in this GW
    const gkps = [...gkpList].sort((a, b) => getPlayerPts(b, gw) - getPlayerPts(a, gw)).slice(0, form.GKP);
    const devs = [...defList].sort((a, b) => getPlayerPts(b, gw) - getPlayerPts(a, gw)).slice(0, form.DEF);
    const mids = [...midList].sort((a, b) => getPlayerPts(b, gw) - getPlayerPts(a, gw)).slice(0, form.MID);
    const fwds = [...fwdList].sort((a, b) => getPlayerPts(b, gw) - getPlayerPts(a, gw)).slice(0, form.FWD);

    if (gkps.length === form.GKP && devs.length === form.DEF && mids.length === form.MID && fwds.length === form.FWD) {
      const starters = [...gkps, ...devs, ...mids, ...fwds];
      const pts = starters.reduce((sum, p) => sum + getPlayerPts(p, gw), 0);
      if (pts > bestPoints) {
        bestPoints = pts;
        best11 = starters;
      }
    }
  }

  return { starters: best11, points: bestPoints };
}

function getPlayerPts(player, gw) {
  const pr = player.predictions.find(p => p.gw === gw);
  if (!pr) return 0;
  // Use the same minutes factor calculation as app.js
  const chance = (player.chanceOfPlaying !== null && player.chanceOfPlaying !== undefined) ? player.chanceOfPlaying / 100 : 1.0;
  return pr.pts * chance;
}

// Simple greedy solver for a single GW
function solveGw(gw) {
  // We want to pick 15 players: 2 GKP, 5 DEF, 5 MID, 3 FWD
  // Total cost <= 100.0
  // Max 3 per team
  // Maximize starters points (bench points not counted, or counted at 10% - let's try 0% first)
  
  // Start with cheap distinct players
  const cheapGKP = PLAYERS.filter(p => p.position === 'GKP').sort((a, b) => a.price - b.price).slice(0, 2);
  const cheapDEF = PLAYERS.filter(p => p.position === 'DEF').sort((a, b) => a.price - b.price).slice(0, 5);
  const cheapMID = PLAYERS.filter(p => p.position === 'MID').sort((a, b) => a.price - b.price).slice(0, 5);
  const cheapFWD = PLAYERS.filter(p => p.position === 'FWD').sort((a, b) => a.price - b.price).slice(0, 3);

  let squad = [...cheapGKP, ...cheapDEF, ...cheapMID, ...cheapFWD];

  function isValid(sq) {
    const ids = sq.map(p => p.id);
    if (new Set(ids).size !== sq.length) return false;
    const cost = sq.reduce((sum, p) => sum + p.price, 0);
    if (cost > 100.0) return false;
    const teamCounts = {};
    for (const p of sq) {
      teamCounts[p.team] = (teamCounts[p.team] || 0) + 1;
      if (teamCounts[p.team] > 3) return false;
    }
    return true;
  }

  // Local search optimization
  let improved = true;
  let currentScore = getStartingXI(squad, gw).points;

  const pool = PLAYERS.filter(p => p.chanceOfPlaying === null || p.chanceOfPlaying === undefined || p.chanceOfPlaying >= 75);

  while (improved) {
    improved = false;
    // Try single swaps
    for (let i = 0; i < squad.length; i++) {
      const replaced = squad[i];
      // Find players of same position
      const candidates = pool.filter(p => p.position === replaced.position && p.id !== replaced.id);
      for (const cand of candidates) {
        const nextSquad = [...squad];
        nextSquad[i] = cand;
        if (isValid(nextSquad)) {
          const score = getStartingXI(nextSquad, gw).points;
          if (score > currentScore + 0.01) {
            squad = nextSquad;
            currentScore = score;
            improved = true;
            break;
          }
        }
      }
      if (improved) break;
    }
  }

  return { squad, score: currentScore };
}

console.log("Solving GW1...");
const res1 = solveGw(1);
console.log(`GW1 optimal starting XI score: ${res1.score.toFixed(2)}`);
console.log("Squad players:");
res1.squad.forEach(p => console.log(`  ${p.web_name} (${p.position}) - £${p.price}m - ${getPlayerPts(p, 1).toFixed(2)} XP`));

let totalScore = 0;
for (let gw = 1; gw <= 38; gw++) {
  const res = solveGw(gw);
  totalScore += res.score;
}
console.log(`\nTotal Season Score (38 GWs): ${totalScore.toFixed(2)}`);
