import { Command } from 'commander'
import chalk from 'chalk'
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface DevOptions {
  port?: string
  host?: string
}

export const devCommand = new Command('dev')
  .description('Start the Lightfast development server')
  .option('-p, --port <port>', 'Port to run the server on', '3000')
  .option('-h, --host <host>', 'Host to bind the server to', 'localhost')
  .action(async (options: DevOptions) => {
    console.log(chalk.blue('→ Starting Lightfast dev server...'))
    
    try {
      const port = options.port || '3000'
      const host = options.host || 'localhost'
      
      // Get the CLI package root directory (from src/cli/commands to root)
      const cliRoot = path.resolve(__dirname, '..', '..', '..')
      
      console.log(chalk.blue('→ Launching Lightfast UI...'))
      
      // Run TanStack Start dev server
      const devProcess = spawn('pnpm', ['vite', 'dev', '--port', port, '--host', host], {
        cwd: cliRoot,
        stdio: 'pipe',
        shell: true
      })

      let serverStarted = false

      devProcess.stdout?.on('data', (data) => {
        const output = data.toString()
        
        // Check if server has started
        if (output.includes('Local:') && !serverStarted) {
          serverStarted = true
          console.log(chalk.green('✔ Lightfast dev server started'))
          
          console.log('')
          console.log(chalk.bold('  🚀 Lightfast CLI Dev Server'))
          console.log('')
          console.log(`  ${chalk.gray('Local:')}    ${chalk.cyan(`http://${host}:${port}`)}`)
          console.log(`  ${chalk.gray('Network:')}  ${chalk.cyan(`http://${host === 'localhost' ? 'http://localhost' : `http://${host}`}:${port}`)}`)
          console.log('')
          console.log(chalk.gray('  View and manage your Lightfast agents in the browser'))
          console.log(chalk.gray('  Press Ctrl+C to stop'))
          console.log('')
        }
        
        // Show other output in debug mode
        if (process.env.DEBUG) {
          console.log(chalk.gray(output))
        }
      })

      devProcess.stderr?.on('data', (data) => {
        const error = data.toString()
        // Only show errors, not warnings
        if (error.toLowerCase().includes('error')) {
          console.error(chalk.red(error))
        } else if (process.env.DEBUG) {
          console.error(chalk.yellow(error))
        }
      })

      devProcess.on('error', (error) => {
        console.error(chalk.red(`✖ Failed to start dev server: ${error.message}`))
        process.exit(1)
      })

      devProcess.on('close', (code) => {
        if (code !== 0 && code !== null) {
          console.error(chalk.red(`✖ Dev server exited with code ${code}`))
          process.exit(code)
        }
      })

      // Handle graceful shutdown
      process.on('SIGINT', () => {
        console.log(chalk.yellow('\n\nShutting down Lightfast dev server...'))
        devProcess.kill('SIGTERM')
        setTimeout(() => {
          devProcess.kill('SIGKILL')
          process.exit(0)
        }, 5000)
      })

      process.on('SIGTERM', () => {
        devProcess.kill('SIGTERM')
        process.exit(0)
      })

    } catch (error) {
      console.error(chalk.red('✖ Failed to start dev server'))
      console.error(chalk.red('\nError:'), error)
      process.exit(1)
    }
  })