import path from 'path'
import fs from 'fs-extra'
import { buildReplaceConfig, replaceInFiles } from './lib'
import type { ReplaceRule, TagyConfig } from './types'

export const KNOWN_BUMP_FILES = ['package.json', 'composer.json'] as const

export function bumpJsonVersion(absFile: string, version: string, fsModule: typeof fs = fs): boolean {
  if (!fsModule.existsSync(absFile)) return false
  let content: any
  try {
    content = JSON.parse(fsModule.readFileSync(absFile, 'utf8'))
  } catch {
    throw new Error(`Couldn't parse "${absFile}"`)
  }
  content.version = version
  fsModule.writeFileSync(absFile, JSON.stringify(content, null, 2) + '\n')
  return true
}

export function bumpFiles(
  names: string[],
  version: string,
  { cwd, fs: fsModule = fs }: { cwd: string; fs?: typeof fs },
): string[] {
  const bumped: string[] = []
  names.forEach((name) => {
    if (!(KNOWN_BUMP_FILES as readonly string[]).includes(name)) return
    if (bumpJsonVersion(path.resolve(cwd, name), version, fsModule)) bumped.push(name)
  })
  return bumped
}

export function applyReplaceRules(
  rules: ReplaceRule[],
  { version, currentTag, cwd, fs: fsModule = fs }:
    { version: string; currentTag: string; cwd: string; fs?: typeof fs },
): void {
  rules.forEach((rule) => {
    const conf = buildReplaceConfig(rule, { version, currentTag, cwd })
    if (conf) replaceInFiles(conf, fsModule)
  })
}

export function writeConfig(
  config: TagyConfig,
  { cwd, fs: fsModule = fs }: { cwd: string; fs?: typeof fs },
): void {
  fsModule.writeFileSync(path.resolve(cwd, '.tagyrc'), JSON.stringify(config, null, 2) + '\n')
}
