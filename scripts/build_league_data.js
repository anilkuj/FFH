import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return await res.json();
}

async function buildLeagueData(leagueId = 59168) {
  console.log(`Fetching data for league ${leagueId}...`);
  const t0 = Date.now();

  // 1. Fetch League Standings & Bootstrap Static
  const [standingsData, boot] = await Promise.all([
    fetchJson(`https://fantasy.premierleague.com/api/leagues-classic/${leagueId}/standings/`),
    fetchJson(`https://fantasy.premierleague.com/api/bootstrap-static/`)
  ]);

  const league = standingsData.league;
  const entries = standingsData.standings.results;
  console.log(`Found league: "${league.name}" with ${entries.length} entries.`);

  // Build Teams map & Player map
  const teamsMap = {};
  boot.teams.forEach(t => {
    teamsMap[t.id] = { name: t.name, short: t.short_name };
  });

  const playersMap = {};
  boot.elements.forEach(p => {
    playersMap[p.id] = {
      id: p.id,
      name: p.web_name,
      fullName: `${p.first_name} ${p.second_name}`,
      team: teamsMap[p.team]?.short || '',
      position: p.element_type === 1 ? 'GKP' : p.element_type === 2 ? 'DEF' : p.element_type === 3 ? 'MID' : 'FWD'
    };
  });

  // Determine completed gameweeks
  const completedEvents = boot.events.filter(e => e.finished || e.is_current);
  const maxGw = completedEvents.length > 0 ? completedEvents[completedEvents.length - 1].id : 10;
  console.log(`Gameweeks played so far: 1 to ${maxGw}`);

  // 2. Fetch live points for all completed gameweeks to know player scores
  const livePointsByGw = {};
  console.log(`Fetching live points for GW 1..${maxGw}...`);
  const livePromises = [];
  for (let gw = 1; gw <= maxGw; gw++) {
    livePromises.push(
      fetchJson(`https://fantasy.premierleague.com/api/event/${gw}/live/`)
        .then(data => {
          const gwPoints = {};
          if (data && Array.isArray(data.elements)) {
            data.elements.forEach(el => {
              gwPoints[el.id] = el.stats.total_points || 0;
            });
          }
          livePointsByGw[gw] = gwPoints;
        })
        .catch(err => {
          console.warn(`Could not fetch live points for GW${gw}:`, err.message);
          livePointsByGw[gw] = {};
        })
    );
  }
  await Promise.all(livePromises);

  // 3. Fetch each manager's history and picks for all gameweeks
  console.log(`Fetching manager histories & picks...`);
  const managerDetails = [];

  for (const entry of entries) {
    const entryId = entry.entry;
    console.log(`- Fetching data for ${entry.player_name} (${entry.entry_name})...`);
    
    // History
    const history = await fetchJson(`https://fantasy.premierleague.com/api/entry/${entryId}/history/`);
    
    // Chips mapping
    const chipsByGw = {};
    if (history.chips && Array.isArray(history.chips)) {
      history.chips.forEach(c => {
        chipsByGw[c.event] = c.name; // 'wildcard', 'freehit', '3xc', 'bboost'
      });
    }

    // Picks for each GW
    const picksPromises = [];
    for (let gw = 1; gw <= maxGw; gw++) {
      picksPromises.push(
        fetchJson(`https://fantasy.premierleague.com/api/entry/${entryId}/event/${gw}/picks/`)
          .then(p => ({ gw, picks: p.picks || [], active_chip: p.active_chip || null, entry_history: p.entry_history || null }))
          .catch(() => ({ gw, picks: [], active_chip: null, entry_history: null }))
      );
    }
    const allPicks = await Promise.all(picksPromises);
    const picksByGw = {};
    allPicks.forEach(p => {
      picksByGw[p.gw] = p;
    });

    // Combine history for each GW
    const gwStats = {};
    if (history.current && Array.isArray(history.current)) {
      history.current.forEach(h => {
        const gw = h.event;
        const pickData = picksByGw[gw] || {};
        const capPick = pickData.picks?.find(x => x.is_captain || x.multiplier > 1);
        const vicePick = pickData.picks?.find(x => x.is_vice_captain);
        
        let capInfo = null;
        if (capPick) {
          const capPlayer = playersMap[capPick.element];
          const rawPts = livePointsByGw[gw]?.[capPick.element] || 0;
          const multiplier = capPick.multiplier || 2;
          capInfo = {
            id: capPick.element,
            name: capPlayer?.name || 'Captain',
            team: capPlayer?.team || '',
            multiplier: multiplier,
            rawPoints: rawPts,
            totalPoints: rawPts * multiplier,
            isTriple: multiplier === 3
          };
        }

        const chip = pickData.active_chip || chipsByGw[gw] || null;
        const grossPoints = h.points;
        const transferCost = h.event_transfers_cost || 0;
        const netPoints = grossPoints - transferCost;

        gwStats[gw] = {
          gw: gw,
          grossPoints: grossPoints,
          transferCost: transferCost,
          netPoints: netPoints,
          transfersMade: h.event_transfers || 0,
          totalPoints: h.total_points,
          rank: h.rank,
          overallRank: h.overall_rank,
          benchPoints: h.points_on_bench || 0,
          bank: (h.bank || 0) / 10,
          teamValue: (h.value || 0) / 10,
          chip: chip,
          captain: capInfo
        };
      });
    }

    managerDetails.push({
      entry: entryId,
      playerName: entry.player_name,
      teamName: entry.entry_name,
      badge: entry.club_badge_src,
      currentRank: entry.rank,
      currentTotal: entry.total,
      gwStats: gwStats
    });
  }

  // 4. Compute gameweek league ranks and standings for each gameweek (1..maxGw)
  const gameweeks = [];

  for (let gw = maxGw; gw >= 1; gw--) {
    const gwEvent = boot.events.find(e => e.id === gw);
    
    // Sort managers by that GW's points descending
    const managersForGw = managerDetails.map(m => {
      const stats = m.gwStats[gw] || {
        gw: gw,
        grossPoints: 0,
        transferCost: 0,
        netPoints: 0,
        transfersMade: 0,
        totalPoints: 0,
        overallRank: 0,
        benchPoints: 0,
        chip: null,
        captain: null
      };
      return {
        entry: m.entry,
        playerName: m.playerName,
        teamName: m.teamName,
        badge: m.badge,
        stats: stats
      };
    });

    // Primary sort: GW gross points descending (or net points; gross is official FPL GW points, we display both)
    managersForGw.sort((a, b) => b.stats.grossPoints - a.stats.grossPoints || b.stats.netPoints - a.stats.netPoints || a.playerName.localeCompare(b.playerName));

    // Assign GW ranks (1..8) with ties handled
    let currentRank = 1;
    for (let i = 0; i < managersForGw.length; i++) {
      if (i > 0 && managersForGw[i].stats.grossPoints === managersForGw[i - 1].stats.grossPoints) {
        managersForGw[i].gwRank = managersForGw[i - 1].gwRank;
      } else {
        managersForGw[i].gwRank = currentRank;
      }
      currentRank++;
    }

    // Also calculate cumulative league standings up to this gameweek
    const cumulativeStandings = managerDetails.map(m => ({
      entry: m.entry,
      playerName: m.playerName,
      teamName: m.teamName,
      badge: m.badge,
      totalPoints: m.gwStats[gw]?.totalPoints || 0
    })).sort((a, b) => b.totalPoints - a.totalPoints);

    cumulativeStandings.forEach((m, idx) => {
      m.leagueRank = idx + 1;
    });

    // Attach cumulative league rank to each manager in this GW
    managersForGw.forEach(m => {
      const cum = cumulativeStandings.find(c => c.entry === m.entry);
      m.cumulativeLeagueRank = cum ? cum.leagueRank : null;
      m.cumulativeTotalPoints = cum ? cum.totalPoints : null;

      // Calculate rank change compared to previous GW (gw - 1)
      if (gw > 1) {
        const prevStandings = managerDetails.map(pm => ({
          entry: pm.entry,
          totalPoints: pm.gwStats[gw - 1]?.totalPoints || 0
        })).sort((a, b) => b.totalPoints - a.totalPoints);
        const prevRank = prevStandings.findIndex(p => p.entry === m.entry) + 1;
        m.rankChange = prevRank - m.cumulativeLeagueRank; // positive = moved up, negative = moved down
      } else {
        m.rankChange = 0;
      }
    });

    // Gameweek stats summary
    const scores = managersForGw.map(m => m.stats.grossPoints);
    const avgScore = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
    const highScore = Math.max(...scores);
    const lowScore = Math.min(...scores);
    const winner = managersForGw.find(m => m.stats.grossPoints === highScore);

    gameweeks.push({
      gw: gw,
      name: gwEvent?.name || `Gameweek ${gw}`,
      deadline: gwEvent?.deadline_time || null,
      averageScore: avgScore,
      highScore: highScore,
      lowScore: lowScore,
      winner: {
        playerName: winner?.playerName,
        teamName: winner?.teamName,
        points: highScore
      },
      managers: managersForGw
    });
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    league: {
      id: league.id,
      name: league.name,
      adminEntry: league.admin_entry,
      created: league.created,
      scoring: league.scoring
    },
    currentGameweek: maxGw,
    overallStandings: entries.map(e => ({
      entry: e.entry,
      rank: e.rank,
      lastRank: e.last_rank,
      playerName: e.player_name,
      teamName: e.entry_name,
      total: e.total,
      eventTotal: e.event_total,
      badge: e.club_badge_src
    })),
    gameweeks: gameweeks // In descending order: GW10, GW9, ... GW1
  };

  const outputPath = path.join(__dirname, '..', 'league_59168_data.json');
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
  console.log(`Saved league data to ${outputPath} in ${Date.now() - t0}ms!`);
  return payload;
}

buildLeagueData().catch(err => {
  console.error('Error building league data:', err);
  process.exit(1);
});
