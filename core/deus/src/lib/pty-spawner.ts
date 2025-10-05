import * as pty from 'node-pty';
import type { IPty } from 'node-pty';
import { watchProjectDir, watchConversation, type ClaudeMessage, extractMessageText } from './claude-sync.js';

/**
 * PTY-based Claude spawner
 * Runs Claude in full interactive mode with all features (slash commands, tab completion, etc.)
 */

export interface PtySpawnerOptions {
  cwd: string;
  command?: string;
  onMessage?: (role: 'user' | 'assistant' | 'system', content: string) => void;
  onSessionDetected?: (sessionId: string) => void;
  onData?: (data: string) => void;
}

export class ClaudePtySpawner {
  private pty: IPty | null = null;
  private sessionId: string | null = null;
  private projectPath: string;
  private conversationWatcher: (() => void) | null = null;
  private projectDirWatcher: (() => void) | null = null;
  private options: PtySpawnerOptions;
  private isReady: boolean = false;
  private readyPromise: Promise<void>;
  private resolveReady!: () => void;

  constructor(options: PtySpawnerOptions) {
    this.options = options;
    this.projectPath = options.cwd;

    // Create promise that resolves when Claude is ready for input
    this.readyPromise = new Promise((resolve) => {
      this.resolveReady = resolve;
    });
  }

  /**
   * Start Claude in interactive mode via PTY
   */
  async start(): Promise<void> {
    const command = this.options.command || 'claude';

    // Spawn Claude in PTY (full interactive mode)
    this.pty = pty.spawn(command, [], {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: this.projectPath,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        // Disable any prompts that might interfere
        CLAUDE_NO_WELCOME: 'true',
      },
    });

    // Set up project directory watcher to detect new conversation files
    this.projectDirWatcher = watchProjectDir(
      this.projectPath,
      (sessionId, filePath) => {
        if (!this.sessionId) {
          this.sessionId = sessionId;
          this.options.onSessionDetected?.(sessionId);
          this.startWatchingConversation(filePath);
        }
      }
    );

    // Handle PTY data (raw output with ANSI codes)
    this.pty.onData((data: string) => {
      // Pass raw data to consumer for real-time display
      this.options.onData?.(data);

      // Detect when Claude is ready for input
      // Look for "-- INSERT --" which indicates the input field is active
      if (!this.isReady && data.includes('-- INSERT --')) {
        this.isReady = true;
        this.resolveReady();
      }

      // Try to extract session ID from initial output if not detected via file
      // Claude might output something like "Starting new conversation..."
      if (!this.sessionId) {
        // This is a fallback - file watching is more reliable
        const sessionMatch = data.match(/session[:\s]+([a-f0-9-]{36})/i);
        if (sessionMatch && sessionMatch[1]) {
          this.sessionId = sessionMatch[1];
          this.options.onSessionDetected?.(sessionMatch[1]);
        }
      }
    });

    // Handle process exit
    this.pty.onExit(({ exitCode, signal }) => {
      this.options.onMessage?.(
        'system',
        `Claude process exited (code: ${exitCode}, signal: ${signal})`
      );
      this.cleanup();
    });
  }

  /**
   * Start watching conversation file for structured messages
   */
  private startWatchingConversation(filePath: string): void {
    this.conversationWatcher = watchConversation(filePath, (message: ClaudeMessage) => {
      const text = extractMessageText(message);
      if (!text) return;

      // Emit structured messages from the conversation file
      if (message.type === 'user') {
        this.options.onMessage?.('user', text);
      } else if (message.type === 'assistant') {
        this.options.onMessage?.('assistant', text);
      } else if (message.type === 'summary') {
        this.options.onMessage?.('system', text);
      }
    });
  }

  /**
   * Wait until Claude is ready to receive input
   */
  async waitUntilReady(): Promise<void> {
    return this.readyPromise;
  }

  /**
   * Send message to Claude (like typing in the terminal)
   */
  async write(message: string): Promise<void> {
    if (!this.pty) {
      throw new Error('PTY not started');
    }

    // Wait until Claude is ready before sending input
    await this.waitUntilReady();

    // Send message followed by Enter (\r\n for compatibility)
    this.pty.write(message);
    this.pty.write('\r'); // Carriage return (Enter key)
  }

  /**
   * Send raw input (for special keys, commands, etc.)
   */
  writeRaw(data: string): void {
    if (!this.pty) {
      throw new Error('PTY not started');
    }
    this.pty.write(data);
  }

  /**
   * Send slash command
   */
  sendCommand(command: string): void {
    this.write(`/${command}`);
  }

  /**
   * Send Tab key (for thinking mode toggle, completions)
   */
  sendTab(): void {
    if (!this.pty) {
      throw new Error('PTY not started');
    }
    this.pty.write('\t');
  }

  /**
   * Send Ctrl+C (interrupt)
   */
  sendInterrupt(): void {
    if (!this.pty) {
      throw new Error('PTY not started');
    }
    this.pty.write('\x03');
  }

  /**
   * Resize PTY (useful when terminal size changes)
   */
  resize(cols: number, rows: number): void {
    if (!this.pty) {
      throw new Error('PTY not started');
    }
    this.pty.resize(cols, rows);
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Check if PTY is running
   */
  isRunning(): boolean {
    return this.pty !== null;
  }

  /**
   * Cleanup and stop PTY
   */
  cleanup(): void {
    if (this.conversationWatcher) {
      this.conversationWatcher();
      this.conversationWatcher = null;
    }

    if (this.projectDirWatcher) {
      this.projectDirWatcher();
      this.projectDirWatcher = null;
    }

    if (this.pty) {
      this.pty.kill();
      this.pty = null;
    }
  }
}

/**
 * Helper to strip ANSI escape codes
 */
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

/**
 * Helper to detect if string contains ANSI codes
 */
export function hasAnsi(str: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /\x1B\[[0-9;]*[a-zA-Z]/.test(str);
}
