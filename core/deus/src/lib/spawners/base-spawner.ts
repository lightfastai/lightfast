import * as pty from 'node-pty';
import type { IPty } from 'node-pty';

/**
 * Base PTY Spawner
 * Abstract base class for agent PTY spawners (Claude Code, Codex, etc.)
 *
 * Provides common functionality:
 * - PTY lifecycle management (start, stop, cleanup)
 * - Ready state detection with timeout
 * - Character-by-character typing simulation
 * - Session ID detection and notification
 */

export interface ApprovalPrompt {
  prompt: string;
  options: string[];
  rawData: string;
}

export interface BasePtySpawnerOptions {
  cwd: string;
  command?: string;
  onMessage?: (role: 'user' | 'assistant' | 'system', content: string) => void;
  onSessionDetected?: (sessionId: string, filePath?: string) => void;
  onData?: (data: string) => void;
  onApprovalRequest?: (approval: ApprovalPrompt) => void;
}

/**
 * PTY ready detection constants
 */
export const PTY_READY_DELAY = 3000; // 3s delay for PTY to be ready
export const CHAR_TYPING_DELAY = 10; // 10ms between characters
export const SUBMIT_DELAY_BEFORE_ENTER = 100; // Wait before sending Enter
export const SUBMIT_DELAY_AFTER_ENTER = 500; // Wait after sending Enter

/**
 * Abstract base class for PTY-based agent spawners
 */
export abstract class BasePtySpawner {
  protected pty: IPty | null = null;
  protected sessionId: string | null = null;
  protected projectPath: string;
  protected options: BasePtySpawnerOptions;
  protected isReady: boolean = false;
  protected readyPromise: Promise<void>;
  protected resolveReady!: () => void;

  // File watchers (cleanup handlers)
  protected watchers: Array<() => void> = [];

  constructor(options: BasePtySpawnerOptions) {
    this.options = options;
    this.projectPath = options.cwd;

    // Create promise that resolves when agent is ready for input
    this.readyPromise = new Promise((resolve) => {
      this.resolveReady = resolve;
    });
  }

  /**
   * Start the PTY process
   * Template method - calls abstract methods for agent-specific setup
   */
  async start(): Promise<void> {
    const command = this.getCommand();

    if (process.env.DEBUG) {
      console.log(`[${this.getAgentName()} Spawner] Starting command: ${command}`);
    }

    // Spawn PTY
    try {
      this.pty = pty.spawn(command, [], {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd: this.projectPath,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
        },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (process.env.DEBUG) {
        console.error(`[${this.getAgentName()} Spawner] Failed to spawn PTY:`, error);
      }
      throw new Error(`Failed to spawn ${command}: ${errorMsg}`);
    }

    // Agent-specific initialization (e.g., Codex needs cursor response)
    this.onPtyCreated();

    // Set up file watchers for session detection
    this.setupFileWatchers();

    // Handle PTY data
    this.pty.onData((data: string) => {
      this.handlePtyData(data);
    });

    // Handle process exit
    this.pty.onExit(({ exitCode, signal }) => {
      this.options.onMessage?.(
        'system',
        `${this.getAgentName()} process exited (code: ${exitCode}, signal: ${signal})`
      );
      this.cleanup();
    });
  }

  /**
   * Handle PTY data - template method with hooks
   */
  protected handlePtyData(data: string): void {
    // Pass raw data to consumer
    this.options.onData?.(data);

    // Agent-specific data handling (e.g., cursor position queries)
    this.onDataReceived(data);

    // Ready state detection
    if (!this.isReady && this.isReadyPattern(data)) {
      if (process.env.DEBUG) {
        console.log(`[${this.getAgentName()} Spawner] Ready pattern detected`);
      }
      this.isReady = true;
      this.resolveReady();
    }

    // Session ID detection from PTY output (fallback)
    if (!this.sessionId) {
      const sessionMatch = data.match(/session[:\s]+([a-f0-9-]+)/i);
      if (sessionMatch && sessionMatch[1]) {
        this.sessionId = sessionMatch[1];
        this.options.onSessionDetected?.(sessionMatch[1]);
      }
    }
  }

  /**
   * Wait until agent is ready to receive input
   */
  async waitUntilReady(): Promise<void> {
    // Use fixed delay instead of pattern detection
    // Pattern detection has issues with chunked PTY data
    if (!this.isReady) {
      if (process.env.DEBUG) {
        console.log(`[${this.getAgentName()} Spawner] Waiting ${PTY_READY_DELAY}ms for agent to be ready...`);
      }
      await new Promise(resolve => setTimeout(resolve, PTY_READY_DELAY));
      this.isReady = true;
      if (process.env.DEBUG) {
        console.log(`[${this.getAgentName()} Spawner] Ready!`);
      }
    }
    return Promise.resolve();
  }

  /**
   * Send message to agent (character-by-character typing simulation)
   */
  async write(message: string): Promise<void> {
    if (!this.pty) {
      throw new Error('PTY not started');
    }

    if (process.env.DEBUG) {
      console.log(`[${this.getAgentName()} Spawner] write() called`);
    }

    // Wait until agent is ready
    await this.waitUntilReady();

    if (process.env.DEBUG) {
      console.log(`[${this.getAgentName()} Spawner] Writing message: "${message}"`);
    }

    // Type character-by-character to simulate human input
    for (const char of message) {
      this.pty.write(char);
      await new Promise(resolve => setTimeout(resolve, CHAR_TYPING_DELAY));
    }

    // Wait before sending Enter
    await new Promise(resolve => setTimeout(resolve, SUBMIT_DELAY_BEFORE_ENTER));

    if (process.env.DEBUG) {
      console.log(`[${this.getAgentName()} Spawner] Sending Enter`);
    }

    // Send Enter to submit
    this.pty.write('\r');

    // Wait after Enter
    await new Promise(resolve => setTimeout(resolve, SUBMIT_DELAY_AFTER_ENTER));
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
   * Send interrupt (Ctrl+C)
   */
  sendInterrupt(): void {
    if (!this.pty) {
      throw new Error('PTY not started');
    }
    this.pty.write('\x03');
  }

  /**
   * Resize PTY
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
    // Cleanup file watchers
    for (const watcher of this.watchers) {
      watcher();
    }
    this.watchers = [];

    // Kill PTY
    if (this.pty) {
      this.pty.kill();
      this.pty = null;
    }
  }

  // ============================================================
  // Abstract methods - must be implemented by subclasses
  // ============================================================

  /**
   * Get the command to execute (e.g., "claude", "codex")
   */
  protected abstract getCommand(): string;

  /**
   * Get the agent name for logging
   */
  protected abstract getAgentName(): string;

  /**
   * Set up file watchers for session detection
   * Should push cleanup functions to this.watchers array
   */
  protected abstract setupFileWatchers(): void;

  /**
   * Called immediately after PTY is created
   * Use for agent-specific initialization (e.g., Codex cursor response)
   */
  protected abstract onPtyCreated(): void;

  /**
   * Called when PTY data is received
   * Use for agent-specific handling (e.g., cursor position queries)
   */
  protected abstract onDataReceived(data: string): void;

  /**
   * Check if data contains ready pattern
   * Used for ready state detection
   */
  protected abstract isReadyPattern(data: string): boolean;
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
