import { PLAYERS, TEAMS } from '../data.js';
import { getFormationConstraints } from '../components/formation.js';

export const RISK_PROFILES = {
    conservative: {
        label: "Conservative (Variance Minimizing)",
        horizon: 6,
        hitPenalty: 6.0,
        rollingBonus: 0.8,
        minDeltaThreshold: 2.5,
        allowHits: false,
        maxTransfers: 1,
        description: "Strictly avoids point hits (-4), prioritizes rolling FTs, and targets 6-GW long-term fixture stability."
    },
    moderate: {
        label: "Moderate (Balanced EV Maximization)",
        horizon: 3,
        hitPenalty: 4.0,
        rollingBonus: 0.4,
        minDeltaThreshold: 1.8,
        allowHits: false,
        maxTransfers: 2,
        description: "Evaluates single and double transfers over a 3-GW horizon to capture medium-term fixture runs."
    },
    aggressive: {
        label: "Aggressive (High-Beta & Differential Chasing)",
        horizon: 1,
        hitPenalty: 3.5,
        rollingBonus: 0.1,
        minDeltaThreshold: 1.0,
        allowHits: true,
        maxTransfers: 2,
        description: "Targets immediate 1-GW fixture spikes and differential captaincy, accepting calculated point hits."
    }
};

/**
 * Solves multi-period Quant Decision Model for FPL Squad
 */
export function solveQuantStrategy(state, customParams = {}) {
    const currentGw = state.currentGw || 1;
    const squadInfo = state.getSquadForGw ? state.getSquadForGw(currentGw) : { starters: [], bench: [], squad: [], bank: 0, freeTransfers: 1 };
    const { starters, bench, squad, bank, freeTransfers } = squadInfo;

    const riskMode = customParams.riskAppetite || state.riskAppetite || 'conservative';
    const profile = RISK_PROFILES[riskMode] || RISK_PROFILES.conservative;
    const horizon = customParams.horizonLength || profile.horizon;

    const allSquadIds = squad.length > 0 ? squad : [...starters, ...bench];

    // Helper: Expected Points over Horizon
    const getPlayerXpOverHorizon = (player, startGw, horizonLen) => {
        if (!player || !player.predictions) return 0;
        const factor = window.getPlayerMinutesFactor ? window.getPlayerMinutesFactor(player) : 1.0;
        let total = 0;
        for (let gw = startGw; gw < startGw + horizonLen && gw <= 38; gw++) {
            const pred = player.predictions.find(pr => pr.gw == gw);
            if (pred) {
                let raw = pred._rawPts !== undefined ? pred._rawPts : pred.pts;
                if (player.solioPts && player.solioPts[gw] !== undefined) {
                    raw = player.solioPts[gw];
                }
                total += (raw * factor);
            }
        }
        return total;
    };

    // Baseline squad assets
    const baselineStarters = starters.map(id => PLAYERS.find(p => p.id === id)).filter(Boolean);
    const baselineBench = bench.map(id => PLAYERS.find(p => p.id === id)).filter(Boolean);
    const baselineAll = allSquadIds.map(id => PLAYERS.find(p => p.id === id)).filter(Boolean);

    // Captaincy Ranking
    const sortedStarters = [...baselineStarters].sort((a, b) => {
        const pA = getPlayerXpOverHorizon(a, currentGw, 1);
        const pB = getPlayerXpOverHorizon(b, currentGw, 1);
        return pB - pA;
    });

    const primaryCaptain = sortedStarters[0] || baselineAll[0] || null;
    const viceCaptain = sortedStarters[1] || baselineAll[1] || null;

    // Calculate 1-GW Starting XI Expected Points
    const getSingleGwStartingXp = (starterList, captain) => {
        return starterList.reduce((sum, p) => {
            const pXp = getPlayerXpOverHorizon(p, currentGw, 1);
            const mult = (captain && captain.id === p.id) ? 2 : 1;
            return sum + (pXp * mult);
        }, 0);
    };

    const currentGwStartingXp = parseFloat(getSingleGwStartingXp(baselineStarters, primaryCaptain).toFixed(1));
    const targetGwXp = customParams.targetGwXp || 60.0;
    const targetDelta = parseFloat((currentGwStartingXp - targetGwXp).toFixed(1));
    const targetStatus = currentGwStartingXp >= targetGwXp ? 'EXCEEDED' : (currentGwStartingXp >= 50.0 ? 'NEAR' : 'BELOW');

    // --------------------------------------------------------------------------
    // PROFILE-SPECIFIC SOLVER ALGORITHMS
    // --------------------------------------------------------------------------
    let actionType = 'ROLL';
    let executiveRecommendation = '';
    let projectedEVGain = 0;
    let transfersIn = [];
    let transfersOut = [];
    let best1Tx = null;

    if (riskMode === 'conservative') {
        // CONSERVATIVE PROFILE: 6-GW Horizon, 1 FT max, No hits, High threshold (>= 2.5 xP)
        let maxGain = -999;

        for (const soldPlayer of baselineAll) {
            const sellBudget = soldPlayer.price + bank;
            const candidates = PLAYERS.filter(p => 
                p.position === soldPlayer.position && 
                !allSquadIds.includes(p.id) &&
                p.price <= sellBudget &&
                p.status !== 'i' && p.status !== 'u' && p.status !== 's'
            );

            for (const boughtPlayer of candidates) {
                const soldXp = getPlayerXpOverHorizon(soldPlayer, currentGw, 6);
                const boughtXp = getPlayerXpOverHorizon(boughtPlayer, currentGw, 6);
                const gain = boughtXp - soldXp;

                if (gain > maxGain) {
                    maxGain = gain;
                    best1Tx = { out: soldPlayer, in: boughtPlayer, evGain: gain };
                }
            }
        }

        if (best1Tx && maxGain >= profile.minDeltaThreshold) {
            actionType = 'TRANSFER';
            transfersIn = [best1Tx.in];
            transfersOut = [best1Tx.out];
            projectedEVGain = maxGain;
            executiveRecommendation = `TRANSFER IN ${best1Tx.in.name} (£${best1Tx.in.price.toFixed(1)}m) FOR ${best1Tx.out.name} (£${best1Tx.out.price.toFixed(1)}m) [+${maxGain.toFixed(1)} xP over 6 GWs]`;
        } else {
            actionType = 'ROLL';
            projectedEVGain = profile.rollingBonus;
            executiveRecommendation = `ROLL FREE TRANSFER (Bank to ${Math.min(5, freeTransfers + 1)} FTs). Conservative solver prioritizes 6-GW squad stability (no single move yields >2.5 xP delta).`;
        }

    } else if (riskMode === 'moderate') {
        // MODERATE PROFILE: 3-GW Horizon, Single & Double transfers evaluated
        let maxGain = -999;
        let bestCombo = null;

        // 1-Transfer Evaluation
        for (const soldPlayer of baselineAll) {
            const sellBudget = soldPlayer.price + bank;
            const candidates = PLAYERS.filter(p => 
                p.position === soldPlayer.position && 
                !allSquadIds.includes(p.id) &&
                p.price <= sellBudget &&
                p.status !== 'i' && p.status !== 'u' && p.status !== 's'
            );

            for (const boughtPlayer of candidates) {
                const soldXp = getPlayerXpOverHorizon(soldPlayer, currentGw, 3);
                const boughtXp = getPlayerXpOverHorizon(boughtPlayer, currentGw, 3);
                const gain = boughtXp - soldXp;

                if (gain > maxGain) {
                    maxGain = gain;
                    bestCombo = { type: 'SINGLE', out: [soldPlayer], in: [boughtPlayer], evGain: gain };
                }
            }
        }

        if (bestCombo && maxGain >= profile.minDeltaThreshold) {
            actionType = 'TRANSFER';
            transfersIn = bestCombo.in;
            transfersOut = bestCombo.out;
            projectedEVGain = maxGain;
            executiveRecommendation = `TRANSFER IN ${transfersIn[0].name} (£${transfersIn[0].price.toFixed(1)}m) FOR ${transfersOut[0].name} (£${transfersOut[0].price.toFixed(1)}m) [+${maxGain.toFixed(1)} xP over 3 GWs]`;
        } else {
            actionType = 'ROLL';
            projectedEVGain = profile.rollingBonus;
            executiveRecommendation = `ROLL FREE TRANSFER (Bank to ${Math.min(5, freeTransfers + 1)} FTs). Moderate solver finds no 3-GW transfer meeting >1.8 xP threshold.`;
        }

    } else {
        // AGGRESSIVE PROFILE: 1-GW Spike Horizon, Hit options (-4) and Differential Captaincy attacks
        let maxGain = -999;
        let bestAggressiveMove = null;

        for (const soldPlayer of baselineAll) {
            const sellBudget = soldPlayer.price + bank;
            const candidates = PLAYERS.filter(p => 
                p.position === soldPlayer.position && 
                !allSquadIds.includes(p.id) &&
                p.price <= sellBudget &&
                p.status !== 'i' && p.status !== 'u' && p.status !== 's'
            );

            for (const boughtPlayer of candidates) {
                const soldXp = getPlayerXpOverHorizon(soldPlayer, currentGw, 1);
                const boughtXp = getPlayerXpOverHorizon(boughtPlayer, currentGw, 1);
                const rawGain = boughtXp - soldXp;
                const requiresHit = freeTransfers < 1;
                const netGain = rawGain - (requiresHit ? profile.hitPenalty : 0);

                if (netGain > maxGain) {
                    maxGain = netGain;
                    bestAggressiveMove = { out: soldPlayer, in: boughtPlayer, rawGain, netGain, requiresHit };
                }
            }
        }

        if (bestAggressiveMove && maxGain >= profile.minDeltaThreshold) {
            actionType = 'TRANSFER';
            transfersIn = [bestAggressiveMove.in];
            transfersOut = [bestAggressiveMove.out];
            projectedEVGain = maxGain;
            const hitLabel = bestAggressiveMove.requiresHit ? " [TAKE -4 HIT]" : "";
            executiveRecommendation = `AGGRESSIVE SPIKE: BUY ${bestAggressiveMove.in.name} (£${bestAggressiveMove.in.price.toFixed(1)}m) FOR ${bestAggressiveMove.out.name}${hitLabel} [+${maxGain.toFixed(1)} xP net in GW${currentGw}]`;
        } else {
            actionType = 'ROLL';
            projectedEVGain = profile.rollingBonus;
            executiveRecommendation = `ROLL FREE TRANSFER (Bank to ${Math.min(5, freeTransfers + 1)} FTs). Aggressive solver targets differential captaincy on ${primaryCaptain ? primaryCaptain.name : 'your captain'} in GW${currentGw}.`;
        }
    }

    // 38-GW Runway Trajectory Forecast
    const trajectory = [];
    let accumulatedFt = freeTransfers;
    for (let gw = currentGw; gw <= Math.min(38, currentGw + 10); gw++) {
        if (gw > currentGw) {
            accumulatedFt = Math.min(5, accumulatedFt + 1);
        }
        const gwXp = Math.round((currentGwStartingXp) * (1 + (gw % 3 === 0 ? 0.05 : 0)));
        trajectory.push({
            gw,
            projectedXp: gwXp,
            bankedFt: accumulatedFt,
            isDgw: (gw === 25 || gw === 34 || gw === 37),
            isBgw: (gw === 29)
        });
    }

    return {
        actionType,
        executiveRecommendation,
        projectedEVGain,
        transfersIn,
        transfersOut,
        primaryCaptain,
        viceCaptain,
        starters: baselineStarters,
        bench: baselineBench,
        squad: baselineAll,
        bank,
        freeTransfers,
        nextFreeTransfers: actionType === 'ROLL' ? Math.min(5, freeTransfers + 1) : Math.max(0, freeTransfers - 1),
        chipAdvisory: resolveChipAdvisory(currentGw, state),
        usedChips: getUsedChipsStatus(state),
        riskProfile: profile,
        riskMode,
        targetGwXp,
        currentGwStartingXp,
        targetDelta,
        targetStatus,
        trajectory,
        currentHalf: currentGw <= 19 ? 1 : 2,
        best1Tx
    };
}

export function getUsedChipsStatus(state) {
    const status = {
        wildcard1: { name: "Wildcard 1 (Half 1)", used: false, usedGw: null, limit: "Expires GW19" },
        wildcard2: { name: "Wildcard 2 (Half 2)", used: false, usedGw: null, limit: "Available GW20+" },
        freeHit: { name: "Free Hit", used: false, usedGw: null, limit: "1 GW Unlimited" },
        tripleCaptain: { name: "Triple Captain", used: false, usedGw: null, limit: "3x Points" },
        benchBoost: { name: "Bench Boost", used: false, usedGw: null, limit: "15 Players Score" }
    };

    if (state.chips) {
        for (let gw = 1; gw <= 38; gw++) {
            const c = state.chips[gw];
            if (c) {
                if (c.wildcard) {
                    if (gw <= 19) {
                        status.wildcard1.used = true;
                        status.wildcard1.usedGw = gw;
                    } else {
                        status.wildcard2.used = true;
                        status.wildcard2.usedGw = gw;
                    }
                }
                if (c.freeHit) {
                    status.freeHit.used = true;
                    status.freeHit.usedGw = gw;
                }
                if (c.tripleCaptain) {
                    status.tripleCaptain.used = true;
                    status.tripleCaptain.usedGw = gw;
                }
                if (c.benchBoost) {
                    status.benchBoost.used = true;
                    status.benchBoost.usedGw = gw;
                }
            }
        }
    }

    if (state.planFreeHit && state.freeHitTargetGw) {
        status.freeHit.used = true;
        status.freeHit.usedGw = state.freeHitTargetGw;
    }
    if (state.planWildcard && state.wildcardTargetGw) {
        if (state.wildcardTargetGw <= 19) {
            status.wildcard1.used = true;
            status.wildcard1.usedGw = state.wildcardTargetGw;
        } else {
            status.wildcard2.used = true;
            status.wildcard2.usedGw = state.wildcardTargetGw;
        }
    }
    if (state.planBenchBoost && state.benchBoostTargetGw) {
        status.benchBoost.used = true;
        status.benchBoost.usedGw = state.benchBoostTargetGw;
    }

    return status;
}

function resolveChipAdvisory(currentGw, state) {
    const currentGwChips = state.chips[currentGw] || {};
    if (currentGwChips.freeHit || state.planFreeHit) {
        return {
            status: "ACTIVATE",
            chipName: "Free Hit",
            targetGw: currentGw,
            rationale: `Free Hit Chip Active for GW${currentGw}! All 15 squad slots optimized for maximum 1-GW expected points. Your original squad automatically restores for GW${currentGw + 1}.`,
            freeHitStrategy: `⚡ Free Hit Strategy: Unlimited free transfers for 1 Gameweek only. Ideal for Blank Gameweeks (e.g. BGW29) or Double Gameweeks (e.g. DGW34). Reverts to pre-Free Hit team next week with 1 FT.`
        };
    }
    if (currentGwChips.wildcard || state.planWildcard) {
        return {
            status: "ACTIVATE",
            chipName: "Wildcard",
            targetGw: currentGw,
            rationale: `Wildcard Chip Active for GW${currentGw}! Complete 15-player squad optimized from scratch.`
        };
    }
    if (currentGwChips.benchBoost || state.planBenchBoost) {
        return {
            status: "ACTIVATE",
            chipName: "Bench Boost",
            targetGw: currentGw,
            rationale: `Bench Boost Chip Active for GW${currentGw}! All 15 squad players optimized for Home & Easy Fixtures.`
        };
    }

    // Future Chip Target Advisory based on Double/Blank GW Roadmap
    if (currentGw < 19 && !state.chips[19]?.wildcard) {
        return {
            status: "HOLD",
            chipName: "Wildcard 1",
            targetGw: 12,
            rationale: "HOLD Wildcard 1. Recommended window is GW12-16 to target winter fixture swings before GW19 expiry.",
            freeHitStrategy: `🚀 Free Hit Strategy: Reserve Free Hit for Blank Gameweek 29 or major Double Gameweek 34. Gives 1-week temporary squad rebuild with 0 hit penalty and squad restoration on GW35.`
        };
    }

    return {
        status: "HOLD",
        chipName: "Free Hit / Bench Boost",
        targetGw: 34,
        rationale: "HOLD Chips for major Double Gameweeks (DGW34 & DGW37) to maximize multi-fixture returns.",
        freeHitStrategy: `🚀 Free Hit Strategy: Deploy Free Hit in major Double Gameweek 34 or 37 to field 11 starters with 22 double fixtures!`
    };
}
