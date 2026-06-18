import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { tmpdir } from 'node:os'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { runWizard, existingBumpFiles } from '../src/wizard'

// scripted prompts: returns answers in order
function scripted(answers: any[]) {
  let i = 0
  return async () => ({ value: answers[i++] })
}

let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'tagy-wiz-')) })
afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

describe('existingBumpFiles', () => {
  it('lists only known files that exist', () => {
    writeFileSync(join(dir, 'package.json'), '{}')
    expect(existingBumpFiles(dir)).toEqual(['package.json'])
  })
})

describe('runWizard', () => {
  it('returns null when user declines to tag the branch', async () => {
    const result = await runWizard({ cwd: dir, branch: 'feature', promptsLib: scripted([false]) as any })
    expect(result).toBeNull()
  })

  it('builds config from answers and save decision', async () => {
    writeFileSync(join(dir, 'package.json'), '{}')
    // answers: confirm branch=true, prefix='v', bump=['package.json'], save=true
    const result = await runWizard({ cwd: dir, branch: 'main', promptsLib: scripted([true, 'v', ['package.json'], true]) as any })
    expect(result).toEqual({
      config: { branch: null, tagPrefix: 'v', bump: ['package.json'], replace: [], autoRelease: false },
      save: true,
    })
  })

  it('skips bump question when no known files exist', async () => {
    // answers: confirm=true, prefix='', save=false  (no bump prompt)
    const result = await runWizard({ cwd: dir, branch: 'main', promptsLib: scripted([true, '', false]) as any })
    expect(result).toEqual({
      config: { branch: null, tagPrefix: '', bump: [], replace: [], autoRelease: false },
      save: false,
    })
  })

  it('skipBranchConfirm: true skips branch prompt, still returns valid config', async () => {
    writeFileSync(join(dir, 'package.json'), '{}')
    // First scripted answer would decline branch (false), but it is never consumed.
    // With skipBranchConfirm=true, prompts start at prefix='v', bump=['package.json'], save=true
    const result = await runWizard({
      cwd: dir, branch: 'feature', skipBranchConfirm: true,
      promptsLib: scripted(['v', ['package.json'], true]) as any,
    })
    expect(result).not.toBeNull()
    expect(result!.config).toEqual({ branch: null, tagPrefix: 'v', bump: ['package.json'], replace: [], autoRelease: false })
    expect(result!.save).toBe(true)
  })
})
