import { PLAYERS, TEAMS } from '../data.js';
import { getFormationConstraints } from '../components/formation.js';

// Mock global variables that optimizer.js expects
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

// Setup Mock DOM Element for container
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
        scrollIntoView: () => {
            console.log('[Mock DOM] scrollIntoView called');
        },
        querySelector: (sel) => {
            return {
                innerHTML: '',
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
    tier: 'premium', // Unlocked
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
        { position: 'GKP', playerId: 1, isStarting: true }, // David Raya
        { position: 'GKP', playerId: 2, isStarting: false },
        { position: 'DEF', playerId: 3, isStarting: true },
        { position: 'DEF', playerId: 4, isStarting: true },
        { position: 'DEF', playerId: 5, isStarting: true },
        { position: 'DEF', playerId: 6, isStarting: false },
        { position: 'DEF', playerId: 7, isStarting: false },
        { position: 'MID', playerId: 8, isStarting: true },
        { position: 'MID', playerId: 9, isStarting: true },
        { position: 'MID', playerId: 10, isStarting: true },
        { position: 'MID', playerId: 11, isStarting: true },
        { position: 'MID', playerId: 12, isStarting: false },
        { position: 'FWD', playerId: 13, isStarting: true },
        { position: 'FWD', playerId: 14, isStarting: true },
        { position: 'FWD', playerId: 15, isStarting: false }
    ],
    transfers: {},
    chips: {
        1: {}
    },
    mustInclude: [],
    mustExclude: [],
    ignoreBench: false,
    saveState: () => {
        console.log('[Mock State] saveState called');
    },
    getSquadForGw: (gw) => {
        return {
            starters: [1, 3, 4, 5, 8, 9, 10, 11, 13, 14],
            bench: [2, 6, 7, 12, 15],
            bank: 0.5,
            squad: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
        };
    },
    optimizeCaptaincy: () => {
        console.log('[Mock State] optimizeCaptaincy called');
    }
};

const mockActions = {
    showToast: (msg, type) => {
        console.log(`[Mock Actions] Toast: ${msg} (${type})`);
    },
    syncTopBar: () => {
        console.log('[Mock Actions] syncTopBar called');
    }
};

async function run() {
    // Import optimizer dynamically so globals are set first!
    const { renderOptimizer } = await import('../components/optimizer.js');

    console.log('--- Initial Render ---');
    renderOptimizer(mockContainer, mockState, mockActions);

    console.log('--- Triggering 1st Run ---');
    if (listeners['runOptBtn_click']) {
        await listeners['runOptBtn_click']();
    }

    setTimeout(async () => {
        console.log('HTML Length after 1st run:', mockElements['#optResultsGrid'].innerHTML.length);
        
        console.log('--- Triggering 2nd Run ---');
        if (listeners['runOptBtn_click']) {
            await listeners['runOptBtn_click']();
        }

        setTimeout(() => {
            console.log('HTML Length after 2nd run:', mockElements['#optResultsGrid'].innerHTML.length);
            console.log('Done test');
        }, 1500);
    }, 1500);
}

run();
