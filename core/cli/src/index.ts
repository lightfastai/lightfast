#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import { devCommand } from '../../cli-core/src/commands/dev/index.js'
import { compileCommand } from '../../cli-core/src/commands/compile/index.js'
import { cleanCommand } from '../../cli-core/src/commands/clean/index.js'
import { bundleCommand } from '../../cli-core/src/commands/bundle/index.js'
import { deployCommand } from '../../cli-core/src/commands/deploy/index.js'
import { authCommand } from '../../cli-core/src/commands/auth/index.js'
import { getPackageInfo } from '../../cli-core/src/utils/package.js'

const packageInfo = getPackageInfo()

const program = new Command()
  .name('@lightfastai/cli')
  .description('CLI for Lightfast agent execution engine')
  .version(packageInfo.version)
  .addHelpText('after', `
${chalk.gray('Examples:')}
  $ npx @lightfastai/cli dev
  $ npx @lightfastai/cli dev --port 3000
  $ npx @lightfastai/cli compile
  $ npx @lightfastai/cli compile --watch
  $ npx @lightfastai/cli clean
  $ npx @lightfastai/cli auth login
  $ npx @lightfastai/cli auth status
  $ npx @lightfastai/cli deploy

${chalk.gray('Learn more:')}
  Documentation: ${chalk.cyan('https://lightfast.ai/docs')}
  GitHub: ${chalk.cyan('https://github.com/lightfastai/lightfast')}
`)

// Add commands
program.addCommand(devCommand)
program.addCommand(compileCommand)
program.addCommand(cleanCommand)
program.addCommand(bundleCommand)
program.addCommand(deployCommand)
program.addCommand(authCommand)

// Parse arguments
program.parse(process.argv)

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp()
}