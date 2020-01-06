#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const shell = require("shelljs")
const semver = require('semver')
const args = require('yargs').argv
const prompts = require('prompts')
const chalk = require("chalk");

module.exports = function () {
    (async () => {
        const totalArguments = Object.values(args).length;

        if (totalArguments > 3) {
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
            args.info
        )

        if (!haveOption) {
            await console.log(chalk.red.bold('Please specify the increment type') + ' [-p, -m, --minor, --patch, --major, --reverse, --info]')
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

        try {
            let currentBranchName = shell.exec("git branch | grep \\* | cut -d ' ' -f2", {silent: true}).stdout;

            if (!currentBranchName || currentBranchName.trim() !== 'master') {
                await console.log(chalk.red.bold('You can create tags only from "master" branch.'))
                return;
            }

            shell.exec('git fetch --tags', {silent: true});
            
            let vv = shell.exec('git tag --sort=committerdate | grep -E \'^[0-9]\' | tail -1', {silent: true}).stdout;

            if (args.info) {
                if (!vv) {
                    await console.log(chalk.blue(`Looks like no tags were created by this moment.`))
                } else {
                    await console.log(chalk.blue(`Last created tag is: ${vv}`))
                }

                return;
            }

            if (args.reverse) {
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

            if (!vv) {
                vv = '0.0.0';
            }

            vv = vv.trim();

            if (semver.ltr(vv, '0.0.0')) {
                vv = '0.0.0'
            }

            const currentTag = vv;

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

            shell.exec(`git tag ${vv}`);
            shell.exec(`git push origin ${vv}`);

            await console.log(chalk.blue(`Tag ${vv} --> created!.`))
        } catch (e) {
            console.log(e)
        }
    })()
}
