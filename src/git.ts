import shell from 'shelljs'

export interface Shell {
  exec(command: string, opts?: { silent?: boolean }): { code: number; stdout: string }
}

export const cmd = {
  insideRepo: () => 'git rev-parse --is-inside-work-tree',
  currentBranch: () => "git branch | grep \\* | cut -d ' ' -f2",
  fetchTags: () => 'git fetch --tags',
  latestTag: (prefix: string) => `git tag --sort=v:refname | grep -E '^${prefix}[0-9]' | tail -1`,
  commit: (message: string) => `git commit -a -m "${message}"`,
  pushBranch: (branch: string) => `git push origin ${branch}`,
  createTag: (tag: string) => `git tag ${tag}`,
  pushTag: (tag: string) => `git push origin ${tag}`,
  deleteTag: (tag: string) => `git tag -d ${tag}`,
  pushDeleteTag: (tag: string) => `git push origin :refs/tags/${tag}`,
  ghVersion: () => 'gh --version',
  ghRelease: (tag: string, title: string, notes: string) =>
    `gh release create ${tag} --title "${title}" --notes "${notes}"`,
}

const sh = shell as unknown as Shell

export function insideRepo(s: Shell = sh): boolean {
  return s.exec(cmd.insideRepo(), { silent: true }).code === 0
}
export function currentBranch(s: Shell = sh): string {
  return s.exec(cmd.currentBranch(), { silent: true }).stdout.trim()
}
export function fetchTags(s: Shell = sh): void {
  s.exec(cmd.fetchTags(), { silent: true })
}
export function latestTag(prefix: string, s: Shell = sh): string {
  return s.exec(cmd.latestTag(prefix), { silent: true }).stdout.trim()
}
export function commit(message: string, s: Shell = sh): void {
  s.exec(cmd.commit(message))
}
export function pushBranch(branch: string, s: Shell = sh): void {
  s.exec(cmd.pushBranch(branch))
}
export function createTag(tag: string, s: Shell = sh): void {
  s.exec(cmd.createTag(tag))
}
export function pushTag(tag: string, s: Shell = sh): void {
  s.exec(cmd.pushTag(tag))
}
export function deleteTag(tag: string, s: Shell = sh): void {
  s.exec(cmd.deleteTag(tag))
  s.exec(cmd.pushDeleteTag(tag))
}
export function ghAvailable(s: Shell = sh): boolean {
  return Boolean(s.exec(cmd.ghVersion(), { silent: true }).stdout)
}
export function ghReleaseCreate(tag: string, title: string, notes: string, s: Shell = sh): void {
  s.exec(cmd.ghRelease(tag, title, notes))
}
