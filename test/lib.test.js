import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import {tmpdir} from 'node:os'
import {mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync} from 'node:fs'
import {join, resolve} from 'node:path'

import {
    createColor,
    replaceInFiles,
    substitute,
    buildReplaceConfig,
    resolveIncrement,
    normalizeCurrentVersion,
    nextVersion,
    bumpPackageVersion,
} from '../lib.js'

describe('createColor', () => {
    it('emits ANSI codes when FORCE_COLOR is set', () => {
        const c = createColor({isTTY: false, env: {FORCE_COLOR: '1'}})
        expect(c.blue('Y')).toBe('\x1b[34mY\x1b[39m')
    })

    it('nests chained styles (red.bold) correctly', () => {
        const c = createColor({isTTY: true, env: {}})
        expect(c.red.bold('X')).toBe('\x1b[1m\x1b[31mX\x1b[39m\x1b[22m')
    })

    it('emits codes for a TTY with no env overrides', () => {
        const c = createColor({isTTY: true, env: {}})
        expect(c.green('Z')).toBe('\x1b[32mZ\x1b[39m')
    })

    it('returns plain text when NO_COLOR is set (even on a TTY)', () => {
        const c = createColor({isTTY: true, env: {NO_COLOR: '1'}})
        expect(c.red.bold('X')).toBe('X')
    })

    it('returns plain text for non-TTY output (piped) with no env', () => {
        const c = createColor({isTTY: false, env: {}})
        expect(c.yellow('W')).toBe('W')
    })

    it('NO_COLOR wins over FORCE_COLOR', () => {
        const c = createColor({isTTY: true, env: {NO_COLOR: '', FORCE_COLOR: '1'}})
        expect(c.blue('Y')).toBe('Y')
    })

    it('coerces non-string input to a string', () => {
        const c = createColor({isTTY: false, env: {}})
        expect(c.red(42)).toBe('42')
    })
})

describe('substitute', () => {
    it('replaces __VERSION__ and __CURRENT_TAG__ (all occurrences)', () => {
        expect(substitute('v __VERSION__ / __CURRENT_TAG__ / __VERSION__', {version: '1.2.4', currentTag: '1.2.3'}))
            .toBe('v 1.2.4 / 1.2.3 / 1.2.4')
    })

    it('coerces non-string values', () => {
        expect(substitute(123, {version: '1.0.0', currentTag: '0.9.0'})).toBe('123')
    })
})

describe('resolveIncrement', () => {
    it('maps -p / --patch to patch', () => {
        expect(resolveIncrement({p: true})).toBe('patch')
        expect(resolveIncrement({patch: true})).toBe('patch')
    })

    it('maps -m / --minor to minor', () => {
        expect(resolveIncrement({m: true})).toBe('minor')
        expect(resolveIncrement({minor: true})).toBe('minor')
    })

    it('maps --major to major', () => {
        expect(resolveIncrement({major: true})).toBe('major')
    })

    it('prioritizes patch over minor over major', () => {
        expect(resolveIncrement({p: true, minor: true, major: true})).toBe('patch')
        expect(resolveIncrement({minor: true, major: true})).toBe('minor')
    })

    it('returns null when no increment flag is present', () => {
        expect(resolveIncrement({info: true})).toBeNull()
        expect(resolveIncrement({})).toBeNull()
    })
})

describe('normalizeCurrentVersion', () => {
    it('defaults missing/empty input to 0.0.0', () => {
        expect(normalizeCurrentVersion(undefined)).toBe('0.0.0')
        expect(normalizeCurrentVersion('')).toBe('0.0.0')
        expect(normalizeCurrentVersion('   ')).toBe('0.0.0')
    })

    it('trims surrounding whitespace/newlines from git output', () => {
        expect(normalizeCurrentVersion('1.2.3\n')).toBe('1.2.3')
        expect(normalizeCurrentVersion('  1.2.3  ')).toBe('1.2.3')
    })

    it('passes through a valid version', () => {
        expect(normalizeCurrentVersion('2.5.1')).toBe('2.5.1')
    })
})

describe('nextVersion', () => {
    it('increments patch/minor/major', () => {
        expect(nextVersion('1.2.3', 'patch')).toBe('1.2.4')
        expect(nextVersion('1.2.3', 'minor')).toBe('1.3.0')
        expect(nextVersion('1.2.3', 'major')).toBe('2.0.0')
    })

    it('resets lower components on a higher bump', () => {
        expect(nextVersion('1.9.9', 'major')).toBe('2.0.0')
        expect(nextVersion('1.9.9', 'minor')).toBe('1.10.0')
    })
})

describe('buildReplaceConfig', () => {
    const ctx = {version: '1.2.4', currentTag: '1.2.3', cwd: '/proj'}

    it('returns null when files/from/to are incomplete', () => {
        expect(buildReplaceConfig({from: 'a', to: 'b'}, ctx)).toBeNull()
        expect(buildReplaceConfig({files: 'x', to: 'b'}, ctx)).toBeNull()
        expect(buildReplaceConfig({files: 'x', from: 'a'}, ctx)).toBeNull()
    })

    it('resolves a single file relative to cwd', () => {
        const conf = buildReplaceConfig({files: 'style.css', from: 'a', to: 'b'}, ctx)
        expect(conf.files).toEqual([resolve('/proj/style.css')])
    })

    it('resolves an array of files', () => {
        const conf = buildReplaceConfig({files: ['a.css', 'b.css'], from: 'x', to: 'y'}, ctx)
        expect(conf.files).toEqual([resolve('/proj/a.css'), resolve('/proj/b.css')])
    })

    it('substitutes placeholders in from (regex) and to', () => {
        const conf = buildReplaceConfig(
            {files: 'f', from: 'Version: __CURRENT_TAG__', to: 'Version: __VERSION__'},
            ctx,
        )
        expect(conf.from).toBeInstanceOf(RegExp)
        expect(conf.from.source).toBe('Version: 1.2.3') // placeholder substituted into the pattern
        expect(conf.from.test('Version: 1.2.3')).toBe(true)
        expect(conf.to).toBe('Version: 1.2.4')
    })

    it('defaults to the global flag', () => {
        const conf = buildReplaceConfig({files: 'f', from: 'a', to: 'b'}, ctx)
        expect(conf.from.flags).toBe('g')
    })

    it('honors a custom flags string', () => {
        const conf = buildReplaceConfig({files: 'f', from: 'a', to: 'b', flags: 'gi'}, ctx)
        expect(conf.from.flags).toBe('gi')
    })

    it('uses no flags when flags is explicitly false', () => {
        const conf = buildReplaceConfig({files: 'f', from: 'a', to: 'b', flags: false}, ctx)
        expect(conf.from.flags).toBe('')
    })
})

describe('replaceInFiles', () => {
    let dir
    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), 'tagy-replace-'))
    })
    afterEach(() => {
        rmSync(dir, {recursive: true, force: true})
    })

    it('replaces all matches with a global regex', () => {
        const file = join(dir, 'style.css')
        writeFileSync(file, 'Version: 1.2.3\nVersion: 1.2.3\nkeep\n')
        replaceInFiles({files: [file], from: /Version: \d+\.\d+\.\d+/g, to: 'Version: 1.2.4'})
        expect(readFileSync(file, 'utf8')).toBe('Version: 1.2.4\nVersion: 1.2.4\nkeep\n')
    })

    it('skips files that do not exist without throwing', () => {
        const missing = join(dir, 'nope.txt')
        expect(() => replaceInFiles({files: [missing], from: /x/g, to: 'y'})).not.toThrow()
        expect(existsSync(missing)).toBe(false)
    })

    it('leaves a file untouched when nothing matches', () => {
        const file = join(dir, 'a.txt')
        writeFileSync(file, 'no match here')
        replaceInFiles({files: [file], from: /zzz/g, to: 'q'})
        expect(readFileSync(file, 'utf8')).toBe('no match here')
    })
})

describe('bumpPackageVersion', () => {
    let dir
    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), 'tagy-bump-'))
    })
    afterEach(() => {
        rmSync(dir, {recursive: true, force: true})
    })

    it('writes the new version and preserves other fields + 2-space indent', async () => {
        const file = join(dir, 'package.json')
        writeFileSync(file, JSON.stringify({name: 'demo', version: '1.0.0', keep: true}, null, 2))
        const result = await bumpPackageVersion('1.0.1', {cwd: dir})
        expect(result).toBe(true)
        const written = readFileSync(file, 'utf8')
        const parsed = JSON.parse(written)
        expect(parsed.version).toBe('1.0.1')
        expect(parsed.name).toBe('demo')
        expect(parsed.keep).toBe(true)
        expect(written).toContain('\n  "name"') // 2-space indentation
    })

    it('resolves true (no-op) when there is no package.json', async () => {
        await expect(bumpPackageVersion('1.0.1', {cwd: dir})).resolves.toBe(true)
    })

    it('throws a friendly error on malformed package.json', async () => {
        writeFileSync(join(dir, 'package.json'), '{ not valid json')
        await expect(bumpPackageVersion('1.0.1', {cwd: dir})).rejects.toThrow('Couldn\'t parse "package.json"')
    })
})
