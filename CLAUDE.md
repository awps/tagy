# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`tagy` is a globally-installed CLI (`bin: tagy` → `dist/cli.js`) that creates a SemVer git tag, optionally bumps version files, optionally runs custom file replacements, pushes the commit + tag to origin, and optionally creates a GitHub release. It runs against *the user's* current working directory (`process.cwd()`), not against this repo. v2 is language-agnostic and works in any git repository.

## Commands

- Build: `npm run build` (tsc, compiles `src/` → `dist/`). Required before running locally.
- Test: `npm test` (Vitest runs directly against `.ts` source, no build needed) or `npm run test:watch`. Run one file: `npx vitest run test/lib.test.ts`; one case: `npx vitest run -t "nextVersion"`.
- Typecheck: `npx tsc --noEmit` (no output files, just type errors).
- Run locally against another project: `node /Users/awps/Projects/MY/tagy/dist/cli.js --patch` from that project's directory (requires a prior `npm run build`).
- Install for local dev: `npm run build && npm i -g .` then use `tagy ...` anywhere.
- Releasing tagy itself is done with tagy: `tagy --patch` (see recent commits "Release x.y.z").

CLI flags: `-p/--patch`, `-m/--minor`, `--major`, `--reverse`, `--info`, `--custom`, `--soft`, `--auto-release`, `-h`.

## Architecture

The codebase is TypeScript, compiled with plain `tsc`. Source is in `src/*.ts`, compiled to `dist/`. Published artifact is `dist/` only (see `files` in `package.json`). A `prepack` script ensures `dist/` is always built before publishing.

### Modules

- **`src/cli.ts`** — 6-line shim with shebang; requires and invokes `index.ts`. Compiles to `dist/cli.js` (the `bin` entry).
- **`src/index.ts`** — CLI orchestration only: wires the modules together and drives the CLI flow. Not unit-tested (thin shell validated manually).
- **`src/lib.ts`** — pure, side-effect-free helpers: `createColor` (chainable zero-dep chalk replacement), `replaceInFiles` (zero-dep replace-in-file), `substitute` (`__VERSION__`/`__CURRENT_TAG__`), `buildReplaceConfig`, `resolveIncrement`, `normalizeCurrentVersion`, `nextVersion`. Dependencies (fs, cwd) are passed as args so they're testable. **Prefer adding new logic here** rather than in the orchestration IIFE.
- **`src/config.ts`** — resolves and parses `.tagyrc` (JSON), validates/normalizes the schema, detects legacy `package.json.tagy` blocks and builds a migration object. Resolution order: `.tagyrc` → `.tagyrc.json` → legacy `package.json.tagy` (migration) → wizard.
- **`src/wizard.ts`** — interactive prompts when no config exists. Asks: branch confirm, tag prefix, which known files to bump (only shows files that exist), save to `.tagyrc`?. Does NOT ask about replace rules. Returns a normalized config object (same shape as `config.ts` output).
- **`src/bump.ts`** — known-file registry for structural version bumps (`package.json`, `composer.json` only); also handles `applyReplaceRules` and `writeConfig` (writes `.tagyrc`). Owns all file writes.
- **`src/git.ts`** — thin shelljs wrapper: `insideRepo`, `currentBranch`, `latestTag`, `fetchTags`, `commit`, `push`, `tag`, `deleteTag`, `ghReleaseCreate`, `ghAvailable`. Takes `shell` as an injected arg for testability.
- **`src/types.ts`** — shared TypeScript types/interfaces.

### Test files

One test file per module under `test/`: `lib.test.ts`, `config.test.ts`, `wizard.test.ts`, `bump.test.ts`, `git.test.ts`. Total: 39 tests. Vitest runs them directly against `.ts` source via its esbuild transform.

## Configuration model (`.tagyrc`)

Config is a standalone `.tagyrc` JSON file. Schema keys (all optional):

```jsonc
{
  "branch": null,         // null = confirm if not master/main; string = require exact branch
  "tagPrefix": "",        // e.g. "v" -> tag "v1.2.3", file versions written unprefixed
  "bump": [],             // structural bumps: ["package.json", "composer.json"] ONLY
  "replace": [],          // regex rules: { files, from, to, flags }
  "autoRelease": false    // gh release without prompting
}
```

**Current version source:** always read from the latest git tag (prefix-aware). File versions are written unprefixed. Default with no/minimal config: verify git repo, tag + push; touch no files.

## Execution flow (`index.ts`)

1. **Arg validation** — rejects too many args or conflicting increment flags.
2. **`--info` / `--reverse` short-circuit here** — read-only/maintenance commands run before config resolution and never launch the wizard. They read the tag prefix from `.tagyrc` if it exists (else none), then `git.fetchTags()` + `git.latestTag(prefix)`. `--info` prints the latest tag; `--reverse` deletes/pushes-deletion of the last tag after a confirm prompt (blocked in `--soft`).
3. **Config resolution** — `.tagyrc` / `.tagyrc.json` / legacy migration / wizard.
4. **Branch check** — abort if wrong branch (strict mode), or confirm prompt on non-master/main.
5. **Determine current version** — `git.latestTag(prefix)`, normalize via `normalizeCurrentVersion`.
6. **Compute next version** — `semver.inc()` for patch/minor/major (`--major` requires a confirmation prompt); `--custom` prompts for a value.
7. **Apply changes** — structural bumps (`bump.ts`); replace rules; `tagy.js` hook (if present).
8. **Git ops** (non-soft only) — commit, push branch, create tag, push tag; `gh release create` (if `autoRelease` or prompted).

### Key behaviors to preserve

- **Soft mode** (`--soft`): apply bumps + replace rules only; never touches git. Config `soft`/`method:"soft"` keys are removed in v2 (CLI flag only).
- **`tagPrefix`** is prepended to the git tag and release name; file versions stay unprefixed.
- **`tagy.js` hook** in the target project runs before `git push`: `module.exports = (newVersion, oldVersion, args) => {...}`.
- **`replace` rules** `from`/`to` support `__VERSION__` and `__CURRENT_TAG__` placeholders; `from` is compiled to a `RegExp`.
- **Supported `bump` files**: `package.json` and `composer.json` only. Other files use `replace` rules.
- **External tooling**: requires `git` on PATH; `gh` on PATH for GitHub releases.
