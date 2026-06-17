import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { tmpdir } from 'node:os'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { normalizeConfig, loadConfig, migrateLegacy } from '../src/config'

let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'tagy-cfg-')) })
afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

describe('normalizeConfig', () => {
  it('fills defaults and coerces types', () => {
    expect(normalizeConfig({})).toEqual({ branch: null, tagPrefix: '', bump: [], replace: [], autoRelease: false })
  })
  it('warns on unknown keys', () => {
    const warnings: string[] = []
    normalizeConfig({ nope: 1 }, (m) => warnings.push(m))
    expect(warnings[0]).toContain('nope')
  })
  it('throws on unsupported bump file', () => {
    expect(() => normalizeConfig({ bump: ['Cargo.toml'] })).toThrow('Cargo.toml')
  })
})

describe('loadConfig', () => {
  it('reads .tagyrc when present', () => {
    writeFileSync(join(dir, '.tagyrc'), JSON.stringify({ tagPrefix: 'v', bump: ['package.json'] }))
    const { config, legacy } = loadConfig({ cwd: dir })
    expect(legacy).toBeNull()
    expect(config).toMatchObject({ tagPrefix: 'v', bump: ['package.json'] })
  })
  it('detects legacy package.json.tagy when no .tagyrc', () => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ version: '1.0.0', tagy: { tagPrefix: 'v' } }))
    const { config, legacy } = loadConfig({ cwd: dir })
    expect(config).toBeNull()
    expect(legacy).toEqual({ tagPrefix: 'v' })
  })
  it('returns nulls when no config anywhere', () => {
    expect(loadConfig({ cwd: dir })).toEqual({ config: null, legacy: null })
  })
})

describe('migrateLegacy', () => {
  it('maps keys and forces package.json bump', () => {
    expect(migrateLegacy({ tagPrefix: 'v', 'auto-release': true, soft: true, replace: [{ files: 'a', from: 'b', to: 'c' }] }))
      .toEqual({ branch: null, tagPrefix: 'v', bump: ['package.json'], replace: [{ files: 'a', from: 'b', to: 'c' }], autoRelease: true })
  })
})
