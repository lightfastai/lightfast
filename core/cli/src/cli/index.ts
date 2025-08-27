import { Command } from 'commander'
import chalk from 'chalk'
import { devCommand } from './commands/dev.js'
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
  $ npx @lightfastai/cli dev --host 0.0.0.0

${chalk.gray('Learn more:')}
  Documentation: ${chalk.cyan('https://lightfast.ai/docs')}
  GitHub: ${chalk.cyan('https://github.com/lightfastai/lightfast')}
`)

// Add dev command
program.addCommand(devCommand)

// Parse arguments
program.parse(process.argv)

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp()
}