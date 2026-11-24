const { readFileSync } = require('node:fs');
const path = require('node:path');
// node:assert rather than chai: chai is ESM-only from v5 on, and this file is CommonJS.
const assert = require('node:assert');

const ROOT = path.join(__dirname, '..');

/**
 * `ShuttercontrolAdapterOptions` in src/lib/types.d.ts is what gives `adapter.config` its type.
 * Nothing forces it to stay in step with the `native` defaults in io-package.json, so this test makes
 * a drift a test failure instead of a silent lie in the type system.
 *
 * A key may be intentionally absent from `native` while still being declared - such keys must be
 * marked optional, which is how this test tells "deliberately kept" apart from "forgotten".
 */
describe('Adapter config typing', () => {
    const native = JSON.parse(readFileSync(path.join(ROOT, 'io-package.json'), 'utf8')).native;
    const types = readFileSync(path.join(ROOT, 'src', 'lib', 'types.d.ts'), 'utf8');

    const start = types.indexOf('export interface ShuttercontrolAdapterOptions');
    const body = types.slice(start, types.indexOf('\n}', start));

    const declared = new Map();
    for (const m of body.matchAll(/^ {4}(\w+)(\??):/gm)) {
        declared.set(m[1], { optional: m[2] === '?' });
    }

    it('finds the interface and its members', () => {
        assert.ok(start > -1, 'ShuttercontrolAdapterOptions not found in src/lib/types.d.ts');
        assert.ok(declared.size > 50, `only ${declared.size} members found`);
    });

    it('declares every key from io-package.json native', () => {
        const missing = Object.keys(native).filter(key => !declared.has(key));
        assert.deepStrictEqual(missing, [], `not declared in ShuttercontrolAdapterOptions: ${missing.join(', ')}`);
    });

    it('marks keys that are no longer in native as optional', () => {
        const stale = [...declared.entries()]
            .filter(([key, info]) => !(key in native) && !info.optional)
            .map(([key]) => key);
        assert.deepStrictEqual(stale, [], `declared as required but absent from io-package.json native: ${stale.join(', ')}`);
    });
});

/**
 * Every field of a shutter row in io-package.json must be declared in `ShutterSettings`.
 */
describe('Shutter settings typing', () => {
    const events = JSON.parse(readFileSync(path.join(ROOT, 'io-package.json'), 'utf8')).native.events;
    const types = readFileSync(path.join(ROOT, 'src', 'lib', 'types.d.ts'), 'utf8');

    const start = types.indexOf('export interface ShutterSettings');
    const body = types.slice(start, types.indexOf('\n}', start));
    const declared = new Set([...body.matchAll(/^ {4}(\w+)\??:/gm)].map(m => m[1]));

    it('declares every key of the default shutter', () => {
        const missing = Object.keys(events[0]).filter(key => !declared.has(key));
        assert.deepStrictEqual(missing, [], `not declared in ShutterSettings: ${missing.join(', ')}`);
    });
});
