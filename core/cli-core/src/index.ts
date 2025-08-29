#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import { devCommand } from './commands/dev.js'
import { compileCommand } from './commands/compile.js'
import { cleanCommand } from './commands/clean.js'
import { getPackageInfo } from './utils/package.js'

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

${chalk.gray('Learn more:')}
  Documentation: ${chalk.cyan('https://lightfast.ai/docs')}
  GitHub: ${chalk.cyan('https://github.com/lightfastai/lightfast')}
`)

// Add commands
program.addCommand(devCommand)
program.addCommand(compileCommand)
program.addCommand(cleanCommand)

// Parse arguments
program.parse(process.argv)

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp()
}