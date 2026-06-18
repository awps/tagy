# tagy v2 — Design

**Date:** 2026-06-18
**Status:** Approved (design); pending implementation plan

## Goal

Turn `tagy` from an npm/Node-coupled release tool into a **general-purpose git
tagger** that works in any repository, while keeping **zero runtime
dependencies** as the north star.

Two defining shifts from v1:

1. **No longer tied to `package.json`.** Configuration moves to a standalone
   `.tagyrc` (JSON). The current version comes from git tags, not a manifest.
2. **Safe by default.** With no/minimal config, tagy only verifies it is a git
   repo, then tags + pushes. It touches **no files** unless told to.

The codebase is also **rewritten in TypeScript** (dev-only tooling; nothing
extra ships to consumers).

## Non-goals

- TOML manifest parsing (`Cargo.toml`, `pyproject.toml`) — covered by generic
  `replace` rules, not structural bumpers (avoids a parser dependency).
- Publishing TypeScript type declarations — tagy is a CLI, not an imported
  library.
- A `tagy init` subcommand — the wizard's "save to `.tagyrc`?" prompt covers
  config generation.
- Bundling runtime deps to fake a zero-dep `package.json` — deps stay external
  and visible so they can be removed incrementally over time.

## Architecture

### Language & build

- **TypeScript**, compiled with **plain `tsc`** (one devDep, readable
  un-bundled CommonJS output). No bundler.
- Source in `src/*.ts`, compiled to `dist/`.
- `package.json`: `main` → `dist/index.js`, `bin.tagy` → `dist/cli.js`,
  `files` → `["dist"]`.
- A `prepack` / `prepublishOnly` script runs the build so publishing can never
  ship stale output.
- **Tests** run against `.ts` source directly via Vitest's esbuild transform —
  no pre-build needed for `npm test`.

### Modules (one responsibility each, independently testable)

```
src/cli.ts             # shim -> index (shebang); compiles to dist/cli.js (bin)
src/index.ts           # orchestration ONLY: wire modules, drive CLI flow
src/lib.ts             # pure helpers: createColor, substitute, semver wrappers,
                       #   normalizeCurrentVersion, nextVersion, resolveIncrement,
                       #   buildReplaceConfig, replaceInFiles
src/config.ts          # resolve + parse .tagyrc (JSON), validate/normalize,
                       #   detect legacy package.json.tagy, build migration object
src/wizard.ts          # interactive prompts when no config; returns a normalized
                       #   config object + "save to .tagyrc?" decision
src/bump.ts            # known-file registry (package.json, composer.json,
                       #   structural) + applyReplaceRules + writeConfig (.tagyrc)
src/git.ts             # thin shelljs wrapper: insideRepo, currentBranch,
                       #   latestTag, fetchTags, commit, push, tag, deleteTag,
                       #   ghReleaseCreate, ghAvailable
```

Test files, one per module:

```
test/lib.test.ts
test/config.test.ts
test/wizard.test.ts    # answer-shape -> config; `prompts` injected/mocked
test/bump.test.ts      # JSON bump + replace + writeConfig on temp files
test/git.test.ts       # command-string builders verified; `shell` injected/mocked
```

### Dependency-injection boundary

- `index.ts` never calls `shelljs`/`fs`/`prompts` directly — only through
  `git.ts` / `bump.ts` / `config.ts` / `wizard.ts`. This keeps orchestration
  thin and every unit testable.
- `wizard.ts` and `git.ts` take their side-effecting deps (`prompts`, `shell`)
  as injected arguments (the pattern `lib.ts` already uses for `fs`), so tests
  run without real prompts or real git.
- `bump.ts` owns **all** file writes: manifest bumps, replace rules, and
  writing `.tagyrc` itself.

## Configuration model (`.tagyrc`)

### Resolution order (first match wins)

1. `.tagyrc` (JSON) — primary
2. `.tagyrc.json` — alias, identical parsing
3. No `.tagyrc`, but `package.json` has a legacy `tagy` block → **offer
   migration** (write `.tagyrc` from it, then proceed)
4. Nothing → **interactive wizard**

### Schema (all keys optional; defaults shown)

```jsonc
{
  "branch": null,            // null = confirm current branch; string = required branch
  "tagPrefix": "",           // e.g. "v" -> tag "v1.2.3"; file versions stay unprefixed
  "bump": [],                // structural bumps: ["package.json","composer.json"]
  "replace": [],             // regex rules: { files, from, to, flags }
  "autoRelease": false       // gh release without prompting
}
```

### Validation / normalization (`config.ts`)

- Unknown keys → ignored with a printed warning (forward-compatible).
- `bump` entries not in the known registry → error listing supported files.
- `replace` rules missing `files`/`from`/`to` → skipped (as in v1).
- Produces a single normalized config object. The **wizard produces the same
  shape**, so `index.ts` sees one config regardless of source.

### Legacy migration (one-time, when migrator runs)

| legacy `package.json.tagy` | `.tagyrc` |
|---|---|
| `tagPrefix` | `tagPrefix` |
| `replace` | `replace` (unchanged) |
| `auto-release` | `autoRelease` |
| `soft` / `method: "soft"` | dropped (soft is now a CLI flag only) |
| (implicit `package.json` bump) | `bump: ["package.json"]` (preserves v1 behavior) |

v1 always bumped `package.json`, so the migrator adds it to `bump` to avoid
silently dropping that behavior on upgrade.

## Execution flow

> Refinement adopted during implementation: `--info` and `--reverse` short-circuit *before* config resolution / the wizard — a read-only `--info` must never launch the wizard. They read `tagPrefix` from `.tagyrc` if present, otherwise use no prefix.

### Path 1 — `.tagyrc` present (non-interactive)

```
1. git.insideRepo() else abort
2. branch check:
     - config.branch string -> abort if current != it
     - config.branch null    -> proceed on master/main, else confirm prompt
3. git.fetchTags(); current = latestTag(prefix); next = semver bump (or --custom)
4. --info / --reverse short-circuit here
5. bump.ts: structural bump each existing config.bump file; apply replace rules
6. tagy.js hook (if present) runs here, before git push
7. git: commit -> push branch -> tag -> push tag
8. gh release (autoRelease ? silent : prompt; skip if gh absent)
```

### Path 2 — no `.tagyrc`, legacy `package.json.tagy` found

```
prompt "Found legacy tagy config in package.json. Create .tagyrc from it? (Y/n)"
  Y -> config builds migration object, bump.writeConfig(.tagyrc), continue as Path 1
  n -> fall through to Path 3 (wizard) for this run
```

### Path 3 — no config (interactive wizard)

```
1. git.insideRepo() else abort
2. ask: "You're on branch '<x>'. Tag this branch?"          (no master assumption)
3. ask: "Tag prefix? (blank for none)"                       -> e.g. "v"
4. ask: "Bump a version file? [none | package.json | composer.json]"
        (multi-select from known registry; only offers files that exist)
5. replace rules are NOT asked (advanced; edit .tagyrc by hand)
6. run bump/tag/push using these answers
7. ask: "Save these answers to .tagyrc for next time? (Y/n)" -> bump.writeConfig
```

### Default = nothing destructive

An empty/minimal `.tagyrc` (no `bump`, no `replace`) makes tagy tag + push only —
no file is touched. This is the new zero-config baseline.

## Version & bump mechanics

### Current/next version

- `current` = latest git tag matching `tagPrefix`, prefix stripped.
- normalized via `normalizeCurrentVersion` (defaults to `0.0.0` when no tags).
- `next` = `semver.inc(current, type)` (patch/minor/major) or `--custom` value.
- Tag written = `tagPrefix + next`; file versions written **unprefixed**.

### Structural bumpers (`bump.ts`)

Registry keyed by filename:

```
package.json   -> parse JSON, set .version = next, write (2-space indent)
composer.json  -> parse JSON, set .version = next, write (2-space indent)
```

Only files in `config.bump` are touched, and only **if they exist** (missing →
skip with a notice, never error). The registry is the single extension point
for future JSON manifests.

### Replace rules (`bump.ts`)

Unchanged semantics from v1: `{ files, from, to, flags }`, `from` compiled to a
`RegExp`, `__VERSION__` / `__CURRENT_TAG__` substituted. Reuses the existing
`substitute` / `buildReplaceConfig` / `replaceInFiles` helpers.

### Order of operations

structural bumps → replace rules → `tagy.js` hook → git commit/push/tag. The
hook can react to already-bumped files (same as v1).

## Branch handling

- `config.branch` string → abort if current branch differs (strict, CI-friendly).
- `config.branch` null/absent → silent on `master`/`main`; confirm prompt on any
  other branch (v1 behavior, now the configurable default).
- Wizard path → asks "tag branch '<current>'?" directly.

## Soft mode

`--soft` is **kept, redefined**: apply structural bumps + replace rules, but do
**not** touch git. Only meaningful with `bump`/`replace` configured. Legacy
`tagy.soft` / `method: "soft"` config keys are dropped (CLI flag only).

## GitHub release

After pushing the tag, if `gh` is on PATH: `autoRelease` (config) or
`--auto-release` (flag) → create silently; otherwise prompt. No `gh` → skip
silently. Unchanged from v1.

## CLI surface

```
-p, --patch        increment patch
-m, --minor        increment minor
    --major        increment major (confirm prompt)
    --reverse      delete/revert last tag (confirm prompt)
    --custom       enter version manually
    --info         show latest tag, then exit
    --soft         file changes only, no git
    --auto-release create GitHub release without prompting
-h, --help
```

- No breaking **flag** changes vs v1; mutually-exclusive increment validation
  retained (only one of patch/minor/major/reverse/custom/info).
- All breaking changes are in **config location/format**, not the CLI.

## Breaking changes (v1 → v2)

1. Config no longer read from `package.json.tagy` — moved to `.tagyrc`
   (one-time migrator offered on first run).
2. `package.json` version bump is no longer automatic — it must be listed in
   `bump` (the migrator adds it for upgrading users).
3. `tagy.soft` / `method: "soft"` config keys removed; `--soft` flag remains.
4. Published artifact is compiled `dist/` output (TypeScript source).

## Testing strategy

- One test file per module (`test/*.test.ts`), Vitest.
- `lib`, `config`, `bump` are pure/IO-via-temp-files → direct unit tests.
- `wizard` and `git` tested with injected mock `prompts` / `shell` so no real
  interaction or git commands run.
- `index.ts` orchestration remains the thin, un-unit-tested shell (validated by
  the smoke path / manual release).
- CI: `npm test` on PRs and master across a Node matrix (existing `test.yml`),
  plus a build step in the publish workflow.

## Open follow-ups (out of scope for this spec)

- Removing the remaining runtime deps (`shelljs`, `prompts`, `semver`,
  `fs-extra`, `yargs`) toward true zero-deps — separate effort, eased by the
  module boundaries above.
- Possible future bundling into a single self-contained file once runtime deps
  are gone.
