import chalk from 'chalk';
import { relative } from 'node:path';

export interface CompilationError {
  message: string;
  file?: string;
  line?: number;
  column?: number;
  text?: string;
}

/**
 * Formats a compilation error for terminal display
 */
export function formatCompilationError(error: string | CompilationError): string {
  if (typeof error === 'string') {
    // Try to parse esbuild error format: "file:line:column: message"
    const match = /^(.+?):(\d+):(\d+):\s*(.+)$/.exec(error);
    if (match) {
      const [, file, line, column, message] = match;
      return formatStructuredError({
        file: file ?? '',
        line: parseInt(line ?? '0', 10),
        column: parseInt(column ?? '0', 10),
        message: message ?? ''
      });
    }
    
    // Plain error message
    return `  ${chalk.red('✖')} ${error}`;
  }
  
  return formatStructuredError(error);
}

/**
 * Formats a structured error with file location
 */
function formatStructuredError(error: CompilationError): string {
  const parts: string[] = [];
  
  // Add error indicator
  parts.push(chalk.red('✖'));
  
  // Add file location if available
  if (error.file) {
    const relativeFile = relative(process.cwd(), error.file);
    let location = chalk.cyan(relativeFile);
    
    if (error.line) {
      location += chalk.gray(':') + chalk.yellow(error.line.toString());
      if (error.column) {
        location += chalk.gray(':') + chalk.yellow(error.column.toString());
      }
    }
    
    parts.push(location);
  }
  
  // Add error message
  parts.push(error.text ? `${error.message} - ${error.text}` : error.message);
  
  return `  ${parts.join(' ')}`;
}

/**
 * Formats multiple compilation errors
 */
export function formatCompilationErrors(errors: (string | CompilationError)[]): string {
  if (errors.length === 0) {
    return '';
  }
  
  const formattedErrors = errors.map(formatCompilationError);
  
  const header = chalk.red.bold(`\n✖ Compilation failed with ${errors.length} error${errors.length > 1 ? 's' : ''}:\n`);
  const body = formattedErrors.join('\n');
  const footer = '\n';
  
  return header + body + footer;
}

/**
 * Formats compilation warnings
 */
export function formatCompilationWarnings(warnings: string[]): string {
  if (warnings.length === 0) {
    return '';
  }
  
  const formattedWarnings = warnings.map(warning => {
    // Try to parse esbuild warning format
    const match = /^(.+?):(\d+):(\d+):\s*(.+)$/.exec(warning);
    if (match) {
      const [, file, line, column, message] = match;
      const relativeFile = relative(process.cwd(), file ?? '');
      const location = `${chalk.cyan(relativeFile)}:${chalk.yellow(line ?? '0')}:${chalk.yellow(column ?? '0')}`;
      return `  ${chalk.yellow('⚠')} ${location} ${message ?? ''}`;
    }
    
    return `  ${chalk.yellow('⚠')} ${warning}`;
  });
  
  const header = chalk.yellow.bold(`\n⚠ ${warnings.length} warning${warnings.length > 1 ? 's' : ''}:\n`);
  const body = formattedWarnings.join('\n');
  const footer = '\n';
  
  return header + body + footer;
}

/**
 * Creates a box around the error message for emphasis
 */
export function boxError(message: string): string {
  const lines = message.split('\n');
  const maxLength = Math.max(...lines.map(line => stripAnsi(line).length));
  const border = chalk.red('─'.repeat(maxLength + 4));
  
  const boxedLines = [
    chalk.red('┌') + border + chalk.red('┐'),
    ...lines.map(line => chalk.red('│ ') + line + ' '.repeat(maxLength - stripAnsi(line).length + 1) + chalk.red('│')),
    chalk.red('└') + border + chalk.red('┘')
  ];
  
  return boxedLines.join('\n');
}

/**
 * Simple ANSI stripping for length calculation
 */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\u001b\[[0-9;]*m/g, '');
}

/**
 * Displays a compilation result summary
 */
export function displayCompilationSummary(
  errors: string[],
  warnings: string[],
  sourcePath: string,
  compilationTime: number
): void {
  const relativeSource = relative(process.cwd(), sourcePath);
  
  if (errors.length > 0) {
    // Show errors
    console.error(formatCompilationErrors(errors));
    console.error(chalk.gray(`  Source: ${relativeSource}`));
    console.error(chalk.gray(`  Time: ${compilationTime.toFixed(2)}ms`));
  } else {
    // Success with possible warnings
    if (warnings.length > 0) {
      console.warn(formatCompilationWarnings(warnings));
    }
    
    console.log(chalk.green(`✔ Compiled ${chalk.cyan(relativeSource)} in ${chalk.yellow(compilationTime.toFixed(2) + 'ms')}`));
  }
}

/**
 * Shows a live compilation status that updates in place
 */
export class CompilationSpinner {
  private intervalId?: NodeJS.Timeout;
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private currentFrame = 0;
  private message: string;
  
  constructor(message = 'Compiling...') {
    this.message = message;
  }
  
  start(): void {
    if (this.intervalId) return;
    
    this.intervalId = setInterval(() => {
      process.stdout.write('\r' + chalk.blue(this.frames[this.currentFrame]) + ' ' + this.message);
      this.currentFrame = (this.currentFrame + 1) % this.frames.length;
    }, 80);
  }
  
  stop(_success = true): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      process.stdout.write('\r');
      process.stdout.write(' '.repeat(this.message.length + 3) + '\r');
    }
  }
  
  update(message: string): void {
    // Clear current line
    if (this.intervalId) {
      process.stdout.write('\r' + ' '.repeat(this.message.length + 3) + '\r');
    }
    this.message = message;
  }
}