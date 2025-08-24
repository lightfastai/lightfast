import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { startDevServer } from '../server/index.js'

interface DevOptions {
  port?: string
  host?: string
}

export const devCommand = new Command('dev')
  .description('Start the Lightfast development server')
  .option('-p, --port <port>', 'Port to run the server on', '8288')
  .option('-h, --host <host>', 'Host to bind the server to', 'localhost')
  .action(async (options: DevOptions) => {
    const spinner = ora('Starting Lightfast dev server...').start()
    
    try {
      const port = parseInt(options.port || '8288')
      const host = options.host || 'localhost'

      // Start the integrated dev server
      await startDevServer({ port, host })
      
      spinner.succeed('Lightfast dev server started')
      
      console.log('')
      console.log(chalk.bold('  Lightfast Dev Server'))
      console.log('')
      console.log(`  ${chalk.gray('Local:')}    ${chalk.cyan(`http://${host}:${port}`)}`)
      console.log(`  ${chalk.gray('Network:')}  ${chalk.cyan(`http://${host}:${port}`)}`)
      console.log('')
      console.log(chalk.gray('  Press Ctrl+C to stop'))
      console.log('')

    } catch (error) {
      spinner.fail('Failed to start dev server')
      console.error(chalk.red('\nError:'), error)
      process.exit(1)
    }
  })