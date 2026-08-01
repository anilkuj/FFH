import fs from 'fs';
import https from 'https';

const BOOTSTRAP_URL = 'https://fantasy.premierleague.com/api/bootstrap-static/';
const FIXTURES_URL = 'https://fantasy.premierleague.com/api/fixtures/';

console.log('Fetching live data from FPL API...');

https.get(BOOTSTRAP_URL, (res1) => {
    let body1 = '';
    res1.on('data', (chunk) => body1 += chunk);
    res1.on('end', () => {
        try {
            const bootstrapData = JSON.parse(body1);
            
            console.log('Fetching live fixtures from FPL API...');
            https.get(FIXTURES_URL, (res2) => {
                let body2 = '';
                res2.on('data', (chunk) => body2 += chunk);
                res2.on('end', () => {
                    try {
                        const fixturesData = JSON.parse(body2);
                        parseAndWriteData(bootstrapData, fixturesData);
                    } catch (e) {
                        console.error('Failed to parse fixtures: ', e.message);
                    }
                });
            }).on('error', (err) => {
                console.error('Failed to fetch fixtures: ', err.message);
            });
            
        } catch (e) {
            console.error('Failed to parse FPL bootstrap data: ', e.message);
        }
    });
}).on('error', (err) => {
    console.error('Failed to fetch FPL API: ', err.message);
});

function parseAndWriteData(data, fixturesData) {
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
        if (gw >= 1 && gw <= 10) {
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

        const KNOWN_TRANSFERS = {
            "Morgan Rogers": { oldTeam: "AVL", newTeam: "CHE" },
            "João Gomes": { oldTeam: "WOL", newTeam: "AVL" },
            "Joao Gomes": { oldTeam: "WOL", newTeam: "AVL" },
            "Youri Tielemans": { oldTeam: "AVL", newTeam: "MUN" },
            "Elliot Anderson": { oldTeam: "NFO", newTeam: "MCI" },
            "Christos Tzolis": { oldTeam: "Club Brugge", newTeam: "ARS" },
            "Piero Hincapie": { oldTeam: "Bayer Leverkusen", newTeam: "ARS" },
            "Piero Hincapié": { oldTeam: "Bayer Leverkusen", newTeam: "ARS" },
            "Illan Meslier": { oldTeam: "Leeds United", newTeam: "ARS" },
            "Alejandro Garnacho": { oldTeam: "MUN", newTeam: "AVL" }
        };

        for (const [key, val] of Object.entries(KNOWN_TRANSFERS)) {
            if (playerName.includes(key)) {
                transferredThisSeason = true;
                oldTeam = val.oldTeam;
                teamShort = val.newTeam;
                break;
            }
        }
        
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

        const minutes = el.minutes || 0;
        const starts = el.starts || 0;
        const xG = parseFloat(el.expected_goals) || 0.0;
        const xA = parseFloat(el.expected_assists) || 0.0;
        const xG90 = minutes > 0 ? (xG / minutes) * 90 : 0.0;
        const xA90 = minutes > 0 ? (xA / minutes) * 90 : 0.0;

        let appearances = starts;
        if (minutes > starts * 90) {
            appearances = starts + Math.round((minutes - starts * 90) / 20);
        }
        if (minutes > 0 && appearances === 0) appearances = 1;
        const mppg = appearances > 0 ? minutes / appearances : 0.0;

        // Calculate a realistic points-per-game baseline
        let basePPG = 0.5;
        const totalPoints = el.total_points || 0;
        if (minutes > 500 && appearances > 0) {
            basePPG = totalPoints / appearances;
        } else if (minutes > 0 && appearances > 0) {
            // Scale the default baseline by how much they actually play
            const playingRatio = Math.min(1.0, minutes / 500);
            const defaultPPG = (position === 'GKP' ? 3.0 : (position === 'DEF' ? 2.8 : (position === 'MID' ? 3.2 : 3.5)));
            basePPG = 0.5 + (defaultPPG - 0.5) * playingRatio;
        } else {
            // They have played 0 minutes (e.g. youth players, bench warmers, or new transfers)
            // If they are expensive, they are likely high-profile transfers, so give them a decent default.
            // If they are cheap (<= 6.0m), they are likely cheap bench enablers, so give them a low score.
            basePPG = (price > 6.0) ? 2.0 : 0.5;
        }

        if (position === 'GKP') basePPG = Math.max(1.8, Math.min(4.8, basePPG));
        else if (position === 'DEF') basePPG = Math.max(1.5, Math.min(5.5, basePPG));
        else if (position === 'MID') basePPG = Math.max(1.8, Math.min(8.5, basePPG));
        else if (position === 'FWD') basePPG = Math.max(2.0, Math.min(8.5, basePPG));

        const predictions = [];
        const fixtures = fixturesSchedule[teamShort] || [];
        
        for (let gw = 1; gw <= 10; gw++) {
            const fixture = fixtures.find(f => f.gw === gw) || { opp: 'BYE', loc: 'H', diff: 3 };
            let pts = basePPG;
            
            if (fixture.opp !== 'BYE') {
                if (fixture.diff === 2) pts *= 1.25;
                else if (fixture.diff === 4) pts *= 0.85;
                else if (fixture.diff === 5) pts *= 0.65;
                
                if (fixture.loc === 'H') pts += 0.35;
                else pts -= 0.35;
                
                if (position === 'GKP' || position === 'DEF') {
                    if (fixture.diff === 2) pts += 0.8;
                    if (fixture.diff === 5) pts -= 0.6;
                } else {
                    const xGI90 = xG90 + xA90;
                    if (xGI90 > 0.1) {
                        if (fixture.diff === 2) pts += xGI90 * 1.5;
                        if (fixture.diff === 5) pts -= xGI90 * 0.8;
                    }
                }
            } else {
                pts = 0.0;
            }
            
            const chance = el.chance_of_playing_next_round !== null ? el.chance_of_playing_next_round / 100 : 1.0;
            pts *= chance;
            pts = Math.max(0, Math.round(pts * 10) / 10);
            
            predictions.push({
                gw: gw,
                pts: pts,
                opp: fixture.opp,
                loc: fixture.loc,
                diff: fixture.diff
            });
        }

        const totalXp10 = predictions.reduce((sum, pr) => sum + pr.pts, 0);
 
        return {
            id: el.id,
            name: `${el.first_name} ${el.second_name}`,
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
            transferredThisSeason: transferredThisSeason,
            oldTeam: oldTeam,
            news: el.news || "",
            status: el.status || "a",
            chanceOfPlaying: el.chance_of_playing_next_round !== null ? el.chance_of_playing_next_round : 100,
            xp10: parseFloat(totalXp10.toFixed(1))
        };
    });

    // 4. Generate a valid DEFAULT_SQUAD of 15 players
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

    // Write file content
    const fileContent = `// FPL Hub Synced Live Database
// Automatically synced with official Fantasy Premier League API

export const TEAMS = ${JSON.stringify(teamsList, null, 4)};

export const PLAYERS = ${JSON.stringify(playersList, null, 4)};

export const DEFAULT_SQUAD = ${JSON.stringify(defaultSquad, null, 4)};

export const EXPERT_REVEALS = ${JSON.stringify(expertReveals, null, 4)};

export const TICKER_DATA = ${JSON.stringify(fixturesSchedule, null, 4)};

export function getPlayerRatings(player, currentGw = 1) {
    // 1. Expected Minutes (based on MPPG - Avg Minutes/Game)
    // A: >= 80, B: >= 60, C: >= 45, D: >= 20, E: < 20
    const mppg = player.MPPG || 0;
    let expectedMinutes = 'E';
    if (mppg >= 80) expectedMinutes = 'A';
    else if (mppg >= 60) expectedMinutes = 'B';
    else if (mppg >= 45) expectedMinutes = 'C';
    else if (mppg >= 20) expectedMinutes = 'D';

    // 2. Next 10 Fixtures (based on average FDR of next 10 predictions starting from currentGw)
    let avgFdr = 3.0;
    if (player.predictions && player.predictions.length > 0) {
        let fdrSum = 0;
        let count = 0;
        for (let gw = currentGw; gw < currentGw + 10; gw++) {
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
            for (let gw = currentGw; gw < currentGw + 10; gw++) {
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
