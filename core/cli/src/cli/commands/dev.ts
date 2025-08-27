import { Command } from 'commander'
import chalk from 'chalk'
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

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
    console.log(chalk.blue('→ Starting Lightfast server...'))
    
    try {
      const port = options.port || '3000'
      const host = options.host || 'localhost'
      
      // When running from dist (production/installed), use the built app
      const isProduction = __dirname.includes('/dist/')
      
      if (process.env.DEBUG) {
        console.log(chalk.gray(`Debug: __dirname = ${__dirname}`))
        console.log(chalk.gray(`Debug: isProduction = ${isProduction}`))
      }
      
      let cliRoot: string
      let startCommand: string[]
      
      if (isProduction) {
        // Running from installed package - use built server
        cliRoot = path.resolve(__dirname, '..', '..')
        const serverPath = path.join(cliRoot, '.output', 'server', 'index.mjs')
        
        // Check if built app exists
        if (!fs.existsSync(serverPath)) {
          console.error(chalk.red('✖ Built app not found. This is a packaging error.'))
          console.error(chalk.yellow('  If you are developing, use "pnpm dev" instead.'))
          process.exit(1)
        }
        
        startCommand = ['node', serverPath]
        console.log(chalk.blue('→ Starting production server...'))
      } else {
        // Development mode - run from source
        cliRoot = path.resolve(__dirname, '..', '..', '..')
        startCommand = ['pnpm', 'vite', 'dev', '--port', port, '--host', host]
        console.log(chalk.blue('→ Starting development server...'))
      }
      
      console.log(chalk.blue('→ Launching Lightfast UI...'))
      
      // Run the appropriate command
      const devProcess = spawn(startCommand[0], startCommand.slice(1), {
        cwd: cliRoot,
        stdio: 'pipe',
        shell: true,
        env: {
          ...process.env,
          PORT: port,
          HOST: host
        }
      })

      let serverStarted = false

      devProcess.stdout?.on('data', (data) => {
        const output = data.toString()
        
        // Check if server has started (works for both vite and production)
        if ((output.includes('Local:') || output.includes('Listening on')) && !serverStarted) {
          serverStarted = true
          console.log(chalk.green('✔ Lightfast server started'))
          
          console.log('')
          console.log(chalk.bold('  🚀 Lightfast CLI Server'))
          console.log('')
          console.log(`  ${chalk.gray('Local:')}    ${chalk.cyan(`http://${host}:${port}`)}`)
          if (host !== 'localhost') {
            console.log(`  ${chalk.gray('Network:')}  ${chalk.cyan(`http://${host}:${port}`)}`)
          }
          console.log('')
          console.log(chalk.gray('  View and manage your Lightfast agents in the browser'))
          console.log(chalk.gray('  Press Ctrl+C to stop'))
          console.log('')
        }
        
        // Show output in debug mode
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
        console.error(chalk.red(`✖ Failed to start server: ${error.message}`))
        if (isProduction) {
          console.error(chalk.yellow('  Try reinstalling the package.'))
        }
        process.exit(1)
      })

      devProcess.on('close', (code) => {
        if (code !== 0 && code !== null) {
          console.error(chalk.red(`✖ Server exited with code ${code}`))
          process.exit(code)
        }
      })

      // Handle graceful shutdown
      process.on('SIGINT', () => {
        console.log(chalk.yellow('\n\nShutting down Lightfast server...'))
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
      console.error(chalk.red('✖ Failed to start server'))
      console.error(chalk.red('\nError:'), error)
      process.exit(1)
    }
  })