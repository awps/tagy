'use strict'

// Pure, testable helpers for tagy. The CLI orchestration (git, prompts,
// process I/O) lives in index.js; everything here is side-effect-free or
// takes its dependencies (fs, cwd) as arguments so it can be unit-tested.

const path = require('path')
const fs = require('fs-extra')
const semver = require('semver')

const COLOR_CODES = {
    red: [31, 39],
    green: [32, 39],
    blue: [34, 39],
    yellow: [33, 39],
    bold: [1, 22],
}

// Zero-dependency, cross-platform replacement for `chalk`. Returns a chainable
// object (e.g. `color.red.bold(text)`). Color is enabled when FORCE_COLOR is
// set or the output is a TTY, and disabled when NO_COLOR is set or output is
// piped/non-TTY — matching chalk's behavior.
function createColor({isTTY = false, env = {}} = {}) {
    const supportsColor = (() => {
        if ('NO_COLOR' in env) return false;
        if (env.FORCE_COLOR) return true;
        return Boolean(isTTY);
    })();

    const build = (styles) => {
        const fn = (text) => {
            if (!supportsColor) return String(text);
            return styles.reduce((str, name) => {
                const [open, close] = COLOR_CODES[name];
                return `\x1b[${open}m${str}\x1b[${close}m`;
            }, String(text));
        };

        Object.keys(COLOR_CODES).forEach((name) => {
            Object.defineProperty(fn, name, {
                get: () => build([...styles, name]),
            });
        });

        return fn;
    };

    return build([]);
}

// Zero-dependency replacement for `replace-in-file`. `files` are already
// resolved absolute paths (no glob expansion); `from` is a RegExp and `to` a
// string. Writes back only when the contents actually change.
function replaceInFiles({files, from, to}, fsModule = fs) {
    files.forEach((file) => {
        if (!fsModule.existsSync(file)) return;
        const content = fsModule.readFileSync(file, 'utf8');
        const replaced = content.replace(from, to);
        if (replaced !== content) {
            fsModule.writeFileSync(file, replaced);
        }
    });
}

// Replace the `__VERSION__` and `__CURRENT_TAG__` placeholders in a string.
function substitute(value, {version, currentTag}) {
    return String(value)
        .replaceAll('__CURRENT_TAG__', currentTag)
        .replaceAll('__VERSION__', version);
}

// Turn a single `tagy.replace` rule into a config for replaceInFiles().
// Returns null when the rule is missing any of files/from/to.
function buildReplaceConfig(rule, {version, currentTag, cwd}) {
    const {files, from, to, flags} = rule;

    if (!(files && from && to)) return null;

    const list = Array.isArray(files) ? files : [files];

    return {
        files: list.map((file) => path.resolve(`${cwd}/${file}`)),
        from: new RegExp(substitute(from, {version, currentTag}), flags !== false ? (flags || 'g') : undefined),
        to: substitute(to, {version, currentTag}),
    };
}

// Map yargs args to a semver increment type, or null if none/invalid.
function resolveIncrement(args) {
    if (args.p || args.patch) return 'patch';
    if (args.m || args.minor) return 'minor';
    if (args.major) return 'major';
    return null;
}

// Normalize a raw current version (from a git tag or package.json) to a clean
// semver string, defaulting to '0.0.0' when missing or below it.
function normalizeCurrentVersion(vv) {
    if (!vv) return '0.0.0';
    const trimmed = String(vv).trim();
    if (!trimmed || semver.ltr(trimmed, '0.0.0')) return '0.0.0';
    return trimmed;
}

// Compute the next version for a given increment type.
function nextVersion(current, type) {
    return semver.inc(current, type);
}

// Write a new version into the package.json found in `cwd`. Resolves true when
// there is no package.json (nothing to bump) or after a successful write.
async function bumpPackageVersion(vv, {cwd = process.cwd(), fs: fsModule = fs} = {}) {
    const pkgPath = path.join(cwd, 'package.json');

    if (!fsModule.existsSync(pkgPath)) return true;

    let pkgContent;
    try {
        pkgContent = await fsModule.readJSON(pkgPath);
    } catch (err) {
        throw new Error(`Couldn't parse "package.json"`);
    }

    pkgContent.version = vv;

    try {
        await fsModule.writeJSON(pkgPath, pkgContent, {spaces: 2});
    } catch (err) {
        throw new Error(`Couldn't write to "package.json"`);
    }

    return true;
}

module.exports = {
    COLOR_CODES,
    createColor,
    replaceInFiles,
    substitute,
    buildReplaceConfig,
    resolveIncrement,
    normalizeCurrentVersion,
    nextVersion,
    bumpPackageVersion,
}
