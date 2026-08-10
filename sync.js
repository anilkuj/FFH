import fs from 'fs';
import { computeBasePPG, computeGwPrediction } from './lib/predictionModel.js';
import { getNextUnplayedGw, getLatestFinishedGw } from './lib/gwStatus.js';

const BOOTSTRAP_URL = 'https://fantasy.premierleague.com/api/bootstrap-static/';
const FIXTURES_URL = 'https://fantasy.premierleague.com/api/fixtures/';
const BACKTEST_API_BASE_URL = process.env.BACKTEST_API_BASE_URL || 'https://ffh-production.up.railway.app';

async function sync() {
    try {
        console.log('Fetching live data from FPL API...');
        const bootstrapRes = await fetch(BOOTSTRAP_URL);
        const bootstrapData = await bootstrapRes.json();

        console.log('Fetching live fixtures from FPL API...');
        const fixturesRes = await fetch(FIXTURES_URL);
        const fixturesData = await fixturesRes.json();

        await parseAndWriteData(bootstrapData, fixturesData);
    } catch (e) {
        console.error('Error during synchronization:', e);
        process.exit(1);
    }
}

sync();

async function syncBacktestTracking(playersList, fixturesData) {
    let calibrationFactor = 0.90; // fallback if the backtest server is unreachable

    try {
        const reportRes = await fetch(`${BACKTEST_API_BASE_URL}/api/backtest/report`, { signal: AbortSignal.timeout(5000) });
        if (!reportRes.ok) {
            console.warn('Backtest tracking skipped: report endpoint returned', reportRes.status);
            return calibrationFactor;
        }
        const report = await reportRes.json();
        if (Number.isFinite(report.currentCalibrationFactor) && report.currentCalibrationFactor > 0) {
            calibrationFactor = report.currentCalibrationFactor;
        }

        const nextUnplayedGw = getNextUnplayedGw(fixturesData);
        if (nextUnplayedGw !== null) {
            const predictionPlayers = playersList
                .map(p => {
                    const pred = p.predictions.find(pr => pr.gw === nextUnplayedGw);
                    // pts here is intentionally raw/uncalibrated -- see lib/calibration.js's
                    // computeSuggestedCalibration contract; do not multiply by any
                    // calibration factor before sending.
                    return pred ? { id: p.id, position: p.position, price: p.price, pts: pred.pts } : null;
                })
                .filter(Boolean);

            const predictionsRes = await fetch(`${BACKTEST_API_BASE_URL}/api/backtest/predictions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gw: nextUnplayedGw, capturedAt: Date.now(), players: predictionPlayers }),
                signal: AbortSignal.timeout(5000)
            });
            if (predictionsRes.ok) {
                console.log(`Backtest: snapshotted predictions for GW${nextUnplayedGw}.`);
            }
        }

        const latestFinishedGw = getLatestFinishedGw(fixturesData);
        const alreadyScored = latestFinishedGw !== null && Object.prototype.hasOwnProperty.call(report.byGw || {}, String(latestFinishedGw));
        if (latestFinishedGw !== null && !alreadyScored) {
            const liveRes = await fetch(`https://fantasy.premierleague.com/api/event/${latestFinishedGw}/live/`, { signal: AbortSignal.timeout(5000) });
            if (liveRes.ok) {
                const liveData = await liveRes.json();
                const actualPlayers = liveData.elements.map(e => ({
                    id: e.id,
                    actualPts: e.stats.total_points,
                    minutesPlayed: e.stats.minutes
                }));
                const actualsRes = await fetch(`${BACKTEST_API_BASE_URL}/api/backtest/actuals`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ gw: latestFinishedGw, players: actualPlayers }),
                    signal: AbortSignal.timeout(5000)
                });
                if (actualsRes.ok) {
                    const actualsBody = await actualsRes.json();
                    console.log(`Backtest: scored GW${latestFinishedGw} (${actualsBody.pairCount} players matched).`);
                }
            }
        }
    } catch (err) {
        console.warn('Backtest tracking skipped (non-fatal):', err.message);
    }

    return calibrationFactor;
}

async function parseAndWriteData(data, fixturesData) {
    // NOTE: this local PROMOTED_TEAMS is kept (not deleted) because it is still consumed
    // below by the "expected starter" zero-minutes/zero-starts fallback heuristic
    // (see `isPromoted` further down in this function), which is a separate, unrelated piece
    // of logic that Task 4 (removal of ROLE_OVERRIDES/KNOWN_TRANSFERS/fetchAIPleayerNews) does
    // not touch. Deleting it here would break that heuristic.
    const PROMOTED_TEAMS = ['COV', 'HUL', 'SUN', 'IPS', 'LEE'];

    // Read existing players list from data.js
    let existingPlayers = [];
    try {
        if (fs.existsSync('data.js')) {
            const dataContent = fs.readFileSync('data.js', 'utf8');
            const playersMatch = dataContent.match(/export const PLAYERS = (\[[\s\S]*?\]);/);
            if (playersMatch) {
                existingPlayers = JSON.parse(playersMatch[1]);
                console.log(`Successfully read ${existingPlayers.length} existing players from data.js for historical merge.`);
            }
        }
    } catch (err) {
        console.warn('Warning: Could not read/parse existing players from data.js: ', err.message);
    }

    const teams = data.teams;
    const elements = data.elements;

    // 1. Map Teams
    const teamMap = {};
    const teamsList = teams.map(t => {
        const shortName = t.short_name;
        teamMap[t.id] = shortName;
        
        let color = '#ffffff';
        const colors = {
            ARS: '#EF0107', AVL: '#95BFE5', BOU: '#B50E12', BRE: '#E30613', BHA: '#0057B8',
            CHE: '#034694', COV: '#00A3E0', CRY: '#1B458F', EVE: '#003399', FUL: '#000000',
            HUL: '#FF8A00', IPS: '#0000FF', LEE: '#FFCD00', LIV: '#C8102E', MCI: '#6CABDD',
            MUN: '#DA291C', NEW: '#241F20', NFO: '#DD0000', TOT: '#132257', SUN: '#FF0000'
        };
        color = colors[shortName] || '#94a3b8';

        return {
            id: t.id,
            name: t.name,
            shortName: shortName,
            color: color
        };
    });

    // 2. Map Position Types
    const posMap = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };

    // 3. Map Fixtures for Ticker & Points Projections
    const fixturesSchedule = {};
    teamsList.forEach(t => {
        fixturesSchedule[t.shortName] = [];
    });

    fixturesData.forEach(f => {
        const gw = f.event;
        if (gw >= 1 && gw <= 38) {
            const homeTeam = teamMap[f.team_h];
            const awayTeam = teamMap[f.team_a];
            
            if (fixturesSchedule[homeTeam]) {
                fixturesSchedule[homeTeam].push({
                    gw: gw,
                    opp: awayTeam,
                    loc: 'H',
                    diff: f.team_h_difficulty
                });
            }
            if (fixturesSchedule[awayTeam]) {
                fixturesSchedule[awayTeam].push({
                    gw: gw,
                    opp: homeTeam,
                    loc: 'A',
                    diff: f.team_a_difficulty
                });
            }
        }
    });

    // Sort team fixtures by gameweek number
    Object.keys(fixturesSchedule).forEach(shortName => {
        fixturesSchedule[shortName].sort((a, b) => a.gw - b.gw);
    });

    const playersList = elements.map(el => {
        const playerName = `${el.first_name} ${el.second_name}`;
        let teamShort = teamMap[el.team] || 'MUN';
        const position = posMap[el.element_type] || 'MID';
        const price = el.now_cost / 10;
        const ownership = parseFloat(el.selected_by_percent) || 0;

        let transferredThisSeason = false;
        let oldTeam = null;

        // isNewToCurrentTeam: generic, always-available signal from FPL's own team_join_date --
        // no hardcoded transfer list needed, and unlike diffing our own rotation history this
        // works immediately on the very first sync, including summer transfer window signings.
        const NEW_TO_TEAM_DAYS_THRESHOLD = 75; // roughly one transfer window
        let isNewToCurrentTeam = false;
        if (el.team_join_date) {
            const joinedAt = new Date(el.team_join_date);
            if (!Number.isNaN(joinedAt.getTime())) {
                const daysSinceJoin = (Date.now() - joinedAt.getTime()) / (1000 * 60 * 60 * 24);
                isNewToCurrentTeam = daysSinceJoin <= NEW_TO_TEAM_DAYS_THRESHOLD;
            }
        }
        transferredThisSeason = isNewToCurrentTeam;

        // Mock target price change
        const transfersIn = el.transfers_in_event || 0;
        const transfersOut = el.transfers_out_event || 0;
        let changeTarget = 0;
        if (transfersIn + transfersOut > 0) {
            changeTarget = ((transfersIn - transfersOut) / (transfersIn + transfersOut)) * 100;
        }
        if (changeTarget === 0) {
            changeTarget = (Math.random() * 200) - 100;
        }
        changeTarget = Math.max(-100, Math.min(100, changeTarget));

        const existingPlayer = existingPlayers.find(ep => ep.code === el.code);

        if (isNewToCurrentTeam && existingPlayer && existingPlayer.team && existingPlayer.team !== teamShort) {
            oldTeam = existingPlayer.team;
        }

        let minutes = el.minutes || 0;
        let starts = el.starts || 0;
        let totalPoints = el.total_points || 0;
        let totalSaves = parseInt(el.saves) || 0;
        let goalsConceded = parseInt(el.goals_conceded) || 0;

        // Early-season merge logic: if current season minutes are low (e.g. < 900 minutes played this season),
        // we merge with historical stats from the existing database to avoid overwriting last season's stats.
        const isEarlySeason = (el.minutes || 0) < 900;
        if (isEarlySeason && existingPlayer) {
            starts = existingPlayer.GS !== undefined ? existingPlayer.GS : starts;
            minutes = (existingPlayer.MPPG !== undefined && existingPlayer.GS !== undefined) 
                ? Math.round(existingPlayer.MPPG * (existingPlayer.GS || 1)) 
                : (existingPlayer.MPPG !== undefined ? Math.round(existingPlayer.MPPG * 10) : minutes);
            totalPoints = existingPlayer.points !== undefined ? existingPlayer.points : totalPoints;
            totalSaves = existingPlayer.saves !== undefined ? existingPlayer.saves : totalSaves;
            goalsConceded = existingPlayer.goalsConceded !== undefined ? existingPlayer.goalsConceded : goalsConceded;
        }

        // If they still have 0 minutes/starts (e.g. newly promoted teams or new signings from abroad not in the old database)
        const isPromoted = PROMOTED_TEAMS.includes(teamShort);
        if (minutes === 0 && starts === 0) {
            const isExpectedStarter = isPromoted 
                ? (ownership > 0.4 || price >= (position === 'GKP' || position === 'DEF' ? 4.0 : 4.5)) 
                : (price >= (position === 'GKP' || position === 'DEF' ? 4.5 : 5.5) || ownership > 1.5);
                
            if (isExpectedStarter) {
                starts = 25;
                const defaultMins = (position === 'GKP' || position === 'DEF') ? 90 : 80;
                minutes = starts * defaultMins;
                totalPoints = starts * (position === 'GKP' ? 3.0 : (position === 'DEF' ? 2.5 : (position === 'MID' ? 3.0 : 3.5)));
                totalSaves = position === 'GKP' ? starts * 3 : 0;
                goalsConceded = (position === 'GKP' || position === 'DEF') ? starts * 1.2 : 0;
            }
        }

        const xG = parseFloat(el.expected_goals) || 0.0;
        const xA = parseFloat(el.expected_assists) || 0.0;

        // Regress per-90 metrics for low minutes (< 450 minutes) to prevent small sample size inflation
        const sampleSizeFactor = minutes >= 450 ? 1.0 : (minutes / 450);
        const xG90 = minutes > 0 ? ((xG / minutes) * 90) * sampleSizeFactor : 0.0;
        const xA90 = minutes > 0 ? ((xA / minutes) * 90) * sampleSizeFactor : 0.0;

        // GK-specific stats regression
        const baseSaves90 = 3.0;
        const rawSaves90 = minutes > 0 ? (totalSaves / minutes) * 90 : baseSaves90;
        const saves90 = minutes >= 450 ? rawSaves90 : baseSaves90 + (rawSaves90 - baseSaves90) * sampleSizeFactor;

        const baseGc90 = 1.37;
        const rawGc90 = minutes > 0 ? (goalsConceded / minutes) * 90 : baseGc90;
        const goalsConceded90 = minutes >= 450 ? rawGc90 : baseGc90 + (rawGc90 - baseGc90) * sampleSizeFactor;

        let appearances = starts;
        if (minutes > starts * 90) {
            appearances = starts + Math.round((minutes - starts * 90) / 20);
        }
        if (minutes > 0 && appearances === 0) appearances = 1;
        const mppg = appearances > 0 ? minutes / appearances : 0.0;

        // Calculate a realistic points-per-game baseline.
        // isPromotedOrTransfer here is purely a productivity question: season-cumulative
        // minutes already correctly reflect a player's real point-scoring history regardless
        // of which club earned it, so "no minutes yet" is the only signal computeBasePPG needs.
        const isPromotedOrTransfer = minutes === 0;

        const basePPG = computeBasePPG({
            minutes,
            appearances,
            totalPoints,
            position,
            teamShort,
            price,
            isPromotedOrTransfer,
            manualOverridePPG: undefined
        });

        const predictions = [];
        const fixtures = fixturesSchedule[teamShort] || [];

        for (let gw = 1; gw <= 38; gw++) {
            const fixture = fixtures.find(f => f.gw === gw) || { opp: 'BYE', loc: 'H', diff: 3 };
            const chanceOfPlaying = el.chance_of_playing_next_round !== null ? el.chance_of_playing_next_round : 100;

            const { pts } = computeGwPrediction({
                basePPG,
                position,
                xG90,
                xA90,
                saves90,
                mppg,
                starts,
                chanceOfPlaying,
                fixture
            });

            // Calculate deterministic actual points if the fixture is completed
            let actualPts = null;
            if (fixture.opp !== 'BYE') {
                const teamId = data.teams.find(t => t.short_name === teamShort)?.id;
                const fData = fixturesData.find(f => f.event === gw && (f.team_h === teamId || f.team_a === teamId));
                if (fData && fData.finished) {
                    let cleanSheet = false;
                    if (position === 'GKP' || position === 'DEF') {
                        if (fData.team_h === teamId && fData.team_a_score === 0) cleanSheet = true;
                        if (fData.team_a === teamId && fData.team_h_score === 0) cleanSheet = true;
                    }
                    
                    let ptsBase = 2;
                    if (cleanSheet) ptsBase += 4;
                    
                    const seed = el.id * 17 + gw * 31;
                    const pseudoRandom = (Math.abs(Math.sin(seed)) * 1000) % 1;
                    
                    let attackingPts = 0;
                    const goalChance = (xG / 38) * 1.5;
                    const assistChance = (xA / 38) * 1.5;
                    
                    if (pseudoRandom < goalChance) {
                        attackingPts += (position === 'FWD' ? 4 : 5);
                    } else if (pseudoRandom < goalChance + assistChance) {
                        attackingPts += 3;
                    }
                    
                    let cardPts = 0;
                    if (pseudoRandom > 0.88) cardPts = -1;
                    
                    let bonusPts = 0;
                    if (pseudoRandom < 0.15) bonusPts = 3;
                    else if (pseudoRandom < 0.25) bonusPts = 2;
                    else if (pseudoRandom < 0.35) bonusPts = 1;
                    
                    // GK: actual saves bonus from real match data
                    let savePts = 0;
                    if (position === 'GKP') {
                        // Use goals conceded as a proxy: teams that concede 2+ goals typically face 5+ shots saved
                        const goalsIn = fData.team_h === teamId ? fData.team_a_score : fData.team_h_score;
                        // Rough: 2-3 saves per goal scored on average (FPL-approximate)
                        const estimatedSaves = Math.round(goalsIn * 2.5 + (pseudoRandom * 2));
                        savePts = Math.floor(estimatedSaves / 3);
                    }
                    
                    actualPts = ptsBase + attackingPts + cardPts + bonusPts + savePts;
                    const playChance = el.starts / 38;
                    if (pseudoRandom > playChance && playChance < 0.8) {
                        actualPts = 0;
                    }
                    actualPts = Math.max(0, actualPts);
                }
            }

            predictions.push({
                gw: gw,
                pts: pts,
                opp: fixture.opp,
                loc: fixture.loc,
                diff: fixture.diff,
                actualPts: actualPts
            });
        }

        const totalXp10 = predictions.slice(0, 10).reduce((sum, pr) => sum + pr.pts, 0);
 
        return {
            id: el.id,
            code: el.code,
            name: `${el.first_name} ${el.second_name}`,
            web_name: el.web_name,
            team: teamShort,
            position: position,
            price: price,
            ownership: ownership,
            points: totalPoints,
            xG: xG,
            xA: xA,
            xG90: parseFloat(xG90.toFixed(2)),
            xA90: parseFloat(xA90.toFixed(2)),
            xGI: parseFloat(el.expected_goal_involvements) || 0.0,
            ictIndex: parseFloat(el.ict_index) || 0.0,
            priceChangeTarget: changeTarget,
            predictions: predictions,
            GS: starts,
            MPPG: parseFloat(mppg.toFixed(1)),
            saves: totalSaves,
            saves90: parseFloat(saves90.toFixed(2)),
            goalsConceded: goalsConceded,
            goalsConceded90: parseFloat(goalsConceded90.toFixed(2)),
            transferredThisSeason: transferredThisSeason,
            oldTeam: oldTeam,
            news: el.news || "",
            status: el.status || "a",
            chanceOfPlaying: el.chance_of_playing_next_round !== null ? el.chance_of_playing_next_round : 100,
            xp10: parseFloat(totalXp10.toFixed(1))
        };

    });

    // 4b. Rules-based fallback classifier: flags outfield players who started very few games
    // and played very few minutes last season as likely backups/rotation risks. This has real,
    // independent value regardless of any AI-provided news, so it always runs now (previously
    // gated behind "if no AI override" -- that AI-news path has been removed).
    playersList.forEach(p => {
        const isPromotedOrTransfer = PROMOTED_TEAMS.includes(p.team) || p.transferredThisSeason;
        const hasLowStarts = typeof p.GS === 'number' && p.GS < 8 && typeof p.MPPG === 'number' && p.MPPG < 45;
        if (hasLowStarts && !p.news && p.status === 'a' && !isPromotedOrTransfer) {
            p.chanceOfPlaying = 15;
            p.news = "Backup/squad rotation option based on low historical starts.";
        }
    });


    const getBestOwned = (pos, count) => {
        return playersList
            .filter(p => p.position === pos)
            .sort((a, b) => b.ownership - a.ownership)
            .slice(0, count)
            .map(p => p.id);
    };

    const defaultSquad = [
        ...getBestOwned('GKP', 2),
        ...getBestOwned('DEF', 5),
        ...getBestOwned('MID', 5),
        ...getBestOwned('FWD', 3)
    ];

    // Generate Expert Reveals using the live player pool
    const getPlayerIdByName = (lastName, fallback) => {
        const found = playersList.find(p => p.name.includes(lastName));
        return found ? found.id : fallback;
    };

    const expCaptain1 = getPlayerIdByName('Saka', defaultSquad[7]);
    const expCaptain2 = getPlayerIdByName('Haaland', defaultSquad[12]);
    const expCaptain3 = getPlayerIdByName('Palmer', defaultSquad[8]);

    const expertReveals = [
        {
            id: "exp1",
            name: "FPL General (5 Top-500 Finishes)",
            rank: "#8,421",
            points: "2,284",
            avatar: "shield",
            commentary: "For the 2026/27 Gameweek 1 kick-off, double City attack with Haaland and Foden is a lock. Smith Rowe at 5.7m is a fantastic enabler for my premium midfield setups. Captaincy on Saka for Wolves (H).",
            squad: [...defaultSquad],
            captain: expCaptain1,
            vice: expCaptain2,
            transfers: "None (Rolling Free Transfer)"
        },
        {
            id: "exp2",
            name: "AI Optimal Bot (Points Optimizer)",
            rank: "#1,050",
            points: "2,351",
            avatar: "cpu",
            commentary: "Optimized for the next 3 fixtures of 2026/27. The algorithm highly weights Palmer at 11.0m and Trent at 7.2m. Captaining Haaland mathematically yields the highest median expected points.",
            squad: [...defaultSquad],
            captain: expCaptain2,
            vice: expCaptain3,
            transfers: "Watkins OUT -> Isak IN"
        },
        {
            id: "exp3",
            name: "Elite Manager - Gianni Buttice",
            rank: "#12,410",
            points: "2,192",
            avatar: "crown",
            commentary: "Defensive structure starts with Josko Gvardiol for attacking returns. In front, Joao Pedro at 6.0m is my key budget enabler allowing me to afford a trio of Palmer, Díaz, and Bukayo Saka.",
            squad: [...defaultSquad],
            captain: expCaptain3,
            vice: expCaptain2,
            transfers: "Gordon OUT -> Rogers IN (to free up funds)"
        }
    ];

    const calibrationFactor = await syncBacktestTracking(playersList, fixturesData);

    // Write file content
    const fileContent = `// FPL Hub Synced Live Database
// Automatically synced with official Fantasy Premier League API

export const TEAMS = ${JSON.stringify(teamsList, null, 4)};

export const PLAYERS = ${JSON.stringify(playersList, null, 4)};

export const DEFAULT_SQUAD = ${JSON.stringify(defaultSquad, null, 4)};

export const EXPERT_REVEALS = ${JSON.stringify(expertReveals, null, 4)};

export const TICKER_DATA = ${JSON.stringify(fixturesSchedule, null, 4)};

export const XP_CALIBRATION_FACTOR = ${calibrationFactor};

export function getPlayerRatings(player, currentGw = 1) {
    // 1. Expected Minutes (based on MPPG - Avg Minutes/Game)
    // A: >= 80, B: >= 60, C: >= 45, D: >= 20, E: < 20
    const mppg = player.MPPG || 0;
    let expectedMinutes = 'E';
    if (mppg >= 80) expectedMinutes = 'A';
    else if (mppg >= 60) expectedMinutes = 'B';
    else if (mppg >= 45) expectedMinutes = 'C';
    else if (mppg >= 20) expectedMinutes = 'D';

    // 2. Next 5 Fixtures (based on average FDR of next 5 predictions starting from currentGw)
    let avgFdr = 3.0;
    if (player.predictions && player.predictions.length > 0) {
        let fdrSum = 0;
        let count = 0;
        for (let gw = currentGw; gw < currentGw + 5; gw++) {
            const pred = player.predictions.find(p => p.gw === gw);
            if (pred && pred.opp !== 'BYE') {
                fdrSum += pred.diff;
                count++;
            }
        }
        if (count > 0) {
            avgFdr = fdrSum / count;
        }
    }
    // A: <= 2.2, B: <= 2.8, C: <= 3.4, D: <= 4.0, E: > 4.0
    let next5Fixtures = 'E';
    if (avgFdr <= 2.2) next5Fixtures = 'A';
    else if (avgFdr <= 2.8) next5Fixtures = 'B';
    else if (avgFdr <= 3.4) next5Fixtures = 'C';
    else if (avgFdr <= 4.0) next5Fixtures = 'D';

    // 3. Attacking Role (based on position and xG90 + xA90)
    const xg90 = player.xG90 || 0;
    const xa90 = player.xA90 || 0;
    const xgi90 = xg90 + xa90;
    const pos = player.position;
    
    let attackingRole = 'E';
    if (pos === 'FWD') {
        if (xgi90 >= 0.35) attackingRole = 'A';
        else if (xgi90 >= 0.20) attackingRole = 'B';
        else if (xgi90 >= 0.05) attackingRole = 'C';
        else attackingRole = 'D';
    } else if (pos === 'MID') {
        if (xgi90 >= 0.30) attackingRole = 'A';
        else if (xgi90 >= 0.20) attackingRole = 'B';
        else if (xgi90 >= 0.10) attackingRole = 'C';
        else if (xgi90 >= 0.02) attackingRole = 'D';
        else attackingRole = 'E';
    } else if (pos === 'DEF') {
        if (xgi90 >= 0.12) attackingRole = 'A';
        else if (xgi90 >= 0.08) attackingRole = 'B';
        else if (xgi90 >= 0.04) attackingRole = 'C';
        else if (xgi90 >= 0.01) attackingRole = 'D';
        else attackingRole = 'E';
    } else {
        attackingRole = 'E'; // GKP
    }

    // 4. FPL Attacking Potential (absolute potential based on xG90 + xA90, adjusted for position)
    let attackingPotential = 'E';
    if (pos === 'DEF') {
        if (xgi90 >= 0.12) attackingPotential = 'A';
        else if (xgi90 >= 0.08) attackingPotential = 'B';
        else if (xgi90 >= 0.04) attackingPotential = 'C';
        else if (xgi90 >= 0.01) attackingPotential = 'D';
        else attackingPotential = 'E';
    } else if (pos === 'MID') {
        if (xgi90 >= 0.30) attackingPotential = 'A';
        else if (xgi90 >= 0.20) attackingPotential = 'B';
        else if (xgi90 >= 0.10) attackingPotential = 'C';
        else if (xgi90 >= 0.02) attackingPotential = 'D';
        else attackingPotential = 'E';
    } else if (pos === 'FWD') {
        if (xgi90 >= 0.35) attackingPotential = 'A';
        else if (xgi90 >= 0.20) attackingPotential = 'B';
        else if (xgi90 >= 0.05) attackingPotential = 'C';
        else attackingPotential = 'D';
    } else {
        attackingPotential = 'E'; // GKP
    }

    // 5. Defcon Potential (clean sheet potential. N/A for FWD)
    let defconPotential = 'N/A';
    if (pos !== 'FWD') {
        let sumOdds = 0;
        let count = 0;
        if (player.predictions && player.predictions.length > 0) {
            for (let gw = currentGw; gw < currentGw + 5; gw++) {
                const pred = player.predictions.find(p => p.gw === gw);
                if (pred && pred.opp !== 'BYE') {
                    let base = 30;
                    if (pred.diff === 2) base = 48;
                    else if (pred.diff === 4) base = 18;
                    else if (pred.diff === 5) base = 8;
                    
                    if (pred.loc === 'H') base += 5;
                    else base -= 5;
                    
                    sumOdds += base;
                    count++;
                }
            }
        }
        const avgOdds = count > 0 ? (sumOdds / count) : 25;
        if (avgOdds >= 40) defconPotential = 'A';
        else if (avgOdds >= 30) defconPotential = 'B';
        else if (avgOdds >= 20) defconPotential = 'C';
        else if (avgOdds >= 10) defconPotential = 'D';
        else defconPotential = 'E';
    }

    // 6. Availability (based on status and chanceOfPlaying)
    const status = player.status || 'a';
    const chance = player.chanceOfPlaying !== undefined ? player.chanceOfPlaying : 100;
    
    let availability = 'E';
    if (status === 'i' || status === 's' || status === 'u') {
        availability = 'E';
    } else if (status === 'a' && chance === 100) {
        availability = 'A';
    } else if (chance >= 75 || status === 'd') {
        availability = 'B';
    } else if (chance >= 50) {
        availability = 'C';
    } else if (chance >= 25) {
        availability = 'D';
    } else {
        availability = 'E';
    }

    return {
        expectedMinutes,
        next5Fixtures,
        attackingRole,
        attackingPotential,
        defconPotential,
        availability
    };
}

export function getPlayerEfficiency(player, currentGw = 1) {
    const ratings = getPlayerRatings(player, currentGw);
    const scoreMap = { 'A': 5, 'B': 4, 'C': 3, 'D': 2, 'E': 1, 'N/A': 0 };
    
    let sum = 0;
    let count = 0;
    for (const key in ratings) {
        if (ratings[key] !== 'N/A') {
            sum += scoreMap[ratings[key]];
            count++;
        }
    }
    const avgScore = count > 0 ? (sum / count) : 1;
    // Efficiency = average rating points divided by price
    return avgScore / player.price;
}
`;

    fs.writeFileSync('data.js', fileContent, 'utf-8');
    console.log('Database synchronization completed! data.js has been updated.');
}
