import test from 'node:test';
import assert from 'node:assert/strict';
import { getNextUnplayedGw, getLatestFinishedGw } from '../lib/gwStatus.js';

function fixture(event, finished) {
    return { event, finished, team_h: 1, team_a: 2 };
}

test('getNextUnplayedGw: first gw with any unfinished fixture', () => {
    const fixtures = [
        fixture(1, true), fixture(1, true),
        fixture(2, true), fixture(2, false),
        fixture(3, false)
    ];
    assert.equal(getNextUnplayedGw(fixtures), 2);
});

test('getNextUnplayedGw: null when every known gw is finished', () => {
    const fixtures = [fixture(1, true), fixture(2, true)];
    assert.equal(getNextUnplayedGw(fixtures), null);
});

test('getLatestFinishedGw: highest gw where every fixture finished, skipping a partially-finished later gw', () => {
    const fixtures = [
        fixture(1, true), fixture(1, true),
        fixture(2, true), fixture(2, true),
        fixture(3, true), fixture(3, false) // gw3 postponed fixture -> not finished
    ];
    assert.equal(getLatestFinishedGw(fixtures), 2);
});

test('getLatestFinishedGw: null when nothing has finished yet', () => {
    const fixtures = [fixture(1, false)];
    assert.equal(getLatestFinishedGw(fixtures), null);
});
