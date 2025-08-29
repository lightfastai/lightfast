#!/usr/bin/env node

/**
 * Example: Using Lightfast Config Watcher
 * 
 * This example demonstrates how to use the ConfigWatcher to monitor 
 * configuration changes and automatically recompile when files change.
 * 
 * Usage:
 *   node examples/hot-reload-example.js [config-path]
 */

import { createConfigWatcher } from '../core/cli/dist/compiler/index.js';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get config path from args or use default
const configPath = process.argv[2];
const baseDir = configPath ? dirname(resolve(configPath)) : process.cwd();

console.log(chalk.blue('🔥 Starting Lightfast Config Watcher Example'));
console.log(chalk.gray(`   Base directory: ${baseDir}`));
if (configPath) {
  console.log(chalk.gray(`   Config file: ${configPath}`));
}
console.log();

// Create the watcher
const watcher = createConfigWatcher({
  baseDir,
  debounceDelay: 500,
  debug: true
});

// Set up event listeners
watcher.on('watcher-ready', () => {
  console.log(chalk.green('✅ Watcher ready and monitoring configuration files'));
  const watchedPaths = watcher.getWatchedPaths();
  if (watchedPaths.length > 0) {
    console.log(chalk.blue('📂 Watching:'));
    watchedPaths.forEach(path => {
      console.log(chalk.gray(`   • ${path.replace(process.cwd(), '').replace(/^\//, '')}`));
    });
  } else {
    console.log(chalk.yellow('⚠️  No configuration files found to watch'));
    console.log(chalk.gray('   Create a lightfast.config.ts file to get started'));
  }
  console.log();
});

watcher.on('compile-start', (configPath) => {
  console.log(chalk.cyan('🔄 Compiling configuration...'));
  console.log(chalk.gray(`   Source: ${configPath.replace(process.cwd(), '').replace(/^\//, '')}`));
});

watcher.on('compile-success', (result) => {
  console.log(chalk.green('✨ Compilation successful!'));
  console.log(chalk.gray(`   Output: ${result.outputPath.replace(process.cwd(), '').replace(/^\//, '')}`));
  console.log(chalk.gray(`   Time: ${result.compilationTime.toFixed(1)}ms`));
  console.log(chalk.gray(`   From cache: ${result.fromCache ? 'yes' : 'no'}`));
  
  if (result.warnings.length > 0) {
    console.log(chalk.yellow(`   Warnings: ${result.warnings.length}`));
    result.warnings.forEach(warning => {
      console.log(chalk.yellow(`     • ${warning}`));
    });
  }
  console.log();
});

watcher.on('compile-error', (error, configPath) => {
  console.log(chalk.red('❌ Compilation failed!'));
  console.log(chalk.gray(`   Source: ${configPath.replace(process.cwd(), '').replace(/^\//, '')}`));
  console.log(chalk.red(`   Error: ${error.message}`));
  console.log();
});

watcher.on('config-added', (configPath) => {
  console.log(chalk.green('➕ Configuration file added:'));
  console.log(chalk.gray(`   ${configPath.replace(process.cwd(), '').replace(/^\//, '')}`));
  console.log();
});

watcher.on('config-removed', (configPath) => {
  console.log(chalk.red('➖ Configuration file removed:'));
  console.log(chalk.gray(`   ${configPath.replace(process.cwd(), '').replace(/^\//, '')}`));
  console.log();
});

watcher.on('watcher-error', (error) => {
  console.error(chalk.red('💥 Watcher error:'));
  console.error(chalk.red(`   ${error.message}`));
  console.log();
});

// Start the watcher
try {
  await watcher.start();
} catch (error) {
  console.error(chalk.red('Failed to start watcher:'));
  console.error(chalk.red(error.message));
  process.exit(1);
}

// Handle graceful shutdown
const shutdown = async () => {
  console.log(chalk.yellow('\n🛑 Shutting down watcher...'));
  await watcher.stop();
  console.log(chalk.green('👋 Watcher stopped gracefully'));
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Keep the process running
process.stdin.resume();