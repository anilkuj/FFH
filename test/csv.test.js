import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../lib/csv.js';

test('parseCsv: handles quoted fields with embedded commas and escaped quotes', () => {
    const csv = 'a,b,c\n1,"hello, world",3\n4,"say ""hi""",6\n';
    const rows = parseCsv(csv);
    assert.deepEqual(rows, [
        { a: '1', b: 'hello, world', c: '3' },
        { a: '4', b: 'say "hi"', c: '6' }
    ]);
});

test('parseCsv: works without a trailing newline', () => {
    const csv = 'x,y\n1,2';
    assert.deepEqual(parseCsv(csv), [{ x: '1', y: '2' }]);
});

test('parseCsv: empty input returns no rows', () => {
    assert.deepEqual(parseCsv(''), []);
});
