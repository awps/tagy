import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { tmpdir } from 'node:os'
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  createColor, substitute, buildReplaceConfig, replaceInFiles,
  resolveIncrement, normalizeCurrentVersion, nextVersion,
} from '../src/lib'

describe('createColor', () => {
  it('emits ANSI when FORCE_COLOR set', () => {
    expect(createColor({ isTTY: false, env: { FORCE_COLOR: '1' } }).blue('Y')).toBe('\x1b[34mY\x1b[39m')
  })
  it('nests red.bold', () => {
    expect(createColor({ isTTY: true, env: {} }).red.bold('X')).toBe('\x1b[1m\x1b[31mX\x1b[39m\x1b[22m')
  })
  it('plain text when NO_COLOR set', () => {
    expect(createColor({ isTTY: true, env: { NO_COLOR: '1' } }).red.bold('X')).toBe('X')
  })
  it('plain text for non-TTY', () => {
    expect(createColor({ isTTY: false, env: {} }).yellow('W')).toBe('W')
  })
})

describe('substitute', () => {
  it('replaces both placeholders, all occurrences', () => {
    expect(substitute('__VERSION__ __CURRENT_TAG__ __VERSION__', { version: '1.2.4', currentTag: '1.2.3' }))
      .toBe('1.2.4 1.2.3 1.2.4')
  })
})

describe('resolveIncrement', () => {
  it('maps flags with patch>minor>major priority', () => {
    expect(resolveIncrement({ patch: true })).toBe('patch')
    expect(resolveIncrement({ m: true })).toBe('minor')
    expect(resolveIncrement({ major: true })).toBe('major')
    expect(resolveIncrement({ p: true, major: true })).toBe('patch')
    expect(resolveIncrement({})).toBeNull()
  })
})

describe('normalizeCurrentVersion', () => {
  it('defaults and trims', () => {
    expect(normalizeCurrentVersion(undefined)).toBe('0.0.0')
    expect(normalizeCurrentVersion('   ')).toBe('0.0.0')
    expect(normalizeCurrentVersion('1.2.3\n')).toBe('1.2.3')
  })
})

describe('nextVersion', () => {
  it('bumps', () => {
    expect(nextVersion('1.2.3', 'patch')).toBe('1.2.4')
    expect(nextVersion('1.2.3', 'minor')).toBe('1.3.0')
    expect(nextVersion('1.9.9', 'major')).toBe('2.0.0')
  })
})

describe('buildReplaceConfig', () => {
  const ctx = { version: '1.2.4', currentTag: '1.2.3', cwd: '/proj' }
  it('returns null when incomplete', () => {
    expect(buildReplaceConfig({ from: 'a', to: 'b' } as any, ctx)).toBeNull()
  })
  it('resolves files, substitutes, defaults global flag', () => {
    const c = buildReplaceConfig({ files: 'f', from: 'V __CURRENT_TAG__', to: 'V __VERSION__' }, ctx)!
    expect(c.files).toEqual([resolve('/proj/f')])
    expect(c.from.flags).toBe('g')
    expect(c.from.test('V 1.2.3')).toBe(true)
    expect(c.to).toBe('V 1.2.4')
  })
  it('flags:false -> no flags', () => {
    expect(buildReplaceConfig({ files: 'f', from: 'a', to: 'b', flags: false }, ctx)!.from.flags).toBe('')
  })
})

describe('replaceInFiles', () => {
  let dir: string
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'tagy-')) })
  afterEach(() => { rmSync(dir, { recursive: true, force: true }) })
  it('replaces all matches', () => {
    const f = join(dir, 's.css'); writeFileSync(f, 'V 1.2.3\nV 1.2.3\n')
    replaceInFiles({ files: [f], from: /V \d+\.\d+\.\d+/g, to: 'V 1.2.4' })
    expect(readFileSync(f, 'utf8')).toBe('V 1.2.4\nV 1.2.4\n')
  })
  it('skips missing files', () => {
    const f = join(dir, 'no.txt')
    expect(() => replaceInFiles({ files: [f], from: /x/g, to: 'y' })).not.toThrow()
    expect(existsSync(f)).toBe(false)
  })
})
