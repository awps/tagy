import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { tmpdir } from 'node:os'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { KNOWN_BUMP_FILES, bumpFiles, applyReplaceRules, writeConfig } from '../src/bump'

let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'tagy-bump-')) })
afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

describe('KNOWN_BUMP_FILES', () => {
  it('contains the two JSON manifests', () => {
    expect([...KNOWN_BUMP_FILES]).toEqual(['package.json', 'composer.json'])
  })
})

describe('bumpFiles', () => {
  it('bumps existing known JSON files, preserves other fields + indent', () => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x', version: '1.0.0' }, null, 2))
    const bumped = bumpFiles(['package.json'], '1.0.1', { cwd: dir })
    expect(bumped).toEqual(['package.json'])
    const out = readFileSync(join(dir, 'package.json'), 'utf8')
    expect(JSON.parse(out)).toMatchObject({ name: 'x', version: '1.0.1' })
    expect(out).toContain('\n  "name"')
  })
  it('skips files that do not exist', () => {
    expect(bumpFiles(['composer.json'], '1.0.1', { cwd: dir })).toEqual([])
  })
  it('ignores unknown file names', () => {
    writeFileSync(join(dir, 'random.json'), '{"version":"1.0.0"}')
    expect(bumpFiles(['random.json'], '2.0.0', { cwd: dir })).toEqual([])
  })
  it('throws a friendly error on malformed JSON', () => {
    writeFileSync(join(dir, 'package.json'), '{ bad json')
    expect(() => bumpFiles(['package.json'], '1.0.1', { cwd: dir })).toThrow("Couldn't parse")
  })
})

describe('applyReplaceRules', () => {
  it('applies regex replacement with placeholders', () => {
    const f = join(dir, 'style.css'); writeFileSync(f, 'Version: 1.2.3\n')
    applyReplaceRules(
      [{ files: 'style.css', from: 'Version: __CURRENT_TAG__', to: 'Version: __VERSION__' }],
      { version: '1.2.4', currentTag: '1.2.3', cwd: dir },
    )
    expect(readFileSync(f, 'utf8')).toBe('Version: 1.2.4\n')
  })
})

describe('writeConfig', () => {
  it('writes .tagyrc as pretty JSON', () => {
    writeConfig({ branch: 'main', tagPrefix: 'v', bump: ['package.json'], replace: [], autoRelease: false }, { cwd: dir })
    const out = readFileSync(join(dir, '.tagyrc'), 'utf8')
    expect(JSON.parse(out)).toEqual({ branch: 'main', tagPrefix: 'v', bump: ['package.json'], replace: [], autoRelease: false })
    expect(out.endsWith('\n')).toBe(true)
  })
})
