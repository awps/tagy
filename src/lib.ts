import path from 'path'
import fs from 'fs-extra'
import semver from 'semver'
import type { ReplaceRule } from './types'

const COLOR_CODES = {
  red: [31, 39], green: [32, 39], blue: [34, 39], yellow: [33, 39], bold: [1, 22],
} as const
type StyleName = keyof typeof COLOR_CODES

export type Color = ((text: unknown) => string) & { [K in StyleName]: Color }
export type Increment = 'patch' | 'minor' | 'major'
export interface ReplaceConfig { files: string[]; from: RegExp; to: string }

export function createColor(
  { isTTY = false, env = {} as Record<string, string | undefined> } = {},
): Color {
  const supportsColor = (() => {
    if ('NO_COLOR' in env) return false
    if (env.FORCE_COLOR) return true
    return Boolean(isTTY)
  })()

  const build = (styles: StyleName[]): Color => {
    const fn = ((text: unknown) => {
      if (!supportsColor) return String(text)
      return styles.reduce((str, name) => {
        const [open, close] = COLOR_CODES[name]
        return `\x1b[${open}m${str}\x1b[${close}m`
      }, String(text))
    }) as Color
    ;(Object.keys(COLOR_CODES) as StyleName[]).forEach((name) => {
      Object.defineProperty(fn, name, { get: () => build([...styles, name]) })
    })
    return fn
  }

  return build([])
}

export function substitute(value: unknown, { version, currentTag }: { version: string; currentTag: string }): string {
  return String(value).replaceAll('__CURRENT_TAG__', currentTag).replaceAll('__VERSION__', version)
}

export function buildReplaceConfig(
  rule: ReplaceRule,
  { version, currentTag, cwd }: { version: string; currentTag: string; cwd: string },
): ReplaceConfig | null {
  const { files, from, to, flags } = rule
  if (!(files && from && to)) return null
  const list = Array.isArray(files) ? files : [files]
  return {
    files: list.map((file) => path.resolve(`${cwd}/${file}`)),
    from: new RegExp(substitute(from, { version, currentTag }), flags !== false ? (flags || 'g') : undefined),
    to: substitute(to, { version, currentTag }),
  }
}

export function replaceInFiles({ files, from, to }: ReplaceConfig, fsModule: typeof fs = fs): void {
  files.forEach((file) => {
    if (!fsModule.existsSync(file)) return
    const content = fsModule.readFileSync(file, 'utf8')
    const replaced = content.replace(from, to)
    if (replaced !== content) fsModule.writeFileSync(file, replaced)
  })
}

export function resolveIncrement(args: Record<string, unknown>): Increment | null {
  if (args.p || args.patch) return 'patch'
  if (args.m || args.minor) return 'minor'
  if (args.major) return 'major'
  return null
}

export function normalizeCurrentVersion(vv: unknown): string {
  if (!vv) return '0.0.0'
  const trimmed = String(vv).trim()
  if (!trimmed || semver.ltr(trimmed, '0.0.0')) return '0.0.0'
  return trimmed
}

export function nextVersion(current: string, type: Increment): string {
  return semver.inc(current, type) as string
}
