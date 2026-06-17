# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`tagy` is a globally-installed CLI (`bin: tagy` → `cli.js`) that creates a SemVer git tag, bumps `package.json`, optionally runs custom file replacements, pushes the commit + tag to origin, and optionally creates a GitHub release. It runs against *the user's* current working directory (`process.cwd()`), not against this repo.

## Commands

- Test: `npm test` (Vitest, single run) or `npm run test:watch`. Run one file: `npx vitest run test/lib.test.js`; one case: `npx vitest run -t "nextVersion"`.
- Run locally against another project: `node /Users/awps/Projects/MY/tagy/cli.js --patch` from that project's directory.
- Install for local dev: `npm i -g .` then use `tagy ...` anywhere.
- Releasing tagy itself is done with tagy: `tagy --patch` (see recent commits "Release x.y.z").

There is no build or lint step.

CLI flags: `-p/--patch`, `-m/--minor`, `--major`, `--reverse`, `--info`, `--custom`, `--soft`, `--auto-release`, `-h`.

## Architecture

Code is split between two files (`cli.js` is a 6-line shim that requires and invokes `index.js`):

- **`lib.js`** — pure, side-effect-free helpers, each unit-tested in `test/lib.test.js`: `createColor` (chainable zero-dep chalk replacement; color on for TTY/`FORCE_COLOR`, off for `NO_COLOR`/piped), `replaceInFiles` (zero-dep replace-in-file replacement), `substitute` (`__VERSION__`/`__CURRENT_TAG__`), `buildReplaceConfig`, `resolveIncrement`, `normalizeCurrentVersion`, `nextVersion`, `bumpPackageVersion`. Dependencies (fs, cwd) are passed as args so they're testable. **Prefer adding new logic here** rather than in the IIFE.
- **`index.js`** — the CLI orchestration: one big async IIFE that wires the `lib.js` helpers together with the side-effecting parts (git via `shelljs`, interactive `prompts`, reading the target `package.json`). This shell is not unit-tested.

Execution flow of the `index.js` IIFE:

1. **Arg validation** — rejects too many args or conflicting increment flags (only one of patch/minor/major/reverse/custom/info allowed).
2. **Read `package.json`** from `process.cwd()`; pull the optional `tagy` config block (`tagPrefix`, `soft`, `auto-release`, `replace`).
3. **Soft mode** (`--soft` or `tagy.soft`) — does file replacement only; never touches git. `tagy.method === 'soft'` is the deprecated form.
4. **Determine current version** — in git mode, reads the latest existing tag via `git tag --sort=v:refname | grep '^<prefix>[0-9]' | tail -1`; in soft mode uses `package.json` version. `--info` short-circuits here.
5. **Compute next version** — `semver.inc()` for patch/minor/major, or a prompted custom value. `--major` and `--reverse` require confirmation prompts.
6. **Apply changes** — bump `package.json`; run `tagy.js` hook if present; run `tagy.replace` rules.
7. **Git ops** (non-soft only) — commit, push branch, create tag, push tag, then optionally `gh release create`.

### Key behaviors to preserve

- **External tooling via `shelljs`**: relies on the user having `git` and (for releases) the `gh` CLI on PATH. Branch detection only proceeds on `master`/`main` without a confirmation prompt.
- **`tagPrefix`** is prepended to the git tag and release name (e.g. `v1.2.3`) but the `package.json` version stays unprefixed.
- **Extensibility hooks** run before `git push`:
  - A `tagy.js` file in the target project: `module.exports = (newVersion, oldVersion, args) => {...}`.
  - `tagy.replace[]` rules in `package.json`, each `{files, from, to, flags}`. `from`/`to` support `__VERSION__` (new version) and `__CURRENT_TAG__` placeholders; `from` is compiled to a `RegExp`.
- All user interaction uses `prompts`; all colored output uses `chalk`.