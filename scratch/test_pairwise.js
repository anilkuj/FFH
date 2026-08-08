import { PLAYERS, TEAMS, getPlayerRatings, getPlayerEfficiency } from '../data.js';
import { getFormationConstraints } from '../components/formation.js';

// Setup Mock global variables
global.PLAYERS = PLAYERS;
global.TEAMS = TEAMS;
global.lucide = {
    createIcons: () => {}
};
global.localStorage = {
    getItem: (key) => null,
    setItem: (key, val) => {},
    removeItem: (key) => {}
};
global.window = {
    getPlayerMinutesFactor: () => 1.0
};

// Setup Mock DOM Elements
const listeners = {};
const mockElements = {
    '#gwHorizon': { value: '5', addEventListener: () => {} },
    '#seasonPhase': { value: 'preseason', addEventListener: () => {} },
    '#phaseHelpText': { textContent: '', addEventListener: () => {} },
    '#optimizerFormationSelect': { value: 'optimum', addEventListener: () => {} },
    '#optimizerDraftSelect': { value: '0', addEventListener: () => {} },
    '#mustIncludeSearch': { value: '', addEventListener: () => {} },
    '#mustExcludeSearch': { value: '', addEventListener: () => {} },
    '#mustIncludeOptions': { innerHTML: '', addEventListener: () => {} },
    '#mustExcludeOptions': { innerHTML: '', addEventListener: () => {} },
    '#mustIncludeTags': { innerHTML: '', addEventListener: () => {} },
    '#mustExcludeTags': { innerHTML: '', addEventListener: () => {} },
    '#optSettingsBody': { classList: { add: () => {}, remove: () => {}, contains: () => false }, addEventListener: () => {} },
    '#toggleSettingsBtn': { addEventListener: () => {} },
    '#toggleSettingsChevron': { setAttribute: () => {}, addEventListener: () => {} },
    '#toggleSettingsBtnText': { addEventListener: () => {} },
    '#optActivePills': { style: { display: 'none' }, innerHTML: '', addEventListener: () => {} },
    '#benchBudgetGroup': { style: { display: '' }, addEventListener: () => {} },
    '#benchBudgetRange': { addEventListener: () => {} },
    '#benchBudgetValue': { addEventListener: () => {} },
    '#guaranteedStartRange': { addEventListener: () => {} },
    '#guaranteedStartValue': { addEventListener: () => {} },
    '#minFwdPriceRange': { addEventListener: () => {} },
    '#minFwdPriceValue': { addEventListener: () => {} },
    '#planBenchBoostCheckbox': { addEventListener: () => {} },
    '#benchBoostTargetGwSelect': { addEventListener: () => {} },
    '#prioritizeDefconCheckbox': { addEventListener: () => {} },
    '#ignoreBenchCheckbox': { addEventListener: () => {} },
    '#renameOptDraftBtn': { addEventListener: () => {} },
    '#cloneOptDraftBtn': { addEventListener: () => {} },
    '#saveApiKeyBtn': { addEventListener: () => {} },
    '#geminiApiKey': { value: '', addEventListener: () => {} },
    '#addMustIncludeBtn': { addEventListener: () => {} },
    '#addMustExcludeBtn': { addEventListener: () => {} },
    '#toggleSettingsBtn': { addEventListener: () => {} },
    '#reRunInBodyBtn': {
        addEventListener: (event, handler) => {
            listeners['reRunInBodyBtn_' + event] = handler;
        },
        innerHTML: ''
    },
    '#runOptBtn': {
        addEventListener: (event, handler) => {
            listeners['runOptBtn_' + event] = handler;
        },
        innerHTML: ''
    },
    '#optResultsGrid': {
        classList: { add: () => {}, remove: () => {} },
        innerHTML: '',
        scrollIntoView: () => {},
        querySelector: (sel) => {
            if (sel === '#applyAllPreseasonBtn') {
                return {
                    addEventListener: (event, handler) => {
                        listeners['applyAllPreseasonBtn_' + event] = handler;
                    }
                };
            }
            return {
                innerHTML: '',
                style: {},
                querySelectorAll: () => [],
                addEventListener: () => {},
                querySelector: (subSel) => {
                    return { innerHTML: '', style: {} };
                }
            };
        },
        querySelectorAll: () => []
    }
};

const mockContainer = {
    innerHTML: '',
    querySelector: (selector) => {
        return mockElements[selector] || null;
    },
    querySelectorAll: (selector) => {
        if (selector === '.remove-include-tag' || selector === '.remove-exclude-tag') return [];
        if (selector === '.run-optimization-btn') return [mockElements['#runOptBtn'], mockElements['#reRunInBodyBtn']];
        return [];
    }
};

// Setup Mock State
const mockState = {
    currentGw: 1,
    horizon: 5,
    formation: 'optimum',
    activeDraftIndex: 0,
    tier: 'premium',
    benchBudget: 17.0,
    guaranteedStartChance: 80,
    minFwdPrice: 6.0,
    drafts: [
        {
            name: 'Draft 1',
            squadSlots: []
        }
    ],
    squadSlots: [
        { position: 'GKP', playerId: null, isStarting: false },
        { position: 'GKP', playerId: null, isStarting: false },
        { position: 'DEF', playerId: null, isStarting: false },
        { position: 'DEF', playerId: null, isStarting: false },
        { position: 'DEF', playerId: null, isStarting: false },
        { position: 'DEF', playerId: null, isStarting: false },
        { position: 'DEF', playerId: null, isStarting: false },
        { position: 'MID', playerId: null, isStarting: false },
        { position: 'MID', playerId: null, isStarting: false },
        { position: 'MID', playerId: null, isStarting: false },
        { position: 'MID', playerId: null, isStarting: false },
        { position: 'MID', playerId: null, isStarting: false },
        { position: 'FWD', playerId: null, isStarting: false },
        { position: 'FWD', playerId: null, isStarting: false },
        { position: 'FWD', playerId: null, isStarting: false }
    ],
    transfers: {},
    chips: {
        1: {}, 2: {}, 3: {}, 4: {}, 5: {}
    },
    mustInclude: [],
    mustExclude: [],
    ignoreBench: false,
    saveState: () => {},
    getSquadForGw: (gw) => {
        return {
            starters: [],
            bench: [],
            bank: 100.0,
            squad: []
        };
    },
    optimizeCaptaincy: () => {},
    switchTab: () => {}
};

const mockActions = {
    showToast: () => {},
    syncTopBar: () => {},
    switchTab: () => {}
};

const getSquadPoints = (slots, gwNum, h = 5) => {
    let total = 0;
    for (let gw = gwNum; gw < gwNum + h; gw++) {
        if (gw > 38) break;
        let gwTotal = 0;
        let maxStarterScore = 0;
        slots.forEach(slot => {
            if (slot.playerId === null) return;
            const p = PLAYERS.find(pl => pl.id === slot.playerId);
            if (!p) return;
            const chance = (p.chanceOfPlaying !== undefined && p.chanceOfPlaying !== null) ? (p.chanceOfPlaying / 100) : 1.0;
            const pred = p.predictions.find(pr => pr.gw === gw);
            if (!pred) return;
            const raw = pred._rawPts !== undefined ? pred._rawPts : pred.pts;
            const pts = raw * chance;
            if (slot.isStarting) {
                gwTotal += pts;
                if (pts > maxStarterScore) maxStarterScore = pts;
            } else {
                gwTotal += pts * 0.1;
            }
        });
        gwTotal += maxStarterScore; // Captain
        total += gwTotal;
    }
    return total;
};

// Helper: expected points over horizon
const getExpectedPtsOverHorizon = (player, currentGw, horizon) => {
    if (!player || !player.predictions) return 0;
    let sum = 0;
    for (let gw = currentGw; gw < currentGw + horizon; gw++) {
        const pred = player.predictions.find(pr => pr.gw === gw);
        if (pred) {
            sum += pred.pts;
        }
    }
    return sum;
};

const getSolverScore = (player) => {
    if (!player) return 0;
    if (player.status === 'i' || player.status === 's' || player.status === 'u') return 0;
    return getExpectedPtsOverHorizon(player, 1, 5);
};

// Helper: guaranteed start filter
const isGuaranteedStart = (player) => {
    if (!player) return false;
    if (player.status === 'i' || player.status === 's' || player.status === 'u') return false;
    const chance = player.chanceOfPlaying ?? 100;
    const mppg = player.MPPG ?? 85;
    const gs = player.GS ?? 25;
    if (chance < 75) return false;
    if (mppg < 60 && gs < 15) return false;
    return true;
};

const getCheapestPlayersList = (pos, count, usedIds) => {
    const list = PLAYERS.filter(p => p.position === pos && !usedIds.includes(p.id)).sort((a, b) => a.price - b.price);
    return list.slice(0, count);
};

async function run() {
    const { renderOptimizer } = await import('../components/optimizer.js');
    
    renderOptimizer(mockContainer, mockState, mockActions);
    
    // Trigger solver
    if (listeners['runOptBtn_click']) {
        await listeners['runOptBtn_click']();
    }
    
    setTimeout(() => {
        // Trigger apply all to get the optimized slots loaded into mockState.squadSlots
        if (listeners['applyAllPreseasonBtn_click']) {
            listeners['applyAllPreseasonBtn_click']();
        }
        
        let optimizedSquadSlots = JSON.parse(JSON.stringify(mockState.squadSlots));
        
        // Calculate remaining bank
        const totalValue = 100.0;
        let currentSquadCost = optimizedSquadSlots.reduce((sum, s) => {
            const p = PLAYERS.find(pl => pl.id === s.playerId);
            return sum + (p ? p.price : 0);
        }, 0);
        let bank = totalValue - currentSquadCost;
        
        const originalScore = getSquadPoints(optimizedSquadSlots, 1, 5);
        const originalScoreGw1 = getSquadPoints(optimizedSquadSlots, 1, 1);
        const originalScoreGw2 = getSquadPoints(optimizedSquadSlots, 2, 1);
        
        console.log(`Original 5-GW Cumulative XP: ${originalScore.toFixed(2)}`);
        console.log(`Original GW2 XP: ${originalScoreGw2.toFixed(2)}`);
        console.log(`Remaining bank: £${bank.toFixed(1)}m`);
        
        // Run pairwise double-upgrade step
        console.log('\n--- Running Pairwise Optimization Step ---');
        
        const cons = { GKP: 1, DEF: 3, MID: 5, FWD: 2 }; // Optimum formation selected (3-5-2)
        const startingIndices = [0, 2, 3, 4, 7, 8, 9, 10, 11, 12, 13];
        const benchIndices = [1, 5, 6, 14];
        
        let pairwiseImproved = true;
        let pairwiseIter = 0;
        
        while (pairwiseImproved && pairwiseIter < 3) {
            pairwiseImproved = false;
            pairwiseIter++;
            
            const getEliteCandidates = (pos) => {
                return PLAYERS.filter(p => 
                    p.position === pos &&
                    (isGuaranteedStart(p) || (p.chanceOfPlaying ?? 100) >= 75)
                ).sort((a, b) => getSolverScore(b) - getSolverScore(a))
                 .slice(0, 25);
            };
            
            const elitePools = {
                GKP: getEliteCandidates('GKP'),
                DEF: getEliteCandidates('DEF'),
                MID: getEliteCandidates('MID'),
                FWD: getEliteCandidates('FWD')
            };
            
            // Add cheapest enablers
            for (const pos of ['GKP', 'DEF', 'MID', 'FWD']) {
                const cheapest = getCheapestPlayersList(pos, 5, []);
                cheapest.forEach(p => {
                    if (!elitePools[pos].some(ep => ep.id === p.id)) {
                        elitePools[pos].push(p);
                    }
                });
            }

            for (let i = 0; i < optimizedSquadSlots.length; i++) {
                for (let j = i + 1; j < optimizedSquadSlots.length; j++) {
                    const slotI = optimizedSquadSlots[i];
                    const slotJ = optimizedSquadSlots[j];
                    
                    const pI = PLAYERS.find(p => p.id === slotI.playerId);
                    const pJ = PLAYERS.find(p => p.id === slotJ.playerId);
                    if (!pI || !pJ) continue;
                    
                    const currentPairPts = getSquadPoints(optimizedSquadSlots, 1, 5);
                    const combinedBudget = pI.price + pJ.price + bank;
                    
                    const candsI = elitePools[slotI.position];
                    const candsJ = elitePools[slotJ.position];
                    
                    let bestPair = null;
                    let bestPts = currentPairPts;
                    
                    const currentSquadIds = optimizedSquadSlots.map(s => s.playerId).filter(id => id !== null);
                    const otherSquadIds = currentSquadIds.filter(id => id !== pI.id && id !== pJ.id);
                    
                    for (const candI of candsI) {
                        for (const candJ of candsJ) {
                            if (candI.id === candJ.id && slotI.position === slotJ.position) continue;
                            if (candI.price + candJ.price > combinedBudget + 0.001) continue;
                            
                            if (otherSquadIds.includes(candI.id) || otherSquadIds.includes(candJ.id)) continue;
                            
                            // Team limits
                            const tempSquadIds = [...otherSquadIds, candI.id, candJ.id];
                            const teamCounts = {};
                            let ok = true;
                            for (const id of tempSquadIds) {
                                const pl = PLAYERS.find(p => p.id === id);
                                if (pl) {
                                    teamCounts[pl.team] = (teamCounts[pl.team] || 0) + 1;
                                    if (teamCounts[pl.team] > 3) { ok = false; break; }
                                }
                            }
                            if (!ok) continue;
                            
                            // Price floor
                            const isStarterPriceFloor = (player, pos) => {
                                if (pos === 'GKP' && player.price < 4.5) return false;
                                if (pos === 'DEF' && player.price < 4.5) return false;
                                if (pos === 'FWD' && player.price < 5.5) return false;
                                return true;
                            };
                            
                            if (slotI.isStarting && !isStarterPriceFloor(candI, slotI.position)) continue;
                            if (slotJ.isStarting && !isStarterPriceFloor(candJ, slotJ.position)) continue;
                            if (slotI.isStarting && !isGuaranteedStart(candI)) continue;
                            if (slotJ.isStarting && !isGuaranteedStart(candJ)) continue;
                            
                            const oldI = slotI.playerId;
                            const oldJ = slotJ.playerId;
                            slotI.playerId = candI.id;
                            slotJ.playerId = candJ.id;
                            
                            const newPts = getSquadPoints(optimizedSquadSlots, 1, 5);
                            
                            slotI.playerId = oldI;
                            slotJ.playerId = oldJ;
                            
                            if (newPts > bestPts + 0.15) {
                                bestPts = newPts;
                                bestPair = { candI, candJ };
                            }
                        }
                    }
                    
                    if (bestPair) {
                        console.log(`Pairwise Upgrade: swapped ${pI.name} & ${pJ.name} for ${bestPair.candI.name} & ${bestPair.candJ.name} (Gain: +${(bestPts - currentPairPts).toFixed(2)} XP)`);
                        slotI.playerId = bestPair.candI.id;
                        slotJ.playerId = bestPair.candJ.id;
                        bank = combinedBudget - (bestPair.candI.price + bestPair.candJ.price);
                        pairwiseImproved = true;
                    }
                }
            }
        }
        
        console.log('\n--- Final Squad after Pairwise Step ---');
        optimizedSquadSlots.forEach(s => {
            const p = PLAYERS.find(pl => pl.id === s.playerId);
            console.log(`- ${s.position} (${s.isStarting ? 'Starter' : 'Bench'}): ${p ? p.name : 'Empty'} (£${p ? p.price.toFixed(1) : 0}m)`);
        });
        
        const finalScore = getSquadPoints(optimizedSquadSlots, 1, 5);
        const finalScoreGw1 = getSquadPoints(optimizedSquadSlots, 1, 1);
        const finalScoreGw2 = getSquadPoints(optimizedSquadSlots, 2, 1);
        
        console.log(`\nFinal 5-GW Cumulative XP: ${finalScore.toFixed(2)} (Gain: +${(finalScore - originalScore).toFixed(2)})`);
        console.log(`Final GW1 XP: ${finalScoreGw1.toFixed(2)}`);
        console.log(`Final GW2 XP: ${finalScoreGw2.toFixed(2)} (Gain: +${(finalScoreGw2 - originalScoreGw2).toFixed(2)})`);
    }, 1500);
}

run();
