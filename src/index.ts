import fs from 'fs-extra'
import yargs from 'yargs'
import prompts from 'prompts'
import {
  createColor, resolveIncrement, normalizeCurrentVersion, nextVersion,
} from './lib'
import * as git from './git'
import { bumpFiles, applyReplaceRules, writeConfig } from './bump'
import { loadConfig, migrateLegacy } from './config'
import { runWizard } from './wizard'
import type { TagyConfig } from './types'

export default function (): void {
  void (async () => {
    const args = yargs(process.argv.slice(2)).argv as Record<string, any>
    const chalk = createColor({ isTTY: Boolean(process.stdout && process.stdout.isTTY), env: process.env })
    const cwd = process.cwd()
    const ask = prompts as unknown as (q: any) => Promise<{ value: any }>

    // --- help / no-op ---
    const increment = resolveIncrement(args)
    const hasAction = increment || args.reverse || args.custom || args.info
    if (!hasAction || args.h || args.help) {
      console.log(chalk.blue('Usage: ') + chalk.yellow('tagy [-p|-m|--major|--custom|--reverse|--info|--soft|--auto-release]'))
      return
    }

    // mutually-exclusive increment validation
    const exclusive = ['p', 'm', 'major', 'minor', 'patch', 'reverse', 'custom', 'info']
      .filter((k) => args[k])
    if (exclusive.length > 1) {
      console.log(chalk.red.bold('Too many arguments! Pick one of patch/minor/major/reverse/custom/info.'))
      return
    }

    if (!git.insideRepo()) {
      console.log(chalk.red.bold('Not a git repository.'))
      return
    }

    // Read-only / maintenance commands short-circuit before any config
    // resolution or interactive wizard — they only need the tag prefix.
    if (args.info || args.reverse) {
      const { config: existing } = loadConfig({ cwd })
      const prefix = existing?.tagPrefix || ''
      git.fetchTags()
      const raw = git.latestTag(prefix)

      if (args.info) {
        console.log(raw ? chalk.blue(`Last created tag is: ${raw}`) : chalk.blue('No tags created yet.'))
        return
      }

      // args.reverse
      if (args.soft) { console.log(chalk.red("Can't reverse in soft mode.")); return }
      if (!raw) { console.log(chalk.blue('No tags to delete.')); return }
      const confirmReverse = await ask({ type: 'confirm', name: 'value', message: `Remove tag ${raw.trim()}?`, initial: false })
      if (!confirmReverse.value) { console.log(chalk.red.bold('Aborted!')); return }
      git.deleteTag(raw.trim())
      console.log(chalk.blue(`Tag ${raw.trim()} deleted.`))
      return
    }

    // --- resolve config ---
    const { config: loaded, legacy } = loadConfig({ cwd, warn: (m) => console.log(chalk.yellow(m)) })
    let config: TagyConfig | null = loaded

    if (!config && legacy) {
      const migrate = await ask({
        type: 'confirm', name: 'value',
        message: 'Found legacy tagy config in package.json. Create .tagyrc from it?', initial: true,
      })
      if (migrate.value) {
        config = migrateLegacy(legacy)
        writeConfig(config, { cwd })
        console.log(chalk.green('Created .tagyrc from legacy config.'))
      }
    }

    const branch = git.currentBranch()
    if (!branch) {
      console.log(chalk.red.bold("Can't determine the branch name!"))
      return
    }

    // --- no config at all: wizard ---
    let isSoft = Boolean(args.soft)
    if (!config) {
      const wizard = await runWizard({ cwd, branch, promptsLib: ask })
      if (!wizard) {
        console.log(chalk.red.bold('Aborted! Please switch the branch.'))
        return
      }
      config = wizard.config
      if (wizard.save) {
        writeConfig(config, { cwd })
        console.log(chalk.green('Saved .tagyrc.'))
      }
    } else {
      // config-driven branch check
      if (config.branch) {
        if (branch !== config.branch) {
          console.log(chalk.red.bold(`On '${branch}', but .tagyrc requires '${config.branch}'. Aborted.`))
          return
        }
      } else if (branch !== 'master' && branch !== 'main') {
        const confirmBranch = await ask({
          type: 'confirm', name: 'value',
          message: `Current branch is '${branch}'. Tag this branch?`, initial: false,
        })
        if (!confirmBranch.value) {
          console.log(chalk.red.bold('Aborted! Please switch the branch.'))
          return
        }
      }
    }

    const tagPrefix = config.tagPrefix || ''

    // --- current version from latest tag ---
    if (!isSoft) git.fetchTags()
    let raw = isSoft ? '' : git.latestTag(tagPrefix)

    // --- compute next version ---
    let currentTag: string
    let version: string

    if (args.custom) {
      const prevTag = normalizeCurrentVersion(raw)
      const customVer = await ask({
        type: 'text', name: 'value',
        message: 'Enter a custom version (semver):',
        validate: (val: string) => /^\d+\.\d+\.\d+$/.test(val) ? true : 'Invalid version!',
      })
      if (!customVer.value) { console.log(chalk.red.bold('Aborted!')); return }
      version = customVer.value
      currentTag = prevTag
    } else {
      currentTag = normalizeCurrentVersion(raw)
      if (!increment) { console.log(chalk.red('Something went wrong!')); return }
      version = nextVersion(currentTag, increment)
      if (args.major) {
        const confirmMajor = await ask({
          type: 'confirm', name: 'value',
          message: `Create a major release? ${currentTag} -> ${version}`, initial: false,
        })
        if (!confirmMajor.value) { console.log(chalk.red.bold('Aborted!')); return }
      }
    }

    // --- apply file changes (bump + replace) ---
    const bumped = bumpFiles(config.bump, version, { cwd })
    if (bumped.length) console.log(chalk.green(`Bumped: ${bumped.join(', ')}`))
    if (config.replace.length) applyReplaceRules(config.replace, { version, currentTag, cwd })

    // --- tagy.js hook (before push) ---
    const hookPath = `${cwd}/tagy.js`
    if (fs.existsSync(hookPath)) {
      try {
        const hook = require(hookPath)
        await hook(version, currentTag, args)
      } catch (err) {
        console.error(err)
      }
    }

    if (isSoft) {
      console.log(chalk.green(`Soft: files updated to ${version} (no git changes).`))
      return
    }

    // --- git ops ---
    git.commit(`Release ${tagPrefix}${version}`)
    git.pushBranch(branch)
    git.createTag(`${tagPrefix}${version}`)
    git.pushTag(`${tagPrefix}${version}`)

    // --- optional GitHub release ---
    if (git.ghAvailable()) {
      let releaseIt = config.autoRelease || Boolean(args['auto-release'])
      if (!releaseIt) {
        const ghRelease = await ask({
          type: 'confirm', name: 'value', message: 'Create a GitHub release?', initial: false,
        })
        releaseIt = Boolean(ghRelease.value)
      }
      if (releaseIt) {
        const tag = `${tagPrefix}${version}`
        git.ghReleaseCreate(tag, tag, `Release ${tag}`)
      }
    }

    console.log(chalk.blue(`Tag ${tagPrefix}${version} created!`))
  })()
}
