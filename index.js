#!/usr/bin/env node
'use strict'

const fs = require('fs-extra')
const path = require('path')
const shell = require("shelljs")
const semver = require('semver')
const args = require('yargs').argv
const prompts = require('prompts')
const chalk = require("chalk");
const replace = require("replace-in-file");

const packageVersionBump = async (vv) => {
    const pkgPath = path.join(process.cwd(), 'package.json')

    if (fs.existsSync(pkgPath)) {
        let pkgContent;

        try {
            pkgContent = await fs.readJSON(pkgPath);
        } catch (err) {
            throw new Error(`Couldn't parse "package.json"`)
        }

        pkgContent.version = vv;

        try {
            await fs.writeJSON(pkgPath, pkgContent, {
                spaces: 2
            });
        } catch (err) {
            throw new Error(`Couldn't write to "package.json"`)
        }

        return true;
    }

    return true;
}

module.exports = function () {
    (async () => {
        const totalArguments = Object.values(args).length;

        if (totalArguments > 4) {
            await console.log(chalk.red.bold('Too many arguments!'))
            return;
        }

        const haveOption = (
            args.p ||
            args.m ||
            args.patch ||
            args.minor ||
            args.major ||
            args.reverse ||
            args.custom ||
            args.info
        )

        if (!haveOption || args.h) {
            await console.log(chalk.red.bold(`'Please specify the increment type') [-p, -m, --minor, --patch, --major, --reverse, --custom, --info, --soft]'

Options: 
-p, --patch  # Will increase the version from 1.0.0 to 1.0.1
-m, --minor  # Will increase the version from 1.0.0 to 1.1.0
--major      # Will increase the version from 1.0.0 to 2.0.0
--reverse    # Will remove the last tag and revert to previously created one.
--info       # Get some info about current project.
--custom     # Define the new Semantic version manually.
--soft       # Create a soft tag. This will not commit the changes to git or create a new git tag.
-h, --help   # Show this message.
            `));
            await console.log(chalk.blue('Example: ') + chalk.yellow('tagy --patch'))
            return;
        }

        if (args.m && args.a) {
            await console.log(chalk.red.bold('Did you mean `--major`? Try again!'))
            return;
        }

        if (args.r && args.e) {
            await console.log(chalk.red.bold('Did you mean `--reverse`? Try again!'))
            return;
        }

        // abort if multiple args are passed from this list [p, m, major, minor, patch]
        // if in array then abort
        const multipleArgs = ['p', 'm', 'major', 'minor', 'patch', 'reverse', 'custom', 'info'];
        const multipleArgsPassed = multipleArgs.filter(arg => args[arg]);

        if (multipleArgsPassed.length > 1) {
            await console.log(chalk.red.bold('Too many arguments!'))
            return;
        }

        // read package.json
        const pkgPath = path.join(process.cwd(), 'package.json')

        if (!fs.existsSync(pkgPath)) {
            await console.log(chalk.red.bold('package.json not found. Make sure that you are in the right directory!'))
            return;
        }

        // Get package.json configuration
        let pkgContent;

        try {
            pkgContent = await fs.readJSON(pkgPath);
        } catch (err) {
            throw new Error(`Couldn't parse "package.json"`)
        }

        const tagPrefix = (pkgContent && pkgContent.tagy && pkgContent.tagy.tagPrefix) || '';

        let vv;

        // This will soft create a tag
        // ----------------------------------------------------------------------------
        const isSoft = args.soft || (pkgContent && pkgContent.tagy && (pkgContent.tagy.soft || pkgContent.tagy.method === 'soft'));

        if (pkgContent && pkgContent.tagy && pkgContent.tagy.method === 'soft'){
            console.log(chalk.red(`{"method": "soft"} is deprecated, please use {"soft": true} instead.`))
        }

        if (isSoft) {
            console.log(chalk.green('➡️ Soft Processing!'));
        }

        let branchName;

        // This will create the tag in git
        // ----------------------------------------------------------------------------
        try {
            if (!isSoft) {
                let currentBranchName = shell.exec("git branch | grep \\* | cut -d ' ' -f2", {silent: true}).stdout;

                if (!currentBranchName) {
                    return console.log(chalk.red.bold('Can\'t determine the branch name!'))
                }

                branchName = currentBranchName.trim();

                if (!(branchName === 'master' || branchName === 'main')) {
                    // await console.log(chalk.red.bold('You can create tags only from "master" branch.'))
                    // return;

                    const confirmBranch = await prompts({
                        type: 'confirm',
                        name: 'value',
                        message: `Current branch name is '${branchName}'. Do you want to tag this branch?`,
                        initial: false
                    });

                    if (!confirmBranch.value) {
                        return console.log(chalk.red.bold('Aborted! Please switch the branch.'))
                    }
                }

                shell.exec('git fetch --tags', {silent: true});

                // vv = shell.exec('git tag --sort=v:refname | grep -E \'^[0-9]\' | tail -1', {silent: true}).stdout;
                vv = shell.exec(`git tag --sort=v:refname | grep -E '^${tagPrefix}[0-9]' | tail -1`, {silent: true}).stdout;

                if (args.info) {
                    if (!vv) {
                        await console.log(chalk.blue(`Looks like no tags were created by this moment.`))
                    } else {
                        await console.log(chalk.blue(`Last created tag is: ${vv}`))
                    }

                    return;
                }
            } else {
                vv = pkgContent.version;
            }

            if (args.reverse) {
                if (isSoft) {
                    return console.log(chalk.red(`Can't perform a reverse when the method is soft. Please reverse it manually.`))
                }

                if (!vv) {
                    await console.log(chalk.blue(`Looks like no tags were created by this moment. Nothing to delete.`))
                } else {
                    const confirmReverse = await prompts({
                        type: 'confirm',
                        name: 'value',
                        message: `Are you sure that you want to remove this tag?(${vv.trim()})`,
                        initial: false
                    })

                    if (!confirmReverse.value) {
                        return console.log(chalk.red.bold('Aborted!'))
                    }

                    shell.exec(`git tag -d ${vv}`);
                    shell.exec(`git push origin :refs/tags/${vv}`);

                    await console.log(chalk.blue(`Tag ${vv} --> deleted!.`))
                }

                return;
            }

            let currentTag;

            if (args.custom) {
                const customVer = await prompts({
                    type: 'text',
                    name: 'value',
                    message: 'Please enter a custom version. Make sure to be valid according to semver.org standard.',
                    initial: false,
                    // validate: val => {
                    //     if (!/\d+\.\d+\.\d+/g.test(val)) {
                    //         return 'Invalid version!';
                    //     }
                    //
                    //     return true;
                    // }
                    validate: val => {
                        if (!new RegExp(`^\\d+\\.\\d+\\.\\d+$`).test(val)) {
                            return 'Invalid version!';
                        }
                        return true;
                    }
                })

                if (!customVer.value) {
                    return console.log(chalk.red.bold('Aborted!'))
                }

                vv = customVer.value;

                currentTag = vv;
            } else {
                if (!vv) {
                    vv = '0.0.0';
                }

                vv = vv.trim();

                if (semver.ltr(vv, '0.0.0')) {
                    vv = '0.0.0'
                }

                currentTag = vv;

                if (args.p || args.patch) {
                    vv = semver.inc(vv, 'patch')
                } else if (args.m || args.minor) {
                    vv = semver.inc(vv, 'minor')
                } else if (args.major) {
                    vv = semver.inc(vv, 'major')
                } else {
                    console.log(chalk.red(`Something went wrong!.`))
                    return;
                }

                if (args.major) {
                    const confirmMajorRelease = await prompts({
                        type: 'confirm',
                        name: 'value',
                        message: `Are you sure that you want to create a major release? Current tag is "${currentTag}" and the next will be "${vv}"`,
                        initial: false
                    })

                    if (!confirmMajorRelease.value) {
                        return console.log(chalk.red.bold('Aborted!'))
                    }
                }
            }

            let canCreate

            // Bump the version in package.json
            try {
                canCreate = await packageVersionBump(vv);
            } catch (err) {
                return console.log(err.message);
            }

            // Check for custom config inside of current directory.
            const tagyExtraFile = path.resolve(`${process.cwd()}/tagy.js`);

            try {
                if (fs.existsSync(tagyExtraFile)) {
                    console.log('"tagy.js" file is found!');
                    const tagyExtra = require(tagyExtraFile)

                    await tagyExtra(vv, currentTag, args)
                }
            } catch (err) {
                console.error(err)
            }

            // In some configurations, the replacements can be defined in the package.json.
            const replacementMethods = pkgContent && pkgContent.tagy && pkgContent.tagy.replace && Array.isArray(pkgContent.tagy.replace) ? pkgContent.tagy.replace : [];

            if (replacementMethods.length > 0) {
                console.log(chalk.green('♾️ Replacement methods are found!'));

                for (let i = 0; i < replacementMethods.length; i++) {
                    const {files, from, to, flags} = replacementMethods[i];

                    if (files && from && to) {
                        const _files = Array.isArray(files) ? files : [files];

                        const replaceConf = {
                            files: _files.map(file => path.resolve(`${process.cwd()}/${file}`)),
                            from: new RegExp(from.replaceAll('__CURRENT_TAG__', currentTag).replaceAll('__VERSION__', vv), flags !== false ? (flags || 'g') : undefined),
                            to: to.replaceAll('__CURRENT_TAG__', currentTag).replaceAll('__VERSION__', vv),
                        };

                        replace.sync(replaceConf);
                    }
                }
            }

            if (canCreate) {
                if (!isSoft) {
                    await shell.exec(`git config --global core.autocrlf true`);// Replace CRLF with LF on Windows OS.
                    await shell.exec(`git config --global core.safecrlf false`);// Disable CRLF warnings.
                    // await shell.exec(`git commit -a -m "Release ${vv}"`);
                    // await shell.exec(`git push origin ${branchName}`);
                    // await shell.exec(`git tag ${vv}`);
                    // await shell.exec(`git push origin ${vv}`);
                    await shell.exec(`git commit -a -m "Release ${tagPrefix}${vv}"`);
                    await shell.exec(`git push origin ${branchName}`);
                    await shell.exec(`git tag ${tagPrefix}${vv}`);
                    await shell.exec(`git push origin ${tagPrefix}${vv}`);

                    // Check if github CLI is installed and create a release
                    const ghInstalled = shell.exec(`gh --version`, {silent: true}).stdout;

                    if (ghInstalled) {
                        const autoRelease = args['auto-release'] || (pkgContent && pkgContent.tagy && pkgContent.tagy['auto-release']);

                        const ghRelease = await prompts({
                            type: 'confirm',
                            name: 'value',
                            message: `Do you want to create a release on GitHub?`,
                            initial: false
                        })

                        const releaseIt = autoRelease || ghRelease.value;

                        if (releaseIt) {
                            await shell.exec(`gh release create ${tagPrefix}${vv} --title "${tagPrefix}${vv}" --notes "Release ${tagPrefix}${vv}"`)
                        }
                    }
                }

                await console.log(chalk.blue(`💥 Tag ${vv} --> created!.`))
            }
        } catch (e) {
            console.log(e)
        }
    })()
}
