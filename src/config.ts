import path from 'path'
import fs from 'fs-extra'
import { KNOWN_BUMP_FILES } from './bump'
import type { TagyConfig, ReplaceRule } from './types'

export const DEFAULT_CONFIG: TagyConfig = {
  branch: null, tagPrefix: '', bump: [], replace: [], autoRelease: false,
}

const KNOWN_KEYS = ['branch', 'tagPrefix', 'bump', 'replace', 'autoRelease']

export function normalizeConfig(
  raw: Record<string, unknown>,
  warn: (msg: string) => void = () => {},
): TagyConfig {
  Object.keys(raw).forEach((k) => {
    if (!KNOWN_KEYS.includes(k)) warn(`Unknown .tagyrc key ignored: "${k}"`)
  })

  const config: TagyConfig = {
    branch: typeof raw.branch === 'string' ? raw.branch : null,
    tagPrefix: typeof raw.tagPrefix === 'string' ? raw.tagPrefix : '',
    bump: Array.isArray(raw.bump) ? (raw.bump as string[]) : [],
    replace: Array.isArray(raw.replace) ? (raw.replace as ReplaceRule[]) : [],
    autoRelease: raw.autoRelease === true,
  }

  config.bump.forEach((file) => {
    if (!(KNOWN_BUMP_FILES as readonly string[]).includes(file)) {
      throw new Error(`Unsupported bump file "${file}". Supported: ${KNOWN_BUMP_FILES.join(', ')}`)
    }
  })

  return config
}

export function loadConfig(
  { cwd, fs: fsModule = fs, warn }: { cwd: string; fs?: typeof fs; warn?: (m: string) => void },
): { config: TagyConfig | null; legacy: Record<string, unknown> | null } {
  for (const name of ['.tagyrc', '.tagyrc.json']) {
    const p = path.resolve(cwd, name)
    if (fsModule.existsSync(p)) {
      const raw = JSON.parse(fsModule.readFileSync(p, 'utf8'))
      return { config: normalizeConfig(raw, warn), legacy: null }
    }
  }

  const pkgPath = path.resolve(cwd, 'package.json')
  if (fsModule.existsSync(pkgPath)) {
    const pkg = JSON.parse(fsModule.readFileSync(pkgPath, 'utf8'))
    if (pkg && pkg.tagy && typeof pkg.tagy === 'object') {
      return { config: null, legacy: pkg.tagy as Record<string, unknown> }
    }
  }

  return { config: null, legacy: null }
}

export function migrateLegacy(legacy: Record<string, unknown>): TagyConfig {
  return {
    branch: null,
    tagPrefix: typeof legacy.tagPrefix === 'string' ? legacy.tagPrefix : '',
    bump: ['package.json'],
    replace: Array.isArray(legacy.replace) ? legacy.replace : [],
    autoRelease: legacy['auto-release'] === true,
  }
}
