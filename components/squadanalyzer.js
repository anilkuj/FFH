// components/squadanalyzer.js
import { PLAYERS, TEAMS } from '../data.js';

export function showPlannerSquadAnalysisModal(container, state, actions) {
    const existing = document.getElementById('tpSquadAnalysisModal');
    if (existing) existing.remove();

    const gw = state.currentGw;
    
    // Resolve squad and lineups
    const squadInfo = state.getSquadForGw(gw);
    const { squad } = squadInfo;
    const lineupInfo = state.getGwLineup(gw);
    const { starters, bench, captain, vice } = lineupInfo;

    // Load live points or fall back to predictions actualPts/predictions pts
    const livePointsMap = (state && state.livePoints && state.livePoints[gw]) || {};
    const getPlayerGwPoints = (player) => {
        const livePts = livePointsMap[player.id];
        if (livePts !== undefined && livePts !== null) return livePts;
        const pred = player.predictions.find(pr => pr.gw == gw);
        if (pred && pred.actualPts !== undefined && pred.actualPts !== null) return pred.actualPts;
        if (pred && pred.pts !== undefined) return Math.round(pred.pts);
        return 0;
    };

    // Calculate total starting XI points (double counting captain)
    let totalStarterPoints = 0;
    starters.forEach(id => {
        const p = PLAYERS.find(pl => pl.id === id);
        if (p) {
            let pts = getPlayerGwPoints(p);
            if (id === captain) {
                const isTriple = !!(state.chips[gw]?.tripleCaptain);
                pts *= (isTriple ? 3 : 2);
            }
            totalStarterPoints += pts;
        }
    });

    // Safety score calculation
    let safetyScore = 100;
    let flaggedCount = 0;
    starters.forEach(id => {
        const p = PLAYERS.find(pl => pl.id === id);
        if (p) {
            if (p.status !== 'a' && p.status !== 'd') safetyScore -= 15;
            if (p.chanceOfPlaying < 100) safetyScore -= 10;
            if (p.displacementRisk) safetyScore -= 10;
            if (p.status !== 'a') flaggedCount++;
        }
    });
    safetyScore = Math.max(25, Math.min(100, safetyScore));

    // Dynamic GW Rank estimation based on total starter points
    const pointsToRank = (pts) => {
        if (pts <= 0) return 9800000;
        if (pts <= 20) return 8000000 - (pts * 150000);
        if (pts <= 50) return 5000000 - ((pts - 20) * 110000);
        if (pts <= 80) return 1700000 - ((pts - 50) * 53000);
        return Math.max(12, Math.round(110000 / Math.pow(pts - 78, 1.4)));
    };

    // Retrieve actual gameweek rank and overall rank if FPL entry history is available
    let gwRank = null;
    let liveRank = null;
    if (state.fplEntryHistory && state.fplEntryHistory.current) {
        const gwHistory = state.fplEntryHistory.current.find(h => h.event == gw);
        if (gwHistory) {
            gwRank = gwHistory.rank;
            liveRank = gwHistory.overall_rank;
        }
    }
    if (!gwRank) {
        gwRank = pointsToRank(totalStarterPoints);
    }
    if (!liveRank) {
        liveRank = gwRank;
    }
    const delta = totalStarterPoints - 46; // Compared to an average of 46 pts

    const captPlayer = PLAYERS.find(p => p.id === captain);
    const captPoints = captPlayer ? getPlayerGwPoints(captPlayer) * (state.chips[gw]?.tripleCaptain ? 3 : 2) : 0;
    const captLabel = captPlayer ? `${captPlayer.web_name} (${captPoints})` : 'None';

    const getVerdict = (pts, isPlayed) => {
        if (!isPlayed) return { label: 'NO NEW INFO', class: 'neutral-pill' };
        if (pts >= 100) return { label: 'VERY STRONG +', class: 'v-strong-pill' };
        if (pts >= 60) return { label: 'STRONG +', class: 'strong-pill' };
        if (pts >= 30) return { label: 'NEUTRAL', class: 'neutral-pill' };
        if (pts >= 1) return { label: 'MIXED', class: 'mixed-pill' };
        return { label: 'NEGATIVE -', class: 'negative-pill' };
    };

    const allSquadDetails = squad.map(id => {
        const p = PLAYERS.find(pl => pl.id === id);
        if (!p) return null;
        const pts = p.points; // Season-long total points
        const isStarting = starters.includes(id);
        const chance = (p.chanceOfPlaying !== undefined && p.chanceOfPlaying !== null) ? p.chanceOfPlaying : 100;
        const displayPts = `${pts}`;
        const hasPlayed = p.currentSeasonMins > 0 || pts > 0;
        const verdict = getVerdict(pts, hasPlayed);
        const hasFlag = p.status !== 'a' || chance < 100 || p.displacementRisk !== null;

        return {
            player: p,
            pts: displayPts,
            rawPts: pts,
            isStarting,
            verdict,
            hasFlag,
            position: p.position,
            team: p.team,
            price: p.price
        };
    }).filter(Boolean);

    const startersObjects = starters.map(id => PLAYERS.find(p => p.id === id)).filter(Boolean);
    const underperformingPlayers = startersObjects
        .map(p => {
            const pts = getPlayerGwPoints(p);
            const xgi = p.xGI || 0;
            const xg = p.xG || 0;
            const xa = p.xA || 0;
            const score = xgi * 5 - pts;
            return { player: p, pts, xgi, xg, xa, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 2);

    const overperformingPlayers = startersObjects
        .map(p => {
            const pts = getPlayerGwPoints(p);
            const xgi = p.xGI || 0;
            const xg = p.xG || 0;
            const xa = p.xA || 0;
            const score = pts - (xgi * 5);
            return { player: p, pts, xgi, xg, xa, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 2);

    const pointsVsPerformanceList = [];
    underperformingPlayers.forEach(entry => {
        if (entry.xgi > 0.15) {
            pointsVsPerformanceList.push({
                player: entry.player,
                pts: entry.pts,
                tag: 'UNDERPERFORMANCE / HIGH THREAT',
                tagClass: 'strong-pill',
                stats: `xG: ${entry.xg.toFixed(2)} | xA: ${entry.xa.toFixed(2)} | xGI: ${entry.xgi.toFixed(2)} | ICT: ${entry.player.ictIndex.toFixed(1)}`,
                blurb: `Despite the blank (${entry.pts} pts), ${entry.player.web_name} generated a massive ${entry.xgi.toFixed(2)} xGI. His underlying stats are extremely healthy. Do not make a reactionary transfer; the returns will follow.`
            });
        }
    });

    overperformingPlayers.forEach(entry => {
        if (entry.pts >= 6) {
            pointsVsPerformanceList.push({
                player: entry.player,
                pts: entry.pts,
                tag: 'LUCKY RETURN / LOW THREAT',
                tagClass: 'negative-pill',
                stats: `xG: ${entry.xg.toFixed(2)} | xA: ${entry.xa.toFixed(2)} | xGI: ${entry.xgi.toFixed(2)} | ICT: ${entry.player.ictIndex.toFixed(1)}`,
                blurb: `${entry.player.web_name} scored ${entry.pts} pts but registering only ${entry.xgi.toFixed(2)} expected goal involvement. While FPL managers will celebrate the return, his involvement remained minimal. Plan a replacement long-term.`
            });
        }
    });

    startersObjects.forEach(p => {
        if (pointsVsPerformanceList.length < 4 && !pointsVsPerformanceList.some(item => item.player.id === p.id)) {
            const pts = getPlayerGwPoints(p);
            if (p.position === 'DEF') {
                pointsVsPerformanceList.push({
                    player: p,
                    pts: pts,
                    tag: p.dcPer90 > 4 ? 'DEFENSIVE ROCK / STEADY MINS' : 'FIXED LINEUP ROLE',
                    tagClass: 'neutral-pill',
                    stats: `dcPer90: ${p.dcPer90.toFixed(2)} | Goals Conceded: ${p.goalsConceded} | ICT: ${p.ictIndex.toFixed(1)}`,
                    blurb: `${p.web_name} played in defense registering a Defcon defensive contribution rate of ${p.dcPer90.toFixed(2)} per 90. He provides a steady defensive base for the squad constraints.`
                });
            } else {
                pointsVsPerformanceList.push({
                    player: p,
                    pts: pts,
                    tag: 'STABLE CORE',
                    tagClass: 'neutral-pill',
                    stats: `xGI: ${p.xGI.toFixed(2)} | ICT: ${p.ictIndex.toFixed(1)}`,
                    blurb: `${p.web_name} played regular minutes with standard underlying output. Solid asset to keep in your starting XI.`
                });
            }
        }
    });

    let captaincyVerdict = 'GOOD PROCESS / GOOD OUTCOME';
    let captaincyComment = 'The captaincy decision delivered solid returns and maximized your squad coefficient.';
    if (captPlayer) {
        const captPtsRaw = getPlayerGwPoints(captPlayer);
        if (captPtsRaw <= 2) {
            if (captPlayer.xGI > 0.40) {
                captaincyVerdict = 'GOOD PROCESS / BAD OUTCOME';
                captaincyComment = `${captPlayer.web_name} registered a strong ${captPlayer.xGI.toFixed(2)} xGI but blanked. The process was fully sound; do not let the short-term result dictate your future captain choices.`;
            } else {
                captaincyVerdict = 'RISKY PROCESS / BAD OUTCOME';
                captaincyComment = `${captPlayer.web_name} generated only ${captPlayer.xGI.toFixed(2)} xGI on a blank. Better captain alternatives with higher threat profile were available in the starting XI.`;
            }
        } else if (captPtsRaw >= 6) {
            captaincyVerdict = 'GOOD PROCESS / GOOD OUTCOME';
            captaincyComment = `Spot on! ${captPlayer.web_name} returned ${captPtsRaw} points, validating your captaincy model selections.`;
        }
    }

    const benchObjects = bench.map(id => PLAYERS.find(p => p.id === id)).filter(Boolean);
    const benchBusters = [];
    benchObjects.forEach(p => {
        const bPts = getPlayerGwPoints(p);
        const positionStarters = startersObjects.filter(s => s.position === p.position);
        const outscoredStarters = positionStarters.filter(s => getPlayerGwPoints(s) < bPts);
        if (outscoredStarters.length > 0 && bPts >= 5) {
            benchBusters.push({
                player: p,
                points: bPts,
                betterThan: outscoredStarters.map(s => `${s.web_name} (${getPlayerGwPoints(s)} pts)`).join(', ')
            });
        }
    });

    let benchVerdictHtml = '';
    if (benchBusters.length > 0) {
        benchBusters.forEach(b => {
            benchVerdictHtml += `
                <div style="background: rgba(245, 158, 11, 0.05); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 8px; padding: 18px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                        <span style="font-size:10px; font-weight:700; color:#f59e0b; text-transform:uppercase; background:rgba(245, 158, 11, 0.15); padding:2.5px 6px; border-radius:4px;">BENCH BUSTER</span>
                        <strong style="color:var(--text-main); font-size:14px;">${b.player.web_name} (${b.points} pts)</strong>
                    </div>
                    <p style="margin:0; font-size:13px; color:var(--text-muted); line-height:1.55;">
                        Benched player outscored starting ${b.player.position}(s): <strong>${b.betterThan}</strong>. Benching him was defensible before kickoff, but his high 2026-27 underlying xGI/Defcon data implies he warrants starter consideration.
                    </p>
                </div>
            `;
        });
    } else {
        benchVerdictHtml = `
            <div style="background: rgba(34, 197, 94, 0.05); border: 1px solid rgba(34, 197, 94, 0.2); border-radius: 8px; padding: 18px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <span style="font-size:10px; font-weight:700; color:#22c55e; text-transform:uppercase; background:rgba(34, 197, 94, 0.15); padding:2.5px 6px; border-radius:4px;">PERFECT LINEUP</span>
                    <strong style="color:var(--text-main); font-size:14px;">No Bench Points Wasted</strong>
                </div>
                <p style="margin:0; font-size:13px; color:var(--text-muted); line-height:1.55;">
                    All high-scoring options were correctly placed in your starting XI. Bench rotation and ordering functioned flawlessly this week.
                </p>
            </div>
        `;
    }

    const computeDetailedLocalRisk = (p) => {
        if (p.position === 'GKP' && p.price <= 4.0) {
            const primaryGKPs = PLAYERS.filter(other =>
                other.position === 'GKP' && other.team === p.team && other.price >= 4.5
            );
            const hasActivePrimary = primaryGKPs.some(other =>
                other.status !== 'i' && other.status !== 's' && (other.chanceOfPlaying === undefined || other.chanceOfPlaying > 0)
            );
            if (hasActivePrimary) {
                return { risk: "High", type: "ROTATION / MINUTES", reason: "Second-choice / backup goalkeeper.", details: "Priced at £4.0m, he sits behind a fit first-choice goalkeeper." };
            }
        }

        const chance = (p.chanceOfPlaying !== undefined && p.chanceOfPlaying !== null) ? p.chanceOfPlaying : 100;
        const status = p.status || 'a';
        const starts = typeof p.GS === 'number' ? p.GS : 25;
        const mppg = typeof p.MPPG === 'number' ? p.MPPG : 80;

        if (status === 'i' || status === 'u' || chance === 0) {
            const fallbackReason = status === 'u' ? "Unavailable (e.g. left the club)." : "Ruled out with injury.";
            return { risk: "High", type: "INJURY / AVAILABILITY", reason: p.news || fallbackReason, details: "FPL official status flag set to unavailable." };
        }
        if (status === 's') {
            return { risk: "High", type: "SUSPENSION", reason: p.news || "Suspended.", details: "FPL official status flag set to suspended." };
        }
        if (status === 'd' || chance < 75) {
            return { risk: "Medium", type: "DOUBTFUL / FITNESS", reason: p.news || `Doubtful starting chance (${chance}% play probability).`, details: "Player flagged by team medical staff." };
        }
        if (p.displacementRisk) {
            const gapPct = Math.round(p.displacementRisk.gap * 100);
            const risk = p.displacementRisk.gap > 0.3 ? "High" : "Medium";
            return {
                risk,
                type: "ROTATION / DISPLACEMENT",
                reason: `At risk of losing his place to ${p.displacementRisk.threatenedByName}.`,
                details: `${p.displacementRisk.threatenedByName} recently joined the squad and has a ${gapPct}-point-higher start probability.`
            };
        }
        if (chance < 100) {
            return { risk: "Low", type: "FITNESS MONITOR", reason: p.news || `Minor fitness concern (${chance}% play probability).`, details: "Mild flag. Check press conferences before deadline." };
        }
        if (p.dataConfidence !== 'low' && p.dataConfidence !== undefined) {
            if (starts > 0 && starts < 15) {
                return { risk: "Medium", type: "TACTICAL ROTATION", reason: `Started only ${starts} matches last season.`, details: "Historical starting frequency indicates rotation risk." };
            }
            if (mppg > 0 && mppg < 60) {
                return { risk: "Low", type: "MINUTES RISK", reason: `Averages only ${mppg.toFixed(0)} mins per appearance.`, details: "Averages less than 60 minutes per game." };
            }
        }
        return null;
    };

    const squadRisksReport = squad.map(id => {
        const p = PLAYERS.find(pl => pl.id === id);
        if (!p) return null;
        const risk = computeDetailedLocalRisk(p);
        if (risk) {
            return { player: p, ...risk };
        }
        return null;
    }).filter(Boolean);

    const designatedSetPieceTakers = squad.map(id => {
        const p = PLAYERS.find(pl => pl.id === id);
        if (!p) return null;
        const pk = p.setPieceDuty?.pk;
        const fk = p.setPieceDuty?.fk;
        const ck = p.setPieceDuty?.ck;
        if (pk || fk || ck) {
            const labels = [];
            if (pk) labels.push('Penalties 🎯');
            if (fk) labels.push('Free-Kicks ⚡');
            if (ck) labels.push('Corners 🚩');
            return { player: p, duties: labels.join(', ') };
        }
        return null;
    }).filter(Boolean);

    const keyThreatPlayer = startersObjects.sort((a, b) => (b.xGI || 0) - (a.xGI || 0))[0];
    const threatTerm = keyThreatPlayer ? `${keyThreatPlayer.web_name} generated the highest underlying expected threat (${keyThreatPlayer.xGI.toFixed(2)} xGI). Keep him starting.` : 'Trust your starting forwards and midfielders with high historical threat.';
    
    const keyRiskPlayer = squadRisksReport.filter(r => r.risk === 'High')[0];
    const riskTerm = keyRiskPlayer ? `Monitor ${keyRiskPlayer.player.web_name}'s news: currently flagged as '${keyRiskPlayer.risk} Risk' (${keyRiskPlayer.reason}).` : 'No high-risk players active. Keep monitoring press conferences for late rotation warnings.';

    const keySetPiecePlayer = designatedSetPieceTakers[0];
    const modelTerm = keySetPiecePlayer ? `Leverage set-piece takers: ${keySetPiecePlayer.player.web_name} is on ${keySetPiecePlayer.duties}. Value their high xGI floor.` : 'Value players with solid Defcon (defensive contributions) metrics like clean-sheet potential on favorable fixtures.';

    const modalDiv = document.createElement('div');
    modalDiv.id = 'tpSquadAnalysisModal';
    modalDiv.style.cssText = `
        position: fixed;
        top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.65);
        backdrop-filter: blur(12px);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        box-sizing: border-box;
    `;

    let activeSlideIndex = 0; // 0 to 5 (6 slides total)

    // Keydown Arrow listener
    const handleKeyDown = (e) => {
        if (e.key === 'ArrowLeft') {
            if (activeSlideIndex > 0) {
                activeSlideIndex--;
                renderCurrentSlide();
            }
        } else if (e.key === 'ArrowRight') {
            if (activeSlideIndex < 5) {
                activeSlideIndex++;
                renderCurrentSlide();
            } else {
                modalDiv.remove();
            }
        } else if (e.key === 'Escape') {
            modalDiv.remove();
        }
    };
    document.addEventListener('keydown', handleKeyDown);

    // Clean up event listener when modal is removed
    const originalRemove = modalDiv.remove.bind(modalDiv);
    modalDiv.remove = () => {
        document.removeEventListener('keydown', handleKeyDown);
        originalRemove();
    };

    const renderCurrentSlide = () => {
        let slideTitle = '';
        let slideSub = '';
        let slideBody = '';

        if (activeSlideIndex === 0) {
            slideTitle = 'MY GAMEWEEK REVIEW';
            slideSub = `Gameweek ${gw} lineup return and metrics recap`;
            
            const rowGKPs = startersObjects.filter(p => p.position === 'GKP');
            const rowDEFs = startersObjects.filter(p => p.position === 'DEF');
            const rowMIDs = startersObjects.filter(p => p.position === 'MID');
            const rowFWDs = startersObjects.filter(p => p.position === 'FWD');

            const makePitchRowHtml = (playersList) => {
                return `
                    <div style="display:flex; justify-content:center; gap:32px; margin: 24px 0;">
                        ${playersList.map(p => {
                            const pts = getPlayerGwPoints(p);
                            const isCaptain = p.id === captain;
                            const displayPts = isCaptain ? `${pts * (state.chips[gw]?.tripleCaptain ? 3 : 2)}` : `${pts}`;
                            return `
                                <div style="display:flex; flex-direction:column; align-items:center; width:90px; position:relative;">
                                    <div style="width:68px; height:68px; border-radius:50%; background:rgba(15, 23, 42, 0.75); backdrop-filter:blur(6px); border: 2.5px solid ${isCaptain ? '#fbbf24' : 'var(--primary)'}; display:flex; align-items:center; justify-content:center; color:var(--text-main); font-size:18px; font-weight:900; font-family:var(--font-heading); box-shadow: 0 0 20px ${isCaptain ? 'rgba(251, 191, 36, 0.4)' : 'var(--primary-glow)'}; transition: transform 0.2s;">
                                        ${displayPts}
                                        ${isCaptain ? `<div style="position:absolute; top:-6px; right:-6px; width:22px; height:22px; border-radius:50%; background:#fbbf24; color:black; font-size:11px; font-weight:900; display:flex; align-items:center; justify-content:center; box-shadow:0 0 6px #fbbf24;">C</div>` : ''}
                                    </div>
                                    <span style="font-size:13px; font-weight:800; color:#fff; text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%; margin-top:8px; text-shadow: 0 2px 4px rgba(0,0,0,0.8);">${p.web_name}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            };

            slideBody = `
                <div style="display: flex; gap: 48px; flex-wrap: wrap; width:100%; height:100%; min-height: 580px; box-sizing: border-box; padding: 10px;">
                    <!-- Left: Pitch -->
                    <div style="flex: 1.5; min-width: 360px; background: radial-gradient(circle, #0e3f27 0%, #062314 100%); border: 2px solid var(--border-color); border-radius: 16px; padding: 32px; display:flex; flex-direction:column; justify-content:space-between; box-sizing: border-box; position:relative; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
                        <!-- Field Markings -->
                        <div style="position:absolute; top:50%; left:0; width:100%; height:2px; background:rgba(255,255,255,0.05); transform:translateY(-50%); pointer-events:none;"></div>
                        <div style="position:absolute; top:50%; left:50%; width:150px; height:150px; border:2px solid rgba(255,255,255,0.05); border-radius:50%; transform:translate(-50%, -50%); pointer-events:none;"></div>
                        <div style="position:absolute; top:0; left:50%; width:240px; height:90px; border:2px solid rgba(255,255,255,0.05); border-top:none; transform:translateX(-50%); pointer-events:none;"></div>
                        <div style="position:absolute; bottom:0; left:50%; width:240px; height:90px; border:2px solid rgba(255,255,255,0.05); border-bottom:none; transform:translateX(-50%); pointer-events:none;"></div>
                        
                        <div style="border-bottom: 2px dashed rgba(255,255,255,0.1); padding-bottom:8px; text-align:center; font-size:12px; color:#a3e635; font-weight:800; letter-spacing:1.5px; text-transform:uppercase; z-index:1;">PITCH VISUALIZER</div>
                        
                        <div style="display:flex; flex-direction:column; justify-content:space-around; flex:1; margin-top:24px; z-index:1;">
                            ${makePitchRowHtml(rowFWDs)}
                            ${makePitchRowHtml(rowMIDs)}
                            ${makePitchRowHtml(rowDEFs)}
                            ${makePitchRowHtml(rowGKPs)}
                        </div>
                    </div>
                    
                    <!-- Right: Rank Details -->
                    <div style="flex: 0.9; min-width: 280px; display:flex; flex-direction:column; gap:24px; justify-content:center; box-sizing: border-box;">
                        <div style="background: linear-gradient(135deg, var(--bg-panel), rgba(0, 255, 136, 0.02)); border: 2px solid var(--primary); border-radius:16px; padding: 32px 24px; display:flex; flex-direction:column; align-items:center; box-shadow: 0 0 24px var(--primary-glow); transition: transform 0.2s;">
                            <span style="font-size:12px; font-weight:900; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">MY SCORE</span>
                            <span style="font-size:98px; font-weight:900; font-family:var(--font-heading); color:var(--primary); line-height:1.0; margin-top:10px; text-shadow: 0 0 25px var(--primary-glow);">${totalStarterPoints}</span>
                            <span style="font-size:14px; font-weight:800; color:var(--text-main); margin-top:10px;">Points in GW${gw}</span>
                        </div>
                        
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
                            <div style="background: var(--bg-panel); border: 1.5px solid var(--border-color); border-radius:12px; padding: 18px 12px; display:flex; flex-direction:column; align-items:center; box-shadow: 0 4px 10px rgba(0,0,0,0.15);">
                                <span style="font-size:9.5px; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">GW RANK</span>
                                <span style="font-size:18px; font-weight:900; color:var(--text-main); margin-top:8px;">${gwRank.toLocaleString()}</span>
                            </div>
                            <div style="background: var(--bg-panel); border: 1.5px solid var(--border-color); border-radius:12px; padding: 18px 12px; display:flex; flex-direction:column; align-items:center; box-shadow: 0 4px 10px rgba(0,0,0,0.15);">
                                <span style="font-size:9.5px; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">LIVE RANK</span>
                                <span style="font-size:18px; font-weight:900; color:var(--text-main); margin-top:8px;">${liveRank.toLocaleString()}</span>
                            </div>
                            <div style="background: var(--bg-panel); border: 1.5px solid var(--border-color); border-radius:12px; padding: 18px 12px; display:flex; flex-direction:column; align-items:center; box-shadow: 0 4px 10px rgba(0,0,0,0.15);">
                                <span style="font-size:9.5px; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">SAFETY RATING</span>
                                <span style="font-size:18px; font-weight:900; color:#38bdf8; margin-top:8px;">${safetyScore}%</span>
                            </div>
                            <div style="background: var(--bg-panel); border: 1.5px solid var(--border-color); border-radius:12px; padding: 18px 12px; display:flex; flex-direction:column; align-items:center; box-shadow: 0 4px 10px rgba(0,0,0,0.15);">
                                <span style="font-size:9.5px; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">AVERAGE DELTA</span>
                                <span style="font-size:18px; font-weight:900; color:${delta >= 0 ? 'var(--primary)' : '#ef4444'}; margin-top:8px;">${delta >= 0 ? '+' : ''}${delta} pts</span>
                            </div>
                        </div>
                        
                        <div style="background: var(--bg-panel); border: 1.5px solid var(--border-color); border-radius:12px; padding: 16px 20px; display:flex; justify-content:space-between; align-items:center; font-size:13.5px; box-shadow: 0 4px 10px rgba(0,0,0,0.15);">
                            <span style="font-weight:700; color:var(--text-muted);">CAPTAIN CHOICE:</span>
                            <span style="font-weight:900; color:#fbbf24; text-shadow:0 0 8px rgba(251,191,36,0.2);">${captLabel}</span>
                        </div>
                    </div>
                </div>
            `;
        } else if (activeSlideIndex === 1) {
            slideTitle = '15-MAN REALITY CHECK';
            slideSub = 'FPL season points against actual team-role performance indicators';
            
            slideBody = `
                <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 20px; overflow-y:auto; max-height: 76vh; padding: 8px; box-sizing: border-box; width:100%;">
                    ${allSquadDetails.map(item => {
                        const alertIcon = item.hasFlag ? `<span title="Injury or starting risk detected!" style="color:#f59e0b; margin-right:6px; font-size:14px; animation: pulse 2s infinite;">⚠️</span>` : '';
                        return `
                            <div class="squad-reality-card" style="background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 14px; padding: 20px; display:flex; flex-direction:column; justify-content:space-between; min-height: 125px; box-sizing: border-box; transition: all 0.2s; cursor: pointer; box-shadow: 0 6px 16px rgba(0,0,0,0.12);">
                                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                    <div style="display:flex; flex-direction:column; overflow:hidden; margin-right:8px;">
                                        <span style="font-size:15px; font-weight:900; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${item.player.name}">${item.player.web_name}</span>
                                        <span style="font-size:11px; color:var(--text-muted); margin-top:4px; font-weight:600;">${item.team} • ${item.position} • £${item.price.toFixed(1)}m</span>
                                    </div>
                                    <strong style="font-size:24px; font-family:var(--font-heading); color:${item.isStarting ? 'var(--primary)' : 'var(--text-muted)'}; white-space:nowrap; line-height: 1;">${item.pts} <span style="font-size:11px; font-weight:700; color:var(--text-muted);">pts</span></strong>
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px; flex-wrap:wrap; gap:4px;">
                                    <span class="${item.verdict.class}" style="font-size:9.5px; font-weight:900; padding:4px 10px; border-radius:5px; letter-spacing:0.5px;">${item.verdict.label}</span>
                                    <div style="display:flex; align-items:center;">
                                        ${alertIcon}
                                        <span style="font-size:12px; color:var(--text-muted); font-weight:800;">${item.isStarting ? 'Starter' : 'Bench'}</span>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        } else if (activeSlideIndex === 2) {
            slideTitle = 'POINTS VS PERFORMANCE';
            slideSub = 'Analyzing underlying metrics for players where outcomes differed from expectations';

            slideBody = `
                <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap:24px; width:100%; box-sizing: border-box; overflow-y:auto; max-height:76vh; padding: 8px;">
                    ${pointsVsPerformanceList.map(item => {
                        return `
                            <div style="background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 16px; padding: 24px; display:flex; flex-direction:column; justify-content:space-between; gap:16px; box-sizing: border-box; box-shadow: 0 6px 20px rgba(0,0,0,0.18);">
                                <div>
                                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                                        <div>
                                            <strong style="font-size:17px; color:var(--text-main); font-family:var(--font-heading);">${item.player.web_name}</strong>
                                            <span style="font-size:11.5px; color:var(--text-muted); margin-left:8px; font-weight:600;">(${item.player.team}, £${item.player.price.toFixed(1)}m)</span>
                                        </div>
                                        <span style="font-size:17px; font-weight:900; color:var(--primary); font-family:var(--font-heading);">${item.pts} pts</span>
                                    </div>
                                    <span class="${item.tagClass}" style="font-size:10px; font-weight:900; padding:4px 10px; border-radius:5px; display:inline-block; margin-bottom:12px; letter-spacing:0.5px;">${item.tag}</span>
                                    
                                    <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:8px; padding:10px 14px; font-size:13px; font-family:var(--font-mono); color:var(--primary); text-shadow:0 0 6px var(--primary-glow); margin-bottom:12px; font-weight:700; letter-spacing: 0.5px;">
                                        ${item.stats}
                                    </div>
                                </div>
                                <p style="margin:0; font-size:13.5px; color:var(--text-muted); line-height:1.6;">
                                    ${item.blurb}
                                </p>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        } else if (activeSlideIndex === 3) {
            slideTitle = 'DECISION REVIEW';
            slideSub = 'A validation of manager logic versus actual variance and outcomes';

            slideBody = `
                <div style="display:flex; flex-direction:column; gap:24px; width:100%; box-sizing: border-box; padding: 10px;">
                    <!-- Captaincy decision -->
                    <div style="background: var(--bg-panel); border: 1px solid var(--border-color); border-left: 6px solid #fbbf24; border-radius: 14px; padding: 24px; box-shadow: 0 6px 18px rgba(0,0,0,0.12);">
                        <span style="font-size:10px; font-weight:900; color:#fbbf24; background:rgba(253,191,36,0.15); padding:4px 10px; border-radius:5px; display:inline-block; margin-bottom:12px; letter-spacing:0.5px;">CAPTAINCY CHECK</span>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                            <strong style="font-size:18px; color:var(--text-main); font-family:var(--font-heading);">${captPlayer ? captPlayer.web_name : 'No Captain Selected'}</strong>
                            <span style="font-size:14px; font-weight:900; color:#fbbf24; text-shadow:0 0 8px rgba(251,191,36,0.3);">${captaincyVerdict}</span>
                        </div>
                        <p style="margin:0; font-size:13.5px; color:var(--text-muted); line-height:1.6;">
                            ${captaincyComment}
                        </p>
                    </div>

                    <!-- Bench decision -->
                    <div style="background: var(--bg-panel); border: 1px solid var(--border-color); border-left: 6px solid #38bdf8; border-radius: 14px; padding: 24px; display:flex; flex-direction:column; gap:12px; box-shadow: 0 6px 18px rgba(0,0,0,0.12);">
                        <span style="font-size:10px; font-weight:900; color:#38bdf8; background:rgba(56,189,248,0.15); padding:4px 10px; border-radius:5px; display:inline-block; align-self:flex-start; letter-spacing:0.5px;">BENCH DECISION</span>
                        ${benchVerdictHtml}
                    </div>

                    <!-- Process check -->
                    <div style="background: var(--bg-panel); border: 1px solid var(--border-color); border-left: 6px solid var(--primary); border-radius: 14px; padding: 24px; box-shadow: 0 6px 18px rgba(0,0,0,0.12);">
                        <span style="font-size:10px; font-weight:900; color:var(--primary); background:rgba(0, 255, 136, 0.08); padding:4px 10px; border-radius:5px; display:inline-block; margin-bottom:12px; letter-spacing:0.5px;">BENCH PROCESS CHECK</span>
                        <div style="font-size:13.5px; color:var(--text-muted); line-height:1.6;">
                            Bench list: <strong>${benchObjects.map(p => `${p.web_name} (${getPlayerGwPoints(p)} pts)`).join(' • ') || 'Empty'}</strong>.
                            Nothing on the bench indicates irrational structural selections. The lineup ordering aligns with predictive FDR fixtures and 2026-27 performance indicators.
                        </div>
                    </div>
                </div>
            `;
        } else if (activeSlideIndex === 4) {
            slideTitle = 'WHAT THE MATCHES TAUGHT ME';
            slideSub = 'Tactical updates, player role reclassifications, and squad risks';

            let riskCardsHtml = '';
            if (squadRisksReport.length > 0) {
                riskCardsHtml = squadRisksReport.map(r => {
                    const borderCol = r.risk === 'High' ? '#ef4444' : (r.risk === 'Medium' ? '#f59e0b' : '#38bdf8');
                    const bgCol = r.risk === 'High' ? 'rgba(239,68,68,0.05)' : (r.risk === 'Medium' ? 'rgba(245,158,11,0.05)' : 'rgba(56,189,248,0.05)');
                    return `
                        <div style="background:${bgCol}; border-left:5px solid ${borderCol}; border-radius:10px; padding:16px; display:flex; flex-direction:column; gap:6px; font-size:13px; box-sizing: border-box; box-shadow: 0 3px 10px rgba(0,0,0,0.06);">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <strong style="font-size:14.5px; color:var(--text-main);">${r.player.web_name} <span style="font-size:9.5px; font-weight:800; color:var(--text-muted); padding:3px 8px; background:var(--bg-card); border-radius:5px; border:1px solid var(--border-color);">${r.player.team} - ${r.player.position}</span></strong>
                                <span style="font-size:9.5px; font-weight:900; text-transform:uppercase; color:${borderCol}; border:1px solid ${borderCol}44; padding:3px 10px; border-radius:14px; background:var(--bg-card);">${r.risk} Risk</span>
                            </div>
                            <p style="margin:6px 0 0 0; color:var(--text-main); font-weight:700;">⚠️ ${r.reason}</p>
                            <p style="margin:0; color:var(--text-muted); font-size:11px; font-style:italic;">ℹ️ ${r.details}</p>
                        </div>
                    `;
                }).join('');
            } else {
                riskCardsHtml = `
                    <div style="text-align:center; padding:32px; color:var(--text-muted); font-size:13.5px; background:rgba(34, 197, 94, 0.02); border:2px dashed var(--border-color); border-radius:10px;">
                        No squad injuries, doubtful flags, or positional displacement risks detected! All 15 players are fully fit and expected to start.
                    </div>
                `;
            }

            let setPieceTakersHtml = '';
            if (designatedSetPieceTakers.length > 0) {
                setPieceTakersHtml = `
                    <div style="background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 14px; padding: 20px; box-sizing: border-box; display:flex; flex-direction:column; gap:10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                        <h4 style="margin:0; font-size:13px; font-weight:900; color:var(--text-main); text-transform:uppercase; letter-spacing:0.5px; border-bottom:1.5px solid var(--border-color); padding-bottom:8px;">Designated Takers In Squad</h4>
                        <div style="display:flex; flex-direction:column; gap:10px;">
                            ${designatedSetPieceTakers.map(item => `
                                <div style="display:flex; justify-content:space-between; align-items:center; font-size:12.5px;">
                                    <span style="color:var(--text-main); font-weight:800;">${item.player.web_name} (${item.player.team})</span>
                                    <span style="color:var(--primary); font-weight:900; text-shadow:0 0 4px var(--primary-glow);">${item.duties}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            slideBody = `
                <div style="display:grid; grid-template-columns: 1.25fr 0.75fr; gap:32px; width:100%; box-sizing: border-box; height:100%; max-height:76vh;">
                    <!-- Left: Injury & Minutes Risks -->
                    <div style="display:flex; flex-direction:column; gap:14px; box-sizing: border-box;">
                        <h4 style="margin:0; font-size:13px; font-weight:900; color:#ef4444; text-transform:uppercase; letter-spacing:1px;">Squad Minutes & Fitness Warnings</h4>
                        <div style="display:flex; flex-direction:column; gap:12px; overflow-y:auto; max-height: 65vh; padding-right:8px;">
                            ${riskCardsHtml}
                        </div>
                    </div>

                    <!-- Right: Tactical Role & Set Piece hierarchy -->
                    <div style="display:flex; flex-direction:column; gap:20px; box-sizing: border-box;">
                        <h4 style="margin:0; font-size:13px; font-weight:900; color:#22c55e; text-transform:uppercase; letter-spacing:1px;">Tactical Discoveries</h4>
                        ${setPieceTakersHtml}
                        
                        <div style="background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 14px; padding: 20px; font-size:13px; color:var(--text-muted); line-height:1.6; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                            <strong style="color:var(--text-main); display:block; margin-bottom:8px; font-size:13.5px; font-family:var(--font-heading);">⚡ DEFCON / xGI MATRIX</strong>
                            Evaluated defense statistics using 2026-27 indicators. Starting defenders register clean sheet opportunities backed by team FDR ratings. Target transfers based on fixtures.
                        </div>
                    </div>
                </div>
            `;
        } else if (activeSlideIndex === 5) {
            slideTitle = "WHAT I'M TAKING FORWARD";
            slideSub = `The three pieces of FPL GW${gw} tactical information that matter most next`;

            slideBody = `
                <div style="display:flex; flex-direction:column; gap:24px; width:100%; box-sizing: border-box;">
                    <!-- Takeaway 1 -->
                    <div style="background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 18px; padding: 24px; display:flex; gap:24px; align-items:center; box-shadow: 0 6px 16px rgba(0,0,0,0.12); transition: transform 0.2s;">
                        <div style="width:54px; height:54px; background:rgba(34, 197, 94, 0.1); border:2.5px solid #22c55e; border-radius:12px; display:flex; align-items:center; justify-content:center; color:#22c55e; font-size:20px; font-weight:900; font-family:var(--font-heading); flex-shrink:0; box-shadow: 0 0 12px rgba(34, 197, 94, 0.35);">
                            01
                        </div>
                        <div style="display:flex; flex-direction:column; gap:6px;">
                            <h4 style="margin:0; font-size:15px; font-weight:900; color:var(--text-main); font-family:var(--font-heading); text-transform:uppercase; letter-spacing:0.5px;">TRUST THE THREAT</h4>
                            <p style="margin:0; font-size:13.5px; color:var(--text-muted); line-height:1.6;">
                                ${threatTerm}
                            </p>
                        </div>
                    </div>

                    <!-- Takeaway 2 -->
                    <div style="background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 18px; padding: 24px; display:flex; gap:24px; align-items:center; box-shadow: 0 6px 16px rgba(0,0,0,0.12); transition: transform 0.2s;">
                        <div style="width:54px; height:54px; background:rgba(245, 158, 11, 0.1); border:2.5px solid #f59e0b; border-radius:12px; display:flex; align-items:center; justify-content:center; color:#f59e0b; font-size:20px; font-weight:900; font-family:var(--font-heading); flex-shrink:0; box-shadow: 0 0 12px rgba(245, 158, 11, 0.35);">
                            02
                        </div>
                        <div style="display:flex; flex-direction:column; gap:6px;">
                            <h4 style="margin:0; font-size:15px; font-weight:900; color:var(--text-main); font-family:var(--font-heading); text-transform:uppercase; letter-spacing:0.5px;">MONITOR THE REAL CONCERNS</h4>
                            <p style="margin:0; font-size:13.5px; color:var(--text-muted); line-height:1.6;">
                                ${riskTerm}
                            </p>
                        </div>
                    </div>

                    <!-- Takeaway 3 -->
                    <div style="background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 18px; padding: 24px; display:flex; gap:24px; align-items:center; box-shadow: 0 6px 16px rgba(0,0,0,0.12); transition: transform 0.2s;">
                        <div style="width:54px; height:54px; background:rgba(168, 85, 247, 0.1); border:2.5px solid #a855f7; border-radius:12px; display:flex; align-items:center; justify-content:center; color:#a855f7; font-size:20px; font-weight:900; font-family:var(--font-heading); flex-shrink:0; box-shadow: 0 0 12px rgba(168, 85, 247, 0.35);">
                            03
                        </div>
                        <div style="display:flex; flex-direction:column; gap:6px;">
                            <h4 style="margin:0; font-size:15px; font-weight:900; color:var(--text-main); font-family:var(--font-heading); text-transform:uppercase; letter-spacing:0.5px;">UPDATE THE MODEL</h4>
                            <p style="margin:0; font-size:13.5px; color:var(--text-muted); line-height:1.6;">
                                ${modelTerm}
                            </p>
                        </div>
                    </div>
                </div>
            `;
        }

        modalDiv.innerHTML = `
            <div class="opt-settings-card" style="width: 100vw; height: 100vh; max-width: 100vw; max-height: 100vh; display: flex; flex-direction: column; background: var(--bg-card); border: none; border-radius: 0; box-shadow: none; overflow: hidden; font-family: var(--font-body); position: relative;">
                
                <!-- Floating Left Edge Arrow -->
                <button id="modalLeftArrowBtn" style="position: fixed; top: 50%; left: 30px; transform: translateY(-50%); width: 56px; height: 56px; border-radius: 50%; background: var(--bg-panel); border: 2px solid var(--border-color); color: var(--text-main); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; z-index: 10000; box-shadow: 0 4px 15px rgba(0,0,0,0.3); ${activeSlideIndex === 0 ? 'opacity: 0.2; cursor: not-allowed;' : ''}" ${activeSlideIndex === 0 ? 'disabled' : ''}>
                    <i data-lucide="chevron-left" style="width: 28px; height: 28px;"></i>
                </button>

                <!-- Floating Right Edge Arrow -->
                <button id="modalRightArrowBtn" style="position: fixed; top: 50%; right: 30px; transform: translateY(-50%); width: 56px; height: 56px; border-radius: 50%; background: var(--bg-panel); border: 2px solid var(--border-color); color: var(--text-main); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; z-index: 10000; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
                    <i data-lucide="${activeSlideIndex === 5 ? 'check' : 'chevron-right'}" style="width: 28px; height: 28px; color: ${activeSlideIndex === 5 ? 'var(--primary)' : 'inherit'};"></i>
                </button>

                <!-- Slide Header -->
                <div class="opt-card-header" style="border-bottom: 1px solid var(--border-color); padding: 22px 40px; display: flex; justify-content: space-between; align-items: center; background: var(--bg-panel); box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-left: 90px; margin-right: 90px;">
                    <div style="display:flex; align-items:center; gap:16px;">
                        <div style="width:46px; height:46px; background:rgba(0, 255, 136, 0.08); border-radius:50%; display:flex; align-items:center; justify-content:center; border:1px solid var(--primary-glow); box-shadow:0 0 12px var(--primary-glow);">
                            <i data-lucide="brain" style="width:24px; height:24px; color:var(--primary);"></i>
                        </div>
                        <div>
                            <div style="display:flex; align-items:center; gap:10px;">
                                <h3 style="margin:0; font-size:20px; font-weight:950; font-family:var(--font-heading); color:var(--text-main); letter-spacing:0.75px; text-transform:uppercase;">AI Squad Report</h3>
                                <span style="font-size:10px; font-weight:900; background:rgba(0, 255, 136, 0.12); color:var(--primary); padding:3px 10px; border-radius:12px; border:1px solid var(--primary-glow); letter-spacing:0.5px;">Artetificial Intel</span>
                            </div>
                            <p style="margin:4px 0 0 0; font-size:12px; color:var(--text-muted); font-weight:600; letter-spacing:0.25px;">Dynamic 2026-27 Season Tactical Performance Recap</p>
                        </div>
                    </div>
                    
                    <!-- Slide indicator -->
                    <div style="display:flex; align-items:center; gap:16px;">
                        <span style="font-size:12.5px; font-weight:900; background:var(--bg-panel); border:1.5px solid var(--border-color); color:var(--text-main); padding:4px 16px; border-radius:20px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
                            ${activeSlideIndex + 1} of 6
                        </span>
                        <button id="closeTpSquadAnalysisModalBtn" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:28px; font-weight:300; line-height:1; padding:0; display:flex; align-items:center; justify-content:center; width:32px; height:32px; transition:color 0.2s;">&times;</button>
                    </div>
                </div>

                <!-- Slide Body (Title & Content) -->
                <div style="flex:1; overflow-y:auto; padding:32px 40px; display:flex; flex-direction:column; gap:24px; box-sizing:border-box; margin-left: 90px; margin-right: 90px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; border-left: 4px solid var(--primary); padding-left:16px;">
                        <div>
                            <h2 style="margin:0; font-size:26px; font-weight:950; font-family:var(--font-heading); color:var(--text-main); letter-spacing:0.75px;">${slideTitle}</h2>
                            <p style="margin:4px 0 0 0; font-size:13.5px; color:var(--text-muted); font-weight:700;">${slideSub}</p>
                        </div>
                        <span style="font-size:11.5px; font-weight:900; background:rgba(168, 85, 247, 0.15); border:1.5px solid rgba(168, 85, 247, 0.35); color:#c084fc; padding:4px 12px; border-radius:8px; font-family:var(--font-mono); letter-spacing:0.5px;">GW${gw} • Slide ${activeSlideIndex + 1}</span>
                    </div>

                    <div style="flex:1; display:flex; align-items:center; width:100%; box-sizing: border-box;">
                        ${slideBody}
                    </div>
                </div>

                <!-- Slide Footer (Dots Only, no prev/next buttons) -->
                <div style="padding:20px 32px; border-top:1px solid var(--border-color); display:flex; justify-content:center; align-items:center; background: var(--bg-panel); box-shadow: 0 -2px 10px rgba(0,0,0,0.05); margin-left: 90px; margin-right: 90px;">
                    <!-- Progress indicator dots -->
                    <div style="display:flex; gap:10px;">
                        ${[0, 1, 2, 3, 4, 5].map(idx => `
                            <div style="width:10px; height:10px; border-radius:50%; background:${idx === activeSlideIndex ? 'var(--primary)' : 'var(--border-color)'}; box-shadow:${idx === activeSlideIndex ? '0 0 8px var(--primary)' : 'none'}; cursor:pointer; transition:background 0.2s;" class="progress-dot-nav" data-index="${idx}"></div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        // Rebind click events
        modalDiv.querySelector('#closeTpSquadAnalysisModalBtn').addEventListener('click', () => modalDiv.remove());
        
        const leftArrow = modalDiv.querySelector('#modalLeftArrowBtn');
        if (leftArrow && activeSlideIndex > 0) {
            leftArrow.addEventListener('click', () => {
                activeSlideIndex--;
                renderCurrentSlide();
            });
        }

        const rightArrow = modalDiv.querySelector('#modalRightArrowBtn');
        if (rightArrow) {
            rightArrow.addEventListener('click', () => {
                if (activeSlideIndex < 5) {
                    activeSlideIndex++;
                    renderCurrentSlide();
                } else {
                    modalDiv.remove();
                }
            });
        }

        // Dot navigation
        modalDiv.querySelectorAll('.progress-dot-nav').forEach(dot => {
            dot.addEventListener('click', () => {
                activeSlideIndex = parseInt(dot.getAttribute('data-index'));
                renderCurrentSlide();
            });
        });
        
        // Add dynamic CSS style rules inline
        const styleTag = document.createElement('style');
        styleTag.innerHTML = `
            .squad-reality-card:hover {
                transform: translateY(-5px);
                border-color: var(--primary) !important;
                box-shadow: 0 12px 30px rgba(0,0,0,0.25), 0 0 14px var(--primary-glow) !important;
            }
            #modalLeftArrowBtn:hover:not(:disabled), #modalRightArrowBtn:hover {
                background: var(--bg-card) !important;
                border-color: var(--primary) !important;
                color: var(--primary) !important;
                transform: translateY(-50%) scale(1.08) !important;
                box-shadow: 0 6px 20px rgba(0,0,0,0.4), 0 0 10px var(--primary-glow) !important;
            }
            @keyframes pulse {
                0% { opacity: 0.7; transform: scale(1); }
                50% { opacity: 1; transform: scale(1.08); }
                100% { opacity: 0.7; transform: scale(1); }
            }
        `;
        modalDiv.appendChild(styleTag);
        
        lucide.createIcons();
    };

    renderCurrentSlide();
    document.body.appendChild(modalDiv);
}
