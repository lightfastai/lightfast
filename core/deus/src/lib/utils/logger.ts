/**
 * File-based logger for Deus debugging
 *
 * Usage:
 *   import { logger } from './utils/logger.js';
 *   logger.debug('User message received', { message });
 *   logger.info('Agent spawned successfully');
 *   logger.warn('Approval timeout', { timeout });
 *   logger.error('Failed to parse data', { error });
 *
 * Only logs when DEBUG=1 environment variable is set.
 * Logs are written to /tmp/deus-debug.log
 * File auto-rotates when it exceeds 10MB
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const LOG_FILE = '/tmp/deus-debug.log';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const BACKUP_FILE = '/tmp/deus-debug.log.old';

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

/**
 * Check if logging is enabled via DEBUG environment variable
 */
function isDebugEnabled(): boolean {
  return process.env.DEBUG === '1';
}

/**
 * Rotate log file if it exceeds MAX_FILE_SIZE
 */
function rotateIfNeeded(): void {
  try {
    const stats = fs.statSync(LOG_FILE);
    if (stats.size > MAX_FILE_SIZE) {
      // Move current log to backup
      if (fs.existsSync(BACKUP_FILE)) {
        fs.unlinkSync(BACKUP_FILE);
      }
      fs.renameSync(LOG_FILE, BACKUP_FILE);
    }
  } catch (error) {
    // File doesn't exist yet, that's fine
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('[Logger] Failed to rotate log file:', error);
    }
  }
}

/**
 * Format log entry with timestamp and level
 */
function formatLogEntry(level: LogLevel, message: string, data?: unknown): string {
  const timestamp = new Date().toISOString();
  const dataStr = data !== undefined ? ` ${JSON.stringify(data)}` : '';
  return `[${timestamp}] ${level.padEnd(5)} ${message}${dataStr}\n`;
}

/**
 * Write log entry to file
 */
function writeLog(level: LogLevel, message: string, data?: unknown): void {
  if (!isDebugEnabled()) {
    return;
  }

  try {
    rotateIfNeeded();
    const entry = formatLogEntry(level, message, data);
    fs.appendFileSync(LOG_FILE, entry, 'utf8');
  } catch (error) {
    console.error('[Logger] Failed to write log:', error);
  }
}

/**
 * Logger instance
 */
export const logger = {
  /**
   * Log debug information (detailed execution flow)
   */
  debug(message: string, data?: unknown): void {
    writeLog('DEBUG', message, data);
  },

  /**
   * Log informational messages (important events)
   */
  info(message: string, data?: unknown): void {
    writeLog('INFO', message, data);
  },

  /**
   * Log warnings (potential issues)
   */
  warn(message: string, data?: unknown): void {
    writeLog('WARN', message, data);
  },

  /**
   * Log errors (failures)
   */
  error(message: string, data?: unknown): void {
    writeLog('ERROR', message, data);
  },

  /**
   * Get log file path
   */
  getLogFile(): string {
    return LOG_FILE;
  },

  /**
   * Clear log file
   */
  clear(): void {
    try {
      if (fs.existsSync(LOG_FILE)) {
        fs.unlinkSync(LOG_FILE);
      }
      if (fs.existsSync(BACKUP_FILE)) {
        fs.unlinkSync(BACKUP_FILE);
      }
    } catch (error) {
      console.error('[Logger] Failed to clear log:', error);
    }
  },

  /**
   * Check if debug logging is enabled
   */
  isEnabled(): boolean {
    return isDebugEnabled();
  }
};

/**
 * Initialize logger - log startup message
 */
if (isDebugEnabled()) {
  writeLog('INFO', '=== Deus Debug Session Started ===');
}
