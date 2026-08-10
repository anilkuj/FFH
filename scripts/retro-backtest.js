import fs from 'fs';
import { pathToFileURL } from 'url';
import { parseCsv } from '../lib/csv.js';
import { computeBasePPG, computeGwPrediction } from '../lib/predictionModel.js';
import { computeErrorMetrics, bandForPrice, bracketForMinutes } from '../lib/calibration.js';

const BASELINE_SEASON = '2024-25';
const VALIDATION_SEASON = '2025-26';
const RAW_BASE = 'https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/master/data';
const POSITION_MAP = { '1': 'GKP', '2': 'DEF', '3': 'MID', '4': 'FWD' };

export function buildRetroPairs({ baselineRows, validationPlayersRows, validationTeamsRows, validationFixturesRows, validationGwRows }) {
    const baselineByCode = new Map(baselineRows.map(r => [r.code, r]));
    const teamShortById = new Map(validationTeamsRows.map(t => [t.id, t.short_name]));

    // Build each validation team's fixture schedule, same shape the live model uses.
    const fixturesSchedule = {};
    validationTeamsRows.forEach(t => { fixturesSchedule[t.short_name] = []; });
    validationFixturesRows.forEach(f => {
        const gw = parseInt(f.event, 10);
        if (!gw) return;
        const homeShort = teamShortById.get(f.team_h);
        const awayShort = teamShortById.get(f.team_a);
        if (homeShort) fixturesSchedule[homeShort].push({ gw, opp: awayShort, loc: 'H', diff: parseInt(f.team_h_difficulty, 10) });
        if (awayShort) fixturesSchedule[awayShort].push({ gw, opp: homeShort, loc: 'A', diff: parseInt(f.team_a_difficulty, 10) });
    });

    // Real actual points/minutes per validation-season element id per GW.
    const actualsByElementGw = new Map();
    validationGwRows.forEach(row => {
        const key = `${row.element}_${row.GW}`;
        actualsByElementGw.set(key, { actualPts: parseFloat(row.total_points) || 0, minutesPlayed: parseInt(row.minutes, 10) || 0 });
    });

    const pairs = [];

    validationPlayersRows.forEach(vp => {
        const baseline = baselineByCode.get(vp.code);
        const position = POSITION_MAP[vp.element_type];
        const teamShort = teamShortById.get(vp.team);
        const price = (parseInt(vp.now_cost, 10) || 0) / 10;
        if (!position || !teamShort) return;

        const minutes = baseline ? (parseInt(baseline.minutes, 10) || 0) : 0;
        const starts = baseline ? (parseInt(baseline.starts, 10) || 0) : 0;
        const totalPoints = baseline ? (parseInt(baseline.total_points, 10) || 0) : 0;
        const appearances = starts > 0 ? starts : (minutes > 0 ? 1 : 0);
        const isPromotedOrTransfer = minutes === 0;

        const basePPG = computeBasePPG({
            minutes, appearances, totalPoints, position, teamShort, price,
            isPromotedOrTransfer, manualOverridePPG: undefined
        });

        const xG90 = baseline ? (parseFloat(baseline.expected_goals_per_90) || 0) : 0;
        const xA90 = baseline ? (parseFloat(baseline.expected_assists_per_90) || 0) : 0;
        const saves90 = baseline ? (parseFloat(baseline.saves_per_90) || 0) : 0;
        const mppg = appearances > 0 ? minutes / appearances : 0;

        const schedule = fixturesSchedule[teamShort] || [];
        schedule.forEach(fx => {
            const actual = actualsByElementGw.get(`${vp.id}_${fx.gw}`);
            if (!actual) return; // GW not played yet / player not in that GW's data

            const { pts } = computeGwPrediction({
                basePPG, position, xG90, xA90, saves90, mppg, starts,
                chanceOfPlaying: 100,
                fixture: { opp: fx.opp, loc: fx.loc, diff: fx.diff }
            });

            pairs.push({
                position,
                price,
                predictedPts: pts,
                actualPts: actual.actualPts,
                minutesPlayed: actual.minutesPlayed
            });
        });
    });

    return pairs;
}

function buildReport(pairs) {
    const byPosition = {};
    ['GKP', 'DEF', 'MID', 'FWD'].forEach(pos => {
        byPosition[pos] = computeErrorMetrics(pairs.filter(p => p.position === pos));
    });
    const byPriceBand = {};
    ['<5.0', '5.0-7.4', '7.5-9.9', '>=10.0'].forEach(band => {
        byPriceBand[band] = computeErrorMetrics(pairs.filter(p => bandForPrice(p.price) === band));
    });
    const byMinutesBracket = {};
    ['0', '1-59', '60+'].forEach(bracket => {
        byMinutesBracket[bracket] = computeErrorMetrics(pairs.filter(p => bracketForMinutes(p.minutesPlayed) === bracket));
    });

    return {
        source: 'retro',
        baselineSeason: BASELINE_SEASON,
        validationSeason: VALIDATION_SEASON,
        generatedAt: new Date().toISOString(),
        overall: computeErrorMetrics(pairs),
        byPosition,
        byPriceBand,
        byMinutesBracket
    };
}

async function fetchCsv(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    return parseCsv(await res.text());
}

async function main() {
    console.log(`Fetching baseline season ${BASELINE_SEASON} aggregate...`);
    const baselineRows = await fetchCsv(`${RAW_BASE}/${BASELINE_SEASON}/players_raw.csv`);

    console.log(`Fetching validation season ${VALIDATION_SEASON} players/teams/fixtures/gw data...`);
    const validationPlayersRows = await fetchCsv(`${RAW_BASE}/${VALIDATION_SEASON}/players_raw.csv`);
    const validationTeamsRows = await fetchCsv(`${RAW_BASE}/${VALIDATION_SEASON}/teams.csv`);
    const validationFixturesRows = await fetchCsv(`${RAW_BASE}/${VALIDATION_SEASON}/fixtures.csv`);
    const validationGwRows = await fetchCsv(`${RAW_BASE}/${VALIDATION_SEASON}/gws/merged_gw.csv`);

    console.log('Building predicted-vs-actual pairs...');
    const pairs = buildRetroPairs({ baselineRows, validationPlayersRows, validationTeamsRows, validationFixturesRows, validationGwRows });
    console.log(`${pairs.length} predicted-vs-actual player-GW pairs built.`);

    const report = buildReport(pairs);
    fs.writeFileSync('retro_backtest_report.local.json', JSON.stringify(report, null, 2));
    console.log('Wrote retro_backtest_report.local.json');
    console.log('Overall MAE/RMSE:', report.overall);

    const targetUrl = process.env.BACKTEST_API_BASE_URL || 'https://ffh-production.up.railway.app';
    try {
        const postRes = await fetch(`${targetUrl}/api/backtest/retro-report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(report)
        });
        if (postRes.ok) {
            console.log(`Posted retro report to ${targetUrl}/api/backtest/retro-report`);
        } else {
            console.warn(`Failed to post retro report: ${postRes.status}`);
        }
    } catch (err) {
        console.warn('Could not reach backtest server to store retro report (saved locally only):', err.message);
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch(err => {
        console.error('Retro backtest failed:', err);
        process.exit(1);
    });
}
