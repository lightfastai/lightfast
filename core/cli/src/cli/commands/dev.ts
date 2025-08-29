import { Command } from 'commander'
import chalk from 'chalk'
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { createCompiler, findConfig } from '../../compiler/index.js'
import { createConfigWatcher } from '../../compiler/watcher.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface DevOptions {
  port?: string
  host?: string
  noWatch?: boolean
  noCompile?: boolean
}

export const devCommand = new Command('dev')
  .description('Start the Lightfast development server')
  .option('-p, --port <port>', 'Port to run the server on', '3000')
  .option('-h, --host <host>', 'Host to bind the server to', 'localhost')
  .option('--no-watch', 'Disable file watching for config changes')
  .option('--no-compile', 'Disable TypeScript compilation (use existing JS files only)')
  .action(async (options: DevOptions) => {
    console.log(chalk.blue('→ Starting Lightfast server...'))
    
    try {
      const port = options.port || '3000'
      const host = options.host || 'localhost'
      
      // Compile TypeScript config if needed
      if (!options.noCompile) {
        const configPath = await findConfig(process.cwd());
        if (configPath && configPath.endsWith('.ts')) {
          console.log(chalk.blue('→ Compiling TypeScript configuration...'))
          const compiler = createCompiler({ baseDir: process.cwd() });
          
          try {
            const result = await compiler.compile({ configPath });
            console.log(chalk.green('✔ Configuration compiled successfully'))
            
            // Start watcher if not disabled
            if (!options.noWatch) {
              console.log(chalk.blue('→ Starting configuration watcher...'))
              const watcher = createConfigWatcher({
                baseDir: process.cwd(),
                compiler,
                debounceDelay: 500,
                additionalWatchPaths: [configPath]
              });
              
              watcher.on('compile-start', () => {
                console.log(chalk.blue('↻ Recompiling configuration...'))
              });
              
              watcher.on('compile-success', () => {
                console.log(chalk.green('✔ Configuration recompiled successfully'))
              });
              
              watcher.on('compile-error', (error) => {
                console.error(chalk.red('✖ Compilation error:'), error.message)
              });
              
              await watcher.start();
              console.log(chalk.green('✔ Watching for configuration changes'))
              
              // Cleanup on exit
              process.on('SIGINT', () => {
                watcher.stop();
              });
              process.on('SIGTERM', () => {
                watcher.stop();
              });
            }
          } catch (error) {
            console.error(chalk.red('✖ Failed to compile configuration:'), error)
            console.error(chalk.yellow('  Continuing with existing configuration...'))
          }
        }
      }
      
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