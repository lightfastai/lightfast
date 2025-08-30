import { Command } from 'commander';
import chalk from 'chalk';
import { createCompiler, findConfig, displayCompilationSummary, CompilationSpinner } from '@lightfastai/compiler';

interface CompileOptions {
  config?: string;
  force?: boolean;
  watch?: boolean;
  output?: string;
}

export const compileCommand = new Command('compile')
  .description('Compile TypeScript configuration files')
  .option('-c, --config <path>', 'Path to the configuration file')
  .option('-f, --force', 'Force recompilation even if cache is valid')
  .option('-w, --watch', 'Watch for changes and recompile automatically')
  .option('-o, --output <path>', 'Output directory for compiled files')
  .action(async (options: CompileOptions) => {
    try {
      const baseDir = process.cwd();
      const configPath = options.config || await findConfig(baseDir);
      
      if (!configPath) {
        console.error(chalk.red('✖ No configuration file found'));
        console.error(chalk.gray('  Searched for: lightfast.config.ts, lightfast.config.js, etc.'));
        process.exit(1);
      }
      
      const spinner = new CompilationSpinner(`Compiling ${chalk.cyan(configPath)}...`);
      spinner.start();
      
      const compiler = createCompiler({ 
        baseDir,
        useCache: !options.force,
        generateBundles: false // Only transpile, no bundling for dev
      });
      
      const result = await compiler.compile({
        configPath,
        force: options.force
      });
      
      spinner.stop();
      
      if (result.errors.length > 0) {
        displayCompilationSummary(
          result.errors,
          result.warnings,
          result.sourcePath,
          result.compilationTime
        );
        process.exit(1);
      } else {
        displayCompilationSummary(
          result.errors,
          result.warnings,
          result.sourcePath,
          result.compilationTime
        );
        
        if (result.fromCache) {
          console.log(chalk.gray('  (from cache)'));
        }
        
        console.log(chalk.gray(`  Output: ${result.outputPath}`));
        console.log(chalk.gray(`  To generate deployment bundles, run: npx @lightfastai/cli bundle`));
      }
      
      // Watch mode
      if (options.watch) {
        console.log(chalk.blue('\n→ Watching for changes...'));
        console.log(chalk.gray('  Press Ctrl+C to stop'));
        
        const watcherResult = compiler.watch({
          configPath,
          onCompile: (watchResult) => {
            displayCompilationSummary(
              watchResult.errors,
              watchResult.warnings,
              watchResult.sourcePath,
              watchResult.compilationTime
            );
          },
          onError: (error) => {
            console.error(chalk.red('✖ Watch error:'), error.message);
          }
        });
        
        // Handle graceful shutdown
        process.on('SIGINT', () => {
          console.log(chalk.yellow('\n\nStopping watcher...'));
          watcherResult.close();
          process.exit(0);
        });
        
        process.on('SIGTERM', () => {
          watcherResult.close();
          process.exit(0);
        });
      }
      
    } catch (error) {
      console.error(chalk.red('✖ Compilation failed'));
      console.error(chalk.red('\nError:'), error);
      process.exit(1);
    }
  });