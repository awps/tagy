import { describe, it, expect } from 'vitest'
import { cmd, insideRepo, currentBranch, latestTag, deleteTag, ghAvailable } from '../src/git'

function fakeShell(result: { code?: number; stdout?: string }) {
  const calls: string[] = []
  return {
    calls,
    exec(c: string) { calls.push(c); return { code: result.code ?? 0, stdout: result.stdout ?? '' } },
  }
}

describe('cmd builders', () => {
  it('latestTag includes the prefix', () => {
    expect(cmd.latestTag('v')).toBe("git tag --sort=v:refname | grep -E '^v[0-9]' | tail -1")
  })
  it('commit/tag/push builders', () => {
    expect(cmd.commit('Release v1.2.3')).toBe('git commit -a -m "Release v1.2.3"')
    expect(cmd.createTag('v1.2.3')).toBe('git tag v1.2.3')
    expect(cmd.pushBranch('main')).toBe('git push origin main')
    expect(cmd.pushDeleteTag('v1.2.3')).toBe('git push origin :refs/tags/v1.2.3')
  })
})

describe('wrappers', () => {
  it('insideRepo true on exit 0', () => {
    expect(insideRepo(fakeShell({ code: 0 }))).toBe(true)
  })
  it('insideRepo false on nonzero', () => {
    expect(insideRepo(fakeShell({ code: 128 }))).toBe(false)
  })
  it('currentBranch trims stdout', () => {
    expect(currentBranch(fakeShell({ stdout: 'main\n' }))).toBe('main')
  })
  it('latestTag trims stdout', () => {
    expect(latestTag('', fakeShell({ stdout: '1.2.3\n' }))).toBe('1.2.3')
  })
  it('deleteTag runs delete then remote-delete', () => {
    const sh = fakeShell({})
    deleteTag('1.2.3', sh)
    expect(sh.calls).toEqual([cmd.deleteTag('1.2.3'), cmd.pushDeleteTag('1.2.3')])
  })
  it('ghAvailable false when stdout empty', () => {
    expect(ghAvailable(fakeShell({ stdout: '' }))).toBe(false)
  })
})
