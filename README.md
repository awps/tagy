## tagy

A general-purpose CLI for creating SemVer git tags. Creates a new git tag, optionally bumps version files, optionally runs custom file replacements, pushes the commit + tag to origin, and optionally creates a GitHub release.

> tagy is language-agnostic: it works in any git repository, not just Node.js projects.

[![NPM](https://nodei.co/npm/tagy.png?compact=true)](https://nodei.co/npm/tagy/)

#### Install globally:
```
npm i tagy -g
```

#### Use it in terminal from working directory:
```
tagy [-p, -m, --minor, --patch, --major, --reverse, --info, --custom, --soft, --auto-release, -h]
```

##### Arguments
```sh
-p, --patch    # Will increase the version from 1.0.0 to 1.0.1
-m, --minor    # Will increase the version from 1.0.0 to 1.1.0
--major        # Will increase the version from 1.0.0 to 2.0.0
--reverse      # Will remove the last tag and revert to previously created one.
--info         # Get some info about current project.
--custom       # Define the new Semantic version manually.
--soft         # File changes only (bump + replace) without touching git or creating a tag.
--auto-release # Automatically create a Github release after the tag is created.
-h             # Show help information.
```

## Configuration: `.tagyrc`

tagy reads configuration from a `.tagyrc` file (JSON) in your project root. All keys are optional.

**Resolution order (first match wins):**

1. `.tagyrc` — primary config file
2. `.tagyrc.json` — alias, identical parsing
3. Legacy `package.json` `tagy` block detected → one-time migration prompt to create `.tagyrc`
4. No config found → **interactive wizard** (asks branch, prefix, files to bump, then offers to save `.tagyrc`)

**Schema:**

```jsonc
{
  "branch": null,           // null = silent on master/main, confirm prompt on any other branch; string = require this exact branch
  "tagPrefix": "",          // e.g. "v" → tag "v1.2.3"; file versions written unprefixed
  "bump": [],               // structural version bumps: ["package.json", "composer.json"]
  "replace": [],            // regex replacement rules (see below)
  "autoRelease": false      // create GitHub release without prompting
}
```

**Supported `bump` files:** `package.json` and `composer.json` (JSON manifests with a `.version` field). For other files (e.g. `Cargo.toml`, `VERSION`, CSS headers), use `replace` rules instead.

**Default behavior (no/minimal config):** tagy verifies it is inside a git repo, then tags and pushes. It touches **no files** unless `bump` or `replace` are configured.

### `replace` rules

Each rule is an object with:

```jsonc
{
  "files": "path/to/file",          // string or array of strings, relative to project root
  "from": "Version: \\d+\\.\\d+\\.\\d+",  // regex pattern (special chars must be escaped)
  "to": "Version: __VERSION__",     // replacement string
  "flags": "g"                      // optional regex flags (default: "g")
}
```

The `from` and `to` values support two placeholders:
- `__VERSION__` — replaced with the new version (unprefixed)
- `__CURRENT_TAG__` — replaced with the current git tag (with prefix)

**Example `.tagyrc`:**

```json
{
  "tagPrefix": "v",
  "bump": ["package.json"],
  "replace": [
    {
      "files": "themes/custom/style.css",
      "from": "Version: \\d+\\.\\d+\\.\\d+",
      "to": "Version: __VERSION__",
      "flags": "g"
    }
  ],
  "autoRelease": false
}
```

### Interactive wizard

When no `.tagyrc` is found, tagy runs an interactive wizard that asks:

1. Confirm the current branch
2. Tag prefix (blank for none)
3. Which known version file(s) to bump (only shows files that exist in your project)
4. Whether to save answers to `.tagyrc` for next time

Replace rules are not asked in the wizard (advanced feature — edit `.tagyrc` by hand).

### Legacy migration

If your project has a `tagy` block in `package.json` (v1 config), tagy will detect it on first run and offer to create a `.tagyrc` from it automatically. The migrator maps:

| `package.json.tagy` | `.tagyrc` |
|---|---|
| `tagPrefix` | `tagPrefix` |
| `replace` | `replace` (unchanged) |
| `auto-release` | `autoRelease` |
| `soft` / `method: "soft"` | dropped (use `--soft` flag instead) |
| (implicit package.json bump) | `bump: ["package.json"]` |

## Extend it: `tagy.js` hook

Create a `tagy.js` file in your project root and export a function. It runs just before `git push`, after all file bumps and replacements.

```js
module.exports = (newVersion, oldVersion, args) => {
    console.log('Custom scripts before git push');
}
```

## Breaking changes from v1

1. Config moved from `package.json.tagy` to `.tagyrc` (one-time migration offered on first run).
2. `package.json` version bump is no longer automatic — add `"bump": ["package.json"]` to your `.tagyrc`.
3. `tagy.soft` / `method: "soft"` config keys removed; use the `--soft` CLI flag.
4. Published artifact is compiled `dist/` output (TypeScript source not included).
