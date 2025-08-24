import type { ChildProcess } from 'child_process'
import chalk from 'chalk'

export function setupShutdownHandlers(childProcess: ChildProcess): void {
  let isShuttingDown = false

  const shutdown = async (signal: string) => {
    if (isShuttingDown) return
    isShuttingDown = true

    console.log('')
    console.log(chalk.yellow(`\nReceived ${signal}, shutting down gracefully...`))

    if (childProcess && !childProcess.killed) {
      childProcess.kill('SIGTERM')
      
      // Give the process time to shut down gracefully
      setTimeout(() => {
        if (!childProcess.killed) {
          console.log(chalk.red('Force killing process...'))
          childProcess.kill('SIGKILL')
        }
      }, 5000)
    }

    // Wait a bit for cleanup
    setTimeout(() => {
      process.exit(0)
    }, 100)
  }

  // Handle various shutdown signals
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGHUP', () => shutdown('SIGHUP'))

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error(chalk.red('\nUncaught exception:'), error)
    shutdown('uncaughtException')
  })

  process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.red('\nUnhandled rejection at:'), promise, chalk.red('reason:'), reason)
    shutdown('unhandledRejection')
  })
}