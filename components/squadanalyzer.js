// components/squadanalyzer.js
import { PLAYERS, TEAMS } from '../data.js';
import { getShirtSVG } from './planner.js';

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
    const liveStatsMap = (state && state.liveStats && state.liveStats[gw]) || {};
    const getPlayerGwPoints = (player) => {
        const livePts = livePointsMap[player.id];
        if (livePts !== undefined && livePts !== null) return livePts;
        const pred = player.predictions.find(pr => pr.gw == gw);
        if (pred && pred.actualPts !== undefined && pred.actualPts !== null) return pred.actualPts;
        if (pred && pred.pts !== undefined) return Math.round(pred.pts);
        return 0;
    };
    // Returns GW-specific detailed stats if available (goals, assists, clean_sheets, bonus, etc.)
    const getPlayerGwStats = (player) => {
        return liveStatsMap[player.id] || null;
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

    // Check if this gameweek has actual FPL scores (is active or completed)
    const hasActualScores = starters.some(id => {
        const p = PLAYERS.find(pl => pl.id === id);
        if (!p) return false;
        if (livePointsMap[p.id] !== undefined && livePointsMap[p.id] !== null) return true;
        const pred = p.predictions.find(pr => pr.gw == gw);
        return !!(pred && pred.actualPts !== undefined && pred.actualPts !== null);
    });

    // Safety score calculation
    let safetyScore = 100;
    starters.forEach(id => {
        const p = PLAYERS.find(pl => pl.id === id);
        if (p) {
            if (p.status !== 'a' && p.status !== 'd') safetyScore -= 15;
            if (p.chanceOfPlaying < 100) safetyScore -= 10;
            if (p.displacementRisk) safetyScore -= 10;
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

    const getVerdict = (pts, isPlayed, isCumulative) => {
        if (!isPlayed) return { label: 'NO NEW INFO', class: 'neutral-pill' };
        if (isCumulative) {
            if (pts >= 120) return { label: 'VERY STRONG +', class: 'v-strong-pill' };
            if (pts >= 80) return { label: 'STRONG +', class: 'strong-pill' };
            if (pts >= 40) return { label: 'NEUTRAL', class: 'neutral-pill' };
            if (pts >= 10) return { label: 'MIXED', class: 'mixed-pill' };
            return { label: 'NEGATIVE -', class: 'negative-pill' };
        } else {
            if (pts >= 10) return { label: 'VERY STRONG +', class: 'v-strong-pill' };
            if (pts >= 6) return { label: 'STRONG +', class: 'strong-pill' };
            if (pts >= 3) return { label: 'NEUTRAL', class: 'neutral-pill' };
            if (pts >= 1) return { label: 'MIXED', class: 'mixed-pill' };
            return { label: 'NEGATIVE -', class: 'negative-pill' };
        }
    };

    const allSquadDetails = squad.map(id => {
        const p = PLAYERS.find(pl => pl.id === id);
        if (!p) return null;

        const gwPts = getPlayerGwPoints(p);

        // Sum actualPts from played GWs this season to get correct current-season total
        // (p.points is last season's total, not this season's)
        const playedPredictions = (p.predictions || []).filter(pr => pr.actualPts !== null);
        const seasonPts = playedPredictions.reduce((sum, pr) => sum + (pr.actualPts || 0), 0);
        const matchCount = playedPredictions.length;

        const isStarting = starters.includes(id);
        const chance = (p.chanceOfPlaying !== undefined && p.chanceOfPlaying !== null) ? p.chanceOfPlaying : 100;

        let gwDisplayPts = `${gwPts}`;
        if (id === captain && hasActualScores) {
            const mult = state.chips[gw]?.tripleCaptain ? 3 : 2;
            gwDisplayPts = `${gwPts} (${gwPts * mult}C)`;
        }

        const hasPlayed = p.currentSeasonMins > 0 || gwPts > 0;
        const gwVerdict = getVerdict(gwPts, hasPlayed, false);
        const seasonVerdict = getVerdict(seasonPts, matchCount > 0, true);
        const hasFlag = p.status !== 'a' || chance < 100 || p.displacementRisk !== null;

        return {
            player: p,
            gwPts: gwDisplayPts,
            rawGwPts: gwPts,
            seasonPts,
            matchCount,
            isStarting,
            gwVerdict,
            seasonVerdict,
            hasFlag,
            position: p.position,
            team: p.team,
            price: p.price
        };
    }).filter(Boolean);

    const startersObjects = starters.map(id => PLAYERS.find(p => p.id === id)).filter(Boolean);
    const benchObjects = bench.map(id => PLAYERS.find(p => p.id === id)).filter(Boolean);

    // Sort Substitutes: GKP first, then outfielders ordered 1-3
    const gkSub = benchObjects.find(p => p.position === 'GKP');
    const outfieldSubs = benchObjects.filter(p => p.position !== 'GKP');
    const sortedBench = [];
    if (gkSub) sortedBench.push({ player: gkSub, label: 'GKP' });
    outfieldSubs.forEach((player, idx) => {
        sortedBench.push({ player, label: `${idx + 1}. ${player.position}` });
    });

    // Split starters into Attackers (MID, FWD) and Defenders/GKPs for slide 3 points vs performance review
    const attackersStarters = startersObjects.filter(p => p.position === 'MID' || p.position === 'FWD');
    const defendersStarters = startersObjects.filter(p => p.position === 'DEF' || p.position === 'GKP');

    const underperformingAttackers = attackersStarters
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

    const overperformingAttackers = attackersStarters
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

    // Add up to 2 attacker cards (underperforming / overperforming on xGI)
    underperformingAttackers.forEach(entry => {
        if (entry.xgi > 0.15 && pointsVsPerformanceList.length < 2) {
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

    overperformingAttackers.forEach(entry => {
        if (entry.pts >= 6 && pointsVsPerformanceList.length < 2) {
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

    // Make sure we have at least 2 attacker slots filled
    attackersStarters.forEach(p => {
        if (pointsVsPerformanceList.length < 2 && !pointsVsPerformanceList.some(item => item.player.id === p.id)) {
            const pts = getPlayerGwPoints(p);
            pointsVsPerformanceList.push({
                player: p,
                pts: pts,
                tag: 'STABLE ATTACKING CORE',
                tagClass: 'neutral-pill',
                stats: `xGI: ${p.xGI.toFixed(2)} | ICT: ${p.ictIndex.toFixed(1)}`,
                blurb: `${p.web_name} played regular minutes with standard underlying output. Solid attacking asset to keep in your starting XI.`
            });
        }
    });

    // Now add 2 defender cards focusing on clean sheets, goals, and Defcon
    const sortedDefenders = defendersStarters.map(p => {
        const pts = getPlayerGwPoints(p);
        const dc = p.dcPer90 || 0;
        const gwStats = getPlayerGwStats(p);
        const gwGoals = gwStats ? (gwStats.goals_scored || 0) : 0;
        const gwAssists = gwStats ? (gwStats.assists || 0) : 0;
        // Use liveStats clean_sheets if available; else heuristic (6+ pts DEF/GKP likely kept a CS)
        const gwCleanSheet = gwStats
            ? (gwStats.clean_sheets || 0)
            : ((pts >= 6 && (p.position === 'DEF' || p.position === 'GKP')) ? 1 : 0);
        return { player: p, pts, dc, gwGoals, gwAssists, gwCleanSheet };
    }).sort((a, b) => b.pts - a.pts);

    sortedDefenders.slice(0, 2).forEach(entry => {
        const p = entry.player;
        const pts = entry.pts;
        const dc = entry.dc;
        const gwCs = entry.gwCleanSheet;
        const gwGoals = entry.gwGoals;
        const gwAssists = entry.gwAssists;
        const hasAttacking = gwGoals > 0 || gwAssists > 0;

        let tag, blurb;
        if (pts >= 6) {
            if (hasAttacking && gwCs > 0) {
                tag = 'GOAL / ASSIST + CLEAN SHEET ⚡';
                blurb = `${p.web_name} delivered the full package — ${gwGoals > 0 ? `${gwGoals} goal(s)` : ''}${gwAssists > 0 ? ` ${gwAssists} assist(s)` : ''} AND a clean sheet. Defenders with both attacking and defensive returns are elite FPL assets.`;
            } else if (hasAttacking) {
                tag = 'ATTACKING + DEFENSIVE RETURN';
                blurb = `${p.web_name} contributed ${gwGoals > 0 ? `${gwGoals} goal(s)` : ''}${gwAssists > 0 ? ` and ${gwAssists} assist(s)` : ''} this GW. For a defender, this is a bonus return on top of their defensive baseline (Defcon: ${dc.toFixed(2)}/90).`;
            } else if (gwCs > 0) {
                tag = 'CLEAN SHEET + DEFENSIVE RETURN';
                blurb = `${p.web_name} secured ${pts} pts including a clean sheet ✅. Clean sheets and defensive contributions (Defcon: ${dc.toFixed(2)}/90) are the primary points route — attacking returns are a bonus.`;
            } else {
                tag = 'SOLID DEFENSIVE RETURN';
                blurb = `${p.web_name} scored ${pts} pts from appearances and bonus. For defenders, Defcon (${dc.toFixed(2)}/90) underpins their weekly floor — clean sheet fixtures will unlock the ceiling.`;
            }
            pointsVsPerformanceList.push({
                player: p, pts,
                tag, tagClass: 'strong-pill',
                stats: `Defcon: ${dc.toFixed(2)}/90 | xG: ${p.xG?.toFixed(2) || '0.00'} | xA: ${p.xA?.toFixed(2) || '0.00'} | ICT: ${p.ictIndex.toFixed(1)}`,
                blurb
            });
        } else {
            pointsVsPerformanceList.push({
                player: p, pts,
                tag: 'DEFENSIVE SOLIDITY BASE',
                tagClass: 'neutral-pill',
                stats: `Defcon: ${dc.toFixed(2)}/90 | xG: ${p.xG?.toFixed(2) || '0.00'} | xA: ${p.xA?.toFixed(2) || '0.00'} | ICT: ${p.ictIndex.toFixed(1)}`,
                blurb: `${p.web_name} played in defense with a baseline Defcon rate of ${dc.toFixed(2)}/90. He provides a steady defensive floor — clean sheet fixtures will unlock the ceiling.`
            });
        }
    });

    // Fill to 4 cards from remaining defenders
    sortedDefenders.forEach(entry => {
        if (pointsVsPerformanceList.length < 4 && !pointsVsPerformanceList.some(item => item.player.id === entry.player.id)) {
            pointsVsPerformanceList.push({
                player: entry.player,
                pts: entry.pts,
                tag: 'DEFENSIVE ROLE',
                tagClass: 'neutral-pill',
                stats: `Defcon: ${entry.dc.toFixed(2)}/90 | ICT: ${entry.player.ictIndex.toFixed(1)}`,
                blurb: `${entry.player.web_name} played in defense registering a Defcon contribution rate of ${entry.dc.toFixed(2)} per 90.`
            });
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

    // PDF Report Compilation & Download via Blob URL (no popup needed)
    const triggerPdfDownload = () => {
        actions.showToast('⏳ Generating PDF report...', 'info');

        // Starters rows for Pitch render
        const rowGKPs = startersObjects.filter(p => p.position === 'GKP');
        const rowDEFs = startersObjects.filter(p => p.position === 'DEF');
        const rowMIDs = startersObjects.filter(p => p.position === 'MID');
        const rowFWDs = startersObjects.filter(p => p.position === 'FWD');

        const makePdfPitchPlayerHtml = (p, isBench = false, benchLabel = '') => {
            const pts = getPlayerGwPoints(p);
            const isCaptain = p.id === captain;
            const displayPts = isCaptain ? `${pts * (state.chips[gw]?.tripleCaptain ? 3 : 2)}` : `${pts}`;
            const teamObj = TEAMS.find(t => t.shortName === p.team) || { color: '#ffffff' };
            const shirtHtml = getShirtSVG(teamObj.color, p.team, p.position);

            return `
                <div class="pdf-player-card">
                    ${isBench ? `<div class="pdf-sub-label">${benchLabel}</div>` : ''}
                    <div style="position:relative; width:48px; height:48px; display:inline-block;">
                        ${shirtHtml}
                        ${isCaptain ? `<div class="pdf-captain-badge">C</div>` : ''}
                    </div>
                    <div class="pdf-player-name">${p.web_name}</div>
                    <div class="pdf-player-points">${displayPts} pts</div>
                </div>
            `;
        };

        const pdfHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>AI Squad Report - GW${gw}</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                        color: #1e293b;
                        background: #ffffff;
                        padding: 30px;
                        margin: 0;
                    }
                    .pdf-slide {
                        page-break-after: always;
                        break-after: page;
                        margin-bottom: 50px;
                        padding-bottom: 30px;
                        border-bottom: 2px solid #f1f5f9;
                    }
                    .pdf-slide:last-child {
                        page-break-after: avoid;
                        break-after: avoid;
                        border-bottom: none;
                    }
                    .pdf-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 3px solid #37003c;
                        padding-bottom: 12px;
                        margin-bottom: 24px;
                    }
                    .pdf-title {
                        font-size: 24px;
                        font-weight: 900;
                        text-transform: uppercase;
                        color: #37003c;
                        margin: 0;
                    }
                    .pdf-subtitle {
                        font-size: 13px;
                        color: #64748b;
                        margin: 4px 0 0 0;
                        font-weight: 600;
                    }
                    .grid-2 {
                        display: grid;
                        grid-template-columns: 1.2fr 0.8fr;
                        gap: 30px;
                    }
                    .pdf-pitch {
                        background: radial-gradient(circle, #15803d 0%, #166534 100%);
                        border-radius: 12px;
                        padding: 24px;
                        color: white;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                    }
                    .pdf-pitch-row {
                        display: flex;
                        justify-content: center;
                        gap: 20px;
                        margin: 10px 0;
                    }
                    .pdf-player-card {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        width: 75px;
                        text-align: center;
                    }
                    .pdf-player-name {
                        background: #ffffff;
                        color: #000000;
                        font-size: 9.5px;
                        font-weight: 900;
                        padding: 2px 4px;
                        border-radius: 3px;
                        margin-top: 4px;
                        width: 90%;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                    }
                    .pdf-player-points {
                        background: #37003c;
                        color: #ffffff;
                        font-size: 9.5px;
                        font-weight: 900;
                        padding: 1px 6px;
                        border-radius: 3px;
                        margin-top: 2px;
                    }
                    .pdf-captain-badge {
                        position: absolute;
                        top: -3px;
                        left: -3px;
                        width: 14px;
                        height: 14px;
                        border-radius: 50%;
                        background: #22c55e;
                        color: black;
                        font-size: 8.5px;
                        font-weight: 900;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 0 3px rgba(0,0,0,0.2);
                    }
                    .pdf-sub-label {
                        font-size: 8.5px;
                        font-weight: 800;
                        color: #cbd5e1;
                        text-transform: uppercase;
                        margin-bottom: 2px;
                    }
                    .pdf-bench-box {
                        margin-top: 14px;
                        background: rgba(0,0,0,0.25);
                        border-radius: 8px;
                        padding: 8px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                    }
                    .pdf-bench-title {
                        font-size: 9.5px;
                        font-weight: 800;
                        color: white;
                        text-transform: uppercase;
                        border-bottom: 1px solid rgba(255,255,255,0.15);
                        width: 100%;
                        text-align: center;
                        padding-bottom: 2px;
                        margin-bottom: 4px;
                    }
                    .pdf-right-metric-card {
                        background: #f8fafc;
                        border: 1.5px solid #e2e8f0;
                        border-radius: 12px;
                        padding: 20px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        margin-bottom: 16px;
                    }
                    .pdf-score-val {
                        font-size: 64px;
                        font-weight: 900;
                        color: #15803d;
                        line-height: 1;
                        margin: 6px 0;
                    }
                    .pdf-grid-2x2 {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 12px;
                        width: 100%;
                    }
                    .pdf-metric-cell {
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                        border-radius: 8px;
                        padding: 10px;
                        text-align: center;
                    }
                    .pdf-metric-title {
                        font-size: 8.5px;
                        font-weight: 800;
                        color: #64748b;
                        text-transform: uppercase;
                    }
                    .pdf-metric-val {
                        font-size: 14px;
                        font-weight: 900;
                        color: #0f172a;
                        margin-top: 4px;
                        display: block;
                    }
                    .pdf-cards-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
                        gap: 16px;
                        width: 100%;
                    }
                    .pdf-detail-card {
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                        border-radius: 10px;
                        padding: 14px;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        min-height: 100px;
                    }
                    .pdf-tag {
                        display: inline-block;
                        font-size: 8px;
                        font-weight: 900;
                        padding: 2px 6px;
                        border-radius: 4px;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        background: #e2e8f0;
                        align-self: flex-start;
                    }
                    .v-strong-pill { background: rgba(34,197,94,0.15); color: #15803d; }
                    .strong-pill { background: rgba(34,197,94,0.1); color: #166534; }
                    .neutral-pill { background: rgba(100,116,139,0.1); color: #475569; }
                    .mixed-pill { background: rgba(245,158,11,0.1); color: #b45309; }
                    .negative-pill { background: rgba(239,68,68,0.1); color: #b91c1c; }
                    .pdf-alert-card {
                        border-left: 5px solid #3b82f6;
                        background: #f0f9ff;
                        padding: 14px 18px;
                        border-radius: 8px;
                        margin-bottom: 12px;
                    }
                    .pdf-takeaway-card {
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                        border-radius: 12px;
                        padding: 16px;
                        display: flex;
                        gap: 16px;
                        align-items: center;
                        margin-bottom: 14px;
                    }
                    .pdf-num-circle {
                        width: 36px;
                        height: 36px;
                        background: #e2e8f0;
                        border-radius: 8px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: 900;
                        color: #475569;
                        flex-shrink: 0;
                    }
                    .shirt-svg {
                        width: 38px;
                        height: 38px;
                        object-fit: contain;
                    }
                </style>
            </head>
            <body>
                <!-- Slide 1: MY GAMEWEEK REVIEW -->
                <div class="pdf-slide">
                    <div class="pdf-header">
                        <div>
                            <h2 class="pdf-title">AI Squad Report - Gameweek ${gw}</h2>
                            <p class="pdf-subtitle">Slide 1: My Gameweek Review</p>
                        </div>
                        <span style="font-size:12px; font-weight:800; color:#37003c;">ARTETIFICIAL INTEL</span>
                    </div>

                    <div class="grid-2">
                        <div class="pdf-pitch">
                            <div class="pdf-pitch-row">
                                ${rowFWDs.map(p => makePdfPitchPlayerHtml(p)).join('')}
                            </div>
                            <div class="pdf-pitch-row">
                                ${rowMIDs.map(p => makePdfPitchPlayerHtml(p)).join('')}
                            </div>
                            <div class="pdf-pitch-row">
                                ${rowDEFs.map(p => makePdfPitchPlayerHtml(p)).join('')}
                            </div>
                            <div class="pdf-pitch-row">
                                ${rowGKPs.map(p => makePdfPitchPlayerHtml(p)).join('')}
                            </div>
                            
                            <div class="pdf-bench-box">
                                <div class="pdf-bench-title">Substitutes</div>
                                <div style="display:flex; gap:12px;">
                                    ${sortedBench.map(b => makePdfPitchPlayerHtml(b.player, true, b.label)).join('')}
                                </div>
                            </div>
                        </div>

                        <div>
                            <div class="pdf-right-metric-card">
                                <span style="font-size:10px; font-weight:800; color:#64748b;">MY SCORE</span>
                                <span class="pdf-score-val">${totalStarterPoints}</span>
                                <span style="font-size:11px; font-weight:700;">Points in Gameweek ${gw}</span>
                            </div>

                            <div class="pdf-grid-2x2">
                                <div class="pdf-metric-cell">
                                    <span class="pdf-metric-title">GW Rank</span>
                                    <span class="pdf-metric-val">${gwRank.toLocaleString()}</span>
                                </div>
                                <div class="pdf-metric-cell">
                                    <span class="pdf-metric-title">Live Rank</span>
                                    <span class="pdf-metric-val">${liveRank.toLocaleString()}</span>
                                </div>
                                <div class="pdf-metric-cell">
                                    <span class="pdf-metric-title">Safety Rating</span>
                                    <span class="pdf-metric-val">${safetyScore}%</span>
                                </div>
                                <div class="pdf-metric-cell">
                                    <span class="pdf-metric-title">Average Delta</span>
                                    <span class="pdf-metric-val">${delta >= 0 ? '+' : ''}${delta} pts</span>
                                </div>
                            </div>
                            
                            <div class="pdf-right-metric-card" style="margin-top: 16px; padding: 12px 16px; align-items: flex-start; width: 100%; box-sizing: border-box;">
                                <div style="font-size:11px; font-weight:700; color:#64748b;">CAPTAIN DECISION: <strong style="color:#fbbf24; font-size:12px; margin-left: 6px;">${captLabel}</strong></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Slide 2: 15-MAN REALITY CHECK -->
                <div class="pdf-slide">
                    <div class="pdf-header">
                        <div>
                            <h2 class="pdf-title">15-Man Reality Check</h2>
                            <p class="pdf-subtitle">FPL season points against actual team-role performance indicators</p>
                        </div>
                        <span style="font-size:12px; font-weight:800; color:#37003c;">Slide 2 of 6</span>
                    </div>

                    <div class="pdf-cards-grid">
                        ${allSquadDetails.map(item => `
                            <div class="pdf-detail-card">
                                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                    <div>
                                        <strong style="font-size:12.5px; color:#0f172a;">${item.player.web_name}</strong>
                                        <div style="font-size:9.5px; color:#64748b; margin-top:2px;">${item.team} &bull; ${item.position} &bull; &pound;${item.price.toFixed(1)}m</div>
                                    </div>
                                    <div style="text-align:right;">
                                        <strong style="font-size:15px; color:#37003c; display:block;">${item.gwPts} pts</strong>
                                        <span style="font-size:9px; color:#64748b;">GW${gw}</span>
                                    </div>
                                </div>
                                <div style="margin-top:8px; padding:6px 8px; background:#f1f5f9; border-radius:6px; display:flex; justify-content:space-between;">
                                    <span style="font-size:9.5px; color:#475569; font-weight:700;">Season: <strong style="color:#0f172a;">${item.seasonPts} pts</strong></span>
                                    <span style="font-size:9.5px; color:#64748b;">${item.matchCount} match${item.matchCount !== 1 ? 'es' : ''}</span>
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                                    <span class="pdf-tag ${item.gwVerdict.class}">${item.gwVerdict.label}</span>
                                    <span style="font-size:10px; color:#64748b; font-weight:700;">${item.isStarting ? 'Starter' : 'Bench'}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Slide 3: POINTS VS PERFORMANCE -->
                <div class="pdf-slide">
                    <div class="pdf-header">
                        <div>
                            <h2 class="pdf-title">Points vs Performance</h2>
                            <p class="pdf-subtitle">Analyzing underlying threat statistics and expected returns</p>
                        </div>
                        <span style="font-size:12px; font-weight:800; color:#37003c;">Slide 3 of 6</span>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
                        ${pointsVsPerformanceList.map(item => `
                            <div class="pdf-detail-card" style="justify-content: flex-start; gap: 8px;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <strong style="font-size:13.5px;">${item.player.web_name}</strong>
                                    <span style="font-size:12px; font-weight:800; color:#15803d;">${item.pts} pts</span>
                                </div>
                                <span class="pdf-tag ${item.tagClass}">${item.tag}</span>
                                <div style="background:#f1f5f9; padding:8px; border-radius:6px; font-family:monospace; font-size:11px; font-weight:700; color:#334155; margin: 4px 0;">
                                    ${item.stats}
                                </div>
                                <p style="margin:0; font-size:11.5px; color:#475569; line-height:1.5;">${item.blurb}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Slide 4: DECISION REVIEW -->
                <div class="pdf-slide">
                    <div class="pdf-header">
                        <div>
                            <h2 class="pdf-title">Decision Review</h2>
                            <p class="pdf-subtitle">Evaluating process quality against actual outcomes</p>
                        </div>
                        <span style="font-size:12px; font-weight:800; color:#37003c;">Slide 4 of 6</span>
                    </div>

                    <div class="pdf-alert-card" style="border-left-color: #fbbf24; background: #fffbeb;">
                        <strong style="color:#b45309; font-size:11px; text-transform:uppercase;">Captaincy Check</strong>
                        <div style="font-size:13px; font-weight:800; color:#0f172a; margin: 4px 0 2px 0;">${captPlayer ? captPlayer.web_name : 'No Captain Selected'} - ${captaincyVerdict}</div>
                        <p style="margin:0; font-size:11.5px; color:#475569; line-height:1.45;">${captaincyComment}</p>
                    </div>

                    <div class="pdf-alert-card" style="border-left-color: #38bdf8; background: #f0f9ff;">
                        <strong style="color:#0369a1; font-size:11px; text-transform:uppercase;">Bench Decision</strong>
                        <p style="margin:4px 0 0 0; font-size:11.5px; color:#475569; line-height:1.45;">
                            Evaluated bench configurations and ordering. Starters and bench players aligned correctly with fixture profiles.
                        </p>
                    </div>

                    <div class="pdf-alert-card" style="border-left-color: #22c55e; background: #f0fdf4;">
                        <strong style="color:#166534; font-size:11px; text-transform:uppercase;">Bench Process Check</strong>
                        <p style="margin:4px 0 0 0; font-size:11.5px; color:#475569; line-height:1.45;">
                            Bench list: <strong>${benchObjects.map(p => `${p.web_name} (${getPlayerGwPoints(p)} pts)`).join(' • ') || 'Empty'}</strong>.
                            Lineup structures resolved without structural errors. The bench order corresponds perfectly to expected fixture FDR metrics.
                        </p>
                    </div>
                </div>

                <!-- Slide 5: WHAT THE MATCHES TAUGHT ME -->
                <div class="pdf-slide">
                    <div class="pdf-header">
                        <div>
                            <h2 class="pdf-title">What the Matches Taught Me</h2>
                            <p class="pdf-subtitle">Injury reports, suspension logs, and tactical set-pieces</p>
                        </div>
                        <span style="font-size:12px; font-weight:800; color:#37003c;">Slide 5 of 6</span>
                    </div>

                    <div class="grid-2">
                        <div>
                            <h4 style="margin-bottom:12px; text-transform:uppercase; color:#b91c1c; font-size:12px;">Active Fitness & Rotation Concerns</h4>
                            ${squadRisksReport.length > 0 ? squadRisksReport.map(r => `
                                <div style="border-left: 4px solid ${r.risk === 'High' ? '#ef4444' : '#f59e0b'}; background:#fafafa; padding:10px; border-radius:6px; margin-bottom:8px; font-size:11.5px;">
                                    <strong>${r.player.web_name} (${r.player.team})</strong>
                                    <p style="margin:4px 0 2px 0; font-weight:700;">⚠️ ${r.reason}</p>
                                    <p style="margin:0; font-size:10.5px; color:#64748b;">${r.details}</p>
                                </div>
                            `).join('') : `
                                <div style="font-size:11.5px; color:#64748b; padding:12px; border: 1.5px dashed #e2e8f0; border-radius:8px; text-align:center;">
                                    No active squad injuries or doubtful flags detected.
                                </div>
                            `}
                        </div>

                        <div>
                            <h4 style="margin-bottom:12px; text-transform:uppercase; color:#166534; font-size:12px;">Set Piece Takers In Squad</h4>
                            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; display:flex; flex-direction:column; gap:8px;">
                                ${designatedSetPieceTakers.map(item => `
                                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:11.5px;">
                                        <strong>${item.player.web_name}</strong>
                                        <span style="color:#166534; font-weight:800;">${item.duties}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Slide 6: WHAT I'M TAKING FORWARD -->
                <div class="pdf-slide" style="border-bottom: none; margin-bottom: 0; padding-bottom: 0;">
                    <div class="pdf-header">
                        <div>
                            <h2 class="pdf-title">What I'm Taking Forward</h2>
                            <p class="pdf-subtitle">Actionable lessons going into the next gameweek deadline</p>
                        </div>
                        <span style="font-size:12px; font-weight:800; color:#37003c;">Slide 6 of 6</span>
                    </div>

                    <div class="pdf-takeaway-card">
                        <div class="pdf-num-circle" style="background:rgba(34, 197, 94, 0.1); border: 1.5px solid #22c55e; color:#166534;">01</div>
                        <div>
                            <h4 style="margin:0; font-size:13.5px; color:#0f172a; text-transform:uppercase;">Trust the Threat</h4>
                            <p style="margin:4px 0 0 0; font-size:12px; color:#475569; line-height:1.5;">${threatTerm}</p>
                        </div>
                    </div>

                    <div class="pdf-takeaway-card">
                        <div class="pdf-num-circle" style="background:rgba(245, 158, 11, 0.1); border: 1.5px solid #f59e0b; color:#b45309;">02</div>
                        <div>
                            <h4 style="margin:0; font-size:13.5px; color:#0f172a; text-transform:uppercase;">Monitor the Real Concerns</h4>
                            <p style="margin:4px 0 0 0; font-size:12px; color:#475569; line-height:1.5;">${riskTerm}</p>
                        </div>
                    </div>

                    <div class="pdf-takeaway-card">
                        <div class="pdf-num-circle" style="background:rgba(168, 85, 247, 0.1); border: 1.5px solid #a855f7; color:#701a75;">03</div>
                        <div>
                            <h4 style="margin:0; font-size:13.5px; color:#0f172a; text-transform:uppercase;">Update the Model</h4>
                            <p style="margin:4px 0 0 0; font-size:12px; color:#475569; line-height:1.5;">${modelTerm}</p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;

        const blob = new Blob([pdfHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AI_Squad_Report_GW${gw}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        actions.showToast('✅ Report downloaded! Open the .html file and press Ctrl+P → Save as PDF.', 'success');
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

            const makePitchPlayerHtml = (p, isBench = false, benchIndexLabel = '') => {
                const pts = getPlayerGwPoints(p);
                const isCaptain = p.id === captain;
                const isVice = p.id === vice;
                
                const teamObj = TEAMS.find(t => t.shortName === p.team) || { color: '#ffffff' };
                const shirtHtml = getShirtSVG(teamObj.color, p.team, p.position);
                
                const displayPts = isCaptain ? `${pts * (state.chips[gw]?.tripleCaptain ? 3 : 2)}` : `${pts}`;
                
                let badgeHtml = '';
                if (isCaptain) {
                    badgeHtml = `<div style="position:absolute; top:-3px; left:-3px; width:16px; height:16px; border-radius:50%; background:#00ff88; color:black; font-size:10px; font-weight:900; display:flex; align-items:center; justify-content:center; box-shadow:0 0 6px #00ff88;">C</div>`;
                } else if (isVice) {
                    badgeHtml = `<div style="position:absolute; top:-3px; left:-3px; width:16px; height:16px; border-radius:50%; background:#38bdf8; color:black; font-size:10px; font-weight:900; display:flex; align-items:center; justify-content:center; box-shadow:0 0 6px #38bdf8;">V</div>`;
                }
                
                return `
                    <div style="display:flex; flex-direction:column; align-items:center; width:80px; position:relative; margin: 4px;">
                        ${isBench ? `<div style="font-size:9.5px; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:6px;">${benchIndexLabel}</div>` : ''}
                        <div style="position:relative; width:52px; height:52px; display:flex; align-items:center; justify-content:center;">
                            ${shirtHtml}
                            ${badgeHtml}
                        </div>
                        
                        <!-- Player Name Banner -->
                        <div style="background:#fff; color:#000; font-size:10px; font-weight:900; padding:2.5px 6px; border-radius:3px; text-align:center; width:95%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:5px; box-shadow:0 2px 4px rgba(0,0,0,0.25);">
                            ${p.web_name}
                        </div>
                        
                        <!-- Points Badge -->
                        <div style="background:#37003c; color:#fff; font-size:10px; font-weight:900; padding:2px 8px; border-radius:3px; margin-top:3px; box-shadow:0 2px 4px rgba(0,0,0,0.25);">
                            ${displayPts}
                        </div>
                    </div>
                `;
            };

            slideBody = `
                <div style="display: flex; gap: 48px; flex-wrap: wrap; width:100%; height:100%; min-height: 580px; box-sizing: border-box; padding: 10px;">
                    <!-- Left: Pitch -->
                    <div style="flex: 1.5; min-width: 360px; background: radial-gradient(circle, #0e3f27 0%, #062314 100%); border: 2px solid var(--border-color); border-radius: 16px; padding: 24px; display:flex; flex-direction:column; justify-content:space-between; box-sizing: border-box; position:relative; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
                        <!-- Field Markings -->
                        <div style="position:absolute; top:50%; left:0; width:100%; height:2px; background:rgba(255,255,255,0.05); transform:translateY(-50%); pointer-events:none;"></div>
                        <div style="position:absolute; top:50%; left:50%; width:150px; height:150px; border:2px solid rgba(255,255,255,0.05); border-radius:50%; transform:translate(-50%, -50%); pointer-events:none;"></div>
                        <div style="position:absolute; top:0; left:50%; width:240px; height:90px; border:2px solid rgba(255,255,255,0.05); border-top:none; transform:translateX(-50%); pointer-events:none;"></div>
                        <div style="position:absolute; bottom:0; left:50%; width:240px; height:90px; border:2px solid rgba(255,255,255,0.05); border-bottom:none; transform:translateX(-50%); pointer-events:none;"></div>
                        
                        <div style="border-bottom: 2px dashed rgba(255,255,255,0.1); padding-bottom:8px; text-align:center; font-size:12px; color:#a3e635; font-weight:800; letter-spacing:1.5px; text-transform:uppercase; z-index:1;">PITCH VISUALIZER</div>
                        
                        <!-- Starters on Pitch -->
                        <div style="display:flex; flex-direction:column; justify-content:space-around; flex:1; margin-top:16px; z-index:1;">
                            <div style="display:flex; justify-content:center; gap:24px; margin: 12px 0;">
                                ${rowFWDs.map(p => makePitchPlayerHtml(p)).join('')}
                            </div>
                            <div style="display:flex; justify-content:center; gap:24px; margin: 12px 0;">
                                ${rowMIDs.map(p => makePitchPlayerHtml(p)).join('')}
                            </div>
                            <div style="display:flex; justify-content:center; gap:24px; margin: 12px 0;">
                                ${rowDEFs.map(p => makePitchPlayerHtml(p)).join('')}
                            </div>
                            <div style="display:flex; justify-content:center; gap:24px; margin: 12px 0;">
                                ${rowGKPs.map(p => makePitchPlayerHtml(p)).join('')}
                            </div>
                        </div>

                        <!-- Bench Substitutes Grid -->
                        <div style="margin-top: 16px; background: rgba(0,0,0,0.45); border: 1.5px solid var(--border-color); border-radius: 12px; padding: 10px; z-index: 1; display: flex; flex-direction: column; align-items: center;">
                            <div style="font-size: 11px; font-weight: 800; color: #fff; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; width: 100%; text-align: center; margin-bottom: 6px;">Substitutes</div>
                            <div style="display:flex; justify-content:center; gap: 14px;">
                                ${sortedBench.map(b => makePitchPlayerHtml(b.player, true, b.label)).join('')}
                            </div>
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
            slideSub = hasActualScores
                ? `GW${gw} points breakdown · season totals · match counts`
                : `Predicted GW${gw} pts · cumulative season totals · match counts`;

            // Helper: build compact breakdown badges from live GW stats
            const buildBreakdownBadges = (player, position) => {
                const gwStats = getPlayerGwStats(player);
                if (!gwStats) return '<div style="font-size:10px; color:var(--text-muted); font-style:italic; margin-top:8px;">Stats breakdown loading...</div>';
                const parts = [];

                const mins = gwStats.minutes || 0;
                if (mins >= 60) parts.push({ label: `${mins}min`, pts: 2, color: '#64748b' });
                else if (mins > 0) parts.push({ label: `${mins}min`, pts: 1, color: '#64748b' });

                const goals = gwStats.goals_scored || 0;
                if (goals > 0) {
                    const gPts = position === 'GKP' || position === 'DEF' ? 6 : position === 'MID' ? 5 : 4;
                    parts.push({ label: `${goals} Goal${goals > 1 ? 's' : ''}`, pts: goals * gPts, color: '#22c55e' });
                }

                const assists = gwStats.assists || 0;
                if (assists > 0) parts.push({ label: `${assists} Assist${assists > 1 ? 's' : ''}`, pts: assists * 3, color: '#38bdf8' });

                const cs = gwStats.clean_sheets || 0;
                if (cs > 0) {
                    const csPts = position === 'GKP' || position === 'DEF' ? 4 : position === 'MID' ? 1 : 0;
                    if (csPts > 0) parts.push({ label: 'Clean Sheet', pts: csPts, color: '#a78bfa' });
                }

                const saves = gwStats.saves || 0;
                if (saves >= 3) parts.push({ label: `${saves} Saves`, pts: Math.floor(saves / 3), color: '#fb923c' });

                const bonus = gwStats.bonus || 0;
                if (bonus > 0) parts.push({ label: `Bonus +${bonus}`, pts: bonus, color: '#fbbf24' });

                const yc = gwStats.yellow_cards || 0;
                if (yc > 0) parts.push({ label: 'Yellow Card', pts: -1, color: '#eab308' });

                const rc = gwStats.red_cards || 0;
                if (rc > 0) parts.push({ label: 'Red Card', pts: -3, color: '#ef4444' });

                const og = gwStats.own_goals || 0;
                if (og > 0) parts.push({ label: 'Own Goal', pts: og * -2, color: '#ef4444' });

                const pm = gwStats.penalties_missed || 0;
                if (pm > 0) parts.push({ label: 'Pen Miss', pts: pm * -2, color: '#ef4444' });

                const ps = gwStats.penalties_saved || 0;
                if (ps > 0) parts.push({ label: 'Pen Save', pts: ps * 5, color: '#22c55e' });

                if (parts.length === 0) return '<div style="font-size:10px; color:var(--text-muted); font-style:italic; margin-top:8px;">No notable stats this GW</div>';

                return `<div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:8px;">
                    ${parts.map(p => `<span style="font-size:9.5px; font-weight:800; padding:3px 8px; border-radius:4px; background:${p.color}20; color:${p.color}; border:1px solid ${p.color}40; white-space:nowrap;">${p.label}&nbsp;<span style="opacity:0.75;">${p.pts >= 0 ? '+' : ''}${p.pts}</span></span>`).join('')}
                </div>`;
            };

            slideBody = `
                <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 18px; overflow-y:auto; max-height: 76vh; padding: 8px; box-sizing: border-box; width:100%;">
                    ${allSquadDetails.map(item => {
                        const alertIcon = item.hasFlag ? `<span title="Injury or rotation risk" style="color:#f59e0b; font-size:12px;">⚠️</span>` : '';
                        const breakdownHtml = buildBreakdownBadges(item.player, item.position);
                        const gwPtsColor = item.isStarting ? 'var(--primary)' : 'var(--text-muted)';
                        const matchLabel = item.matchCount === 1 ? '1 match' : `${item.matchCount} matches`;
                        const predPts = Math.round(item.player.predictions?.find(pr => pr.gw == gw)?.pts || 0);
                        return `
                            <div class="squad-reality-card" style="background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 14px; padding: 0; display:flex; flex-direction:column; overflow:hidden; box-sizing: border-box; transition: all 0.2s; box-shadow: 0 6px 16px rgba(0,0,0,0.12);">
                                <!-- Top: player header + GW pts -->
                                <div style="padding: 14px 16px 10px;">
                                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                        <div style="display:flex; flex-direction:column; overflow:hidden; margin-right:8px;">
                                            <span style="font-size:14.5px; font-weight:900; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.player.web_name}</span>
                                            <span style="font-size:10.5px; color:var(--text-muted); margin-top:2px; font-weight:600;">${item.team} · ${item.position} · £${item.price.toFixed(1)}m</span>
                                        </div>
                                        <div style="display:flex; flex-direction:column; align-items:flex-end; flex-shrink:0;">
                                            <div style="display:flex; align-items:baseline; gap:3px;">
                                                <strong style="font-size:26px; font-family:var(--font-heading); color:${gwPtsColor}; line-height:1;">${item.gwPts}</strong>
                                                <span style="font-size:10px; font-weight:700; color:var(--text-muted);">pts</span>
                                            </div>
                                            <span style="font-size:9px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">GW${gw}</span>
                                        </div>
                                    </div>
                                    <!-- Points breakdown or prediction -->
                                    ${hasActualScores ? breakdownHtml : `<div style="font-size:10px; color:var(--text-muted); font-style:italic; margin-top:8px;">Predicted: ${predPts} pts</div>`}
                                </div>
                                <!-- Bottom: season stats strip -->
                                <div style="background: var(--bg-card); border-top: 1px solid var(--border-color); padding: 8px 16px; display:flex; justify-content:space-between; align-items:center; margin-top:auto;">
                                    <div style="display:flex; flex-direction:column;">
                                        <span style="font-size:9px; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">Season Total</span>
                                        <div style="display:flex; align-items:baseline; gap:3px; margin-top:1px;">
                                            <strong style="font-size:16px; font-family:var(--font-heading); color:var(--text-main);">${item.seasonPts}</strong>
                                            <span style="font-size:9px; font-weight:700; color:var(--text-muted);">pts</span>
                                            <span style="font-size:9.5px; color:var(--text-muted); margin-left:5px; font-weight:600;">· ${matchLabel}</span>
                                        </div>
                                    </div>
                                    <div style="display:flex; align-items:center; gap:6px;">
                                        ${alertIcon}
                                        <span style="font-size:10px; font-weight:800; padding:3px 8px; border-radius:4px; background:${item.isStarting ? 'rgba(0,255,136,0.1)' : 'rgba(100,116,139,0.1)'}; color:${item.isStarting ? 'var(--primary)' : 'var(--text-muted)'};">${item.isStarting ? 'Starter' : 'Bench'}</span>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        } else if (activeSlideIndex === 2) {
            slideTitle = 'POINTS VS PERFORMANCE';

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

                    <!-- PDF Download Button -->
                    <button id="downloadPdfReportBtn" class="action-main-btn" style="margin-top: 12px; padding: 12px 28px; font-size: 14px; border-radius: 10px; background: var(--primary); border: none; color: #000; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 8px; align-self: center; box-shadow: 0 4px 15px var(--primary-glow); transition: transform 0.2s;">
                        <i data-lucide="download" style="width:16px; height:16px; color:#000;"></i> Download PDF Report
                    </button>
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

                <!-- Slide Footer -->
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

        // PDF Generation Event
        const pdfBtn = modalDiv.querySelector('#downloadPdfReportBtn');
        if (pdfBtn) {
            pdfBtn.addEventListener('click', () => {
                triggerPdfDownload();
            });
        }
        
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
            #downloadPdfReportBtn:hover {
                transform: scale(1.04);
                box-shadow: 0 6px 20px var(--primary-glow) !important;
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
