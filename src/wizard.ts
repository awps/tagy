import path from 'path'
import fs from 'fs-extra'
import { KNOWN_BUMP_FILES } from './bump'
import type { TagyConfig } from './types'

type Ask = (question: any) => Promise<{ value: any }>

export interface WizardResult { config: TagyConfig; save: boolean }

export function existingBumpFiles(cwd: string, fsModule: typeof fs = fs): string[] {
  return (KNOWN_BUMP_FILES as readonly string[]).filter((f) => fsModule.existsSync(path.resolve(cwd, f)))
}

export async function runWizard(
  { cwd, branch, promptsLib, fs: fsModule = fs }:
    { cwd: string; branch: string; promptsLib: Ask; fs?: typeof fs },
): Promise<WizardResult | null> {
  const confirmBranch = await promptsLib({
    type: 'confirm', name: 'value',
    message: `You're on branch '${branch}'. Tag this branch?`, initial: true,
  })
  if (!confirmBranch.value) return null

  const prefixAns = await promptsLib({
    type: 'text', name: 'value', message: 'Tag prefix? (blank for none)', initial: '',
  })
  const tagPrefix = String(prefixAns.value || '').trim()

  const choices = existingBumpFiles(cwd, fsModule)
  let bump: string[] = []
  if (choices.length) {
    const bumpAns = await promptsLib({
      type: 'multiselect', name: 'value', message: 'Bump version in a file?',
      choices: choices.map((c) => ({ title: c, value: c })), instructions: false,
    })
    bump = Array.isArray(bumpAns.value) ? bumpAns.value : []
  }

  const config: TagyConfig = { branch, tagPrefix, bump, replace: [], autoRelease: false }

  const saveAns = await promptsLib({
    type: 'confirm', name: 'value',
    message: 'Save these answers to .tagyrc for next time?', initial: true,
  })

  return { config, save: Boolean(saveAns.value) }
}
