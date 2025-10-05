import * as pty from 'node-pty';
import type { IPty } from 'node-pty';
import { watchSessionsDir, watchSession, type CodexSessionEvent, extractEventText, parseSessionFilename } from './codex-sync.js';

/**
 * PTY-based Codex spawner
 * Runs Codex in interactive mode with full features
 */

export interface CodexPtySpawnerOptions {
  cwd: string;
  command?: string;
  onMessage?: (role: 'user' | 'assistant' | 'system', content: string) => void;
  onSessionDetected?: (sessionId: string) => void;
  onData?: (data: string) => void;
}

export class CodexPtySpawner {
  private pty: IPty | null = null;
  private sessionId: string | null = null;
  private projectPath: string;
  private sessionWatcher: (() => void) | null = null;
  private sessionsDirWatcher: (() => void) | null = null;
  private options: CodexPtySpawnerOptions;
  private isReady: boolean = false;
  private readyPromise: Promise<void>;
  private resolveReady!: () => void;

  constructor(options: CodexPtySpawnerOptions) {
    this.options = options;
    this.projectPath = options.cwd;

    // Create promise that resolves when Codex is ready for input
    this.readyPromise = new Promise((resolve) => {
      this.resolveReady = resolve;
    });
  }

  /**
   * Start Codex in interactive mode via PTY
   */
  async start(): Promise<void> {
    const command = this.options.command || 'codex';

    // Spawn Codex in PTY (full interactive mode)
    this.pty = pty.spawn(command, [], {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: this.projectPath,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        // Disable terminal features that might cause issues in PTY
        TERM_PROGRAM: 'xterm',
      },
    });

    // Send initial cursor position response to prevent timeout
    // Some terminals query cursor position on startup
    this.pty.write('\x1b[1;1R');

    // Set up sessions directory watcher to detect new session files
    this.sessionsDirWatcher = watchSessionsDir(
      (sessionId, filePath) => {
        if (!this.sessionId) {
          this.sessionId = sessionId;
          this.options.onSessionDetected?.(sessionId);
          this.startWatchingSession(filePath);
        }
      }
    );

    // Handle PTY data (raw output with ANSI codes)
    this.pty.onData((data: string) => {
      // Pass raw data to consumer for real-time display
      this.options.onData?.(data);

      // Detect when Codex is ready for input
      // Codex shows ">" prompt when ready (simpler than Claude)
      if (!this.isReady && data.includes('>')) {
        this.isReady = true;
        this.resolveReady();
      }

      // Alternative: detect session ID from output if not detected via file
      if (!this.sessionId) {
        // Codex might output session info in the terminal
        const sessionMatch = data.match(/session[:\s]+([a-f0-9-]+)/i);
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
        `Codex process exited (code: ${exitCode}, signal: ${signal})`
      );
      this.cleanup();
    });
  }

  /**
   * Start watching session file for structured events
   */
  private startWatchingSession(filePath: string): void {
    this.sessionWatcher = watchSession(filePath, (event: CodexSessionEvent) => {
      const text = extractEventText(event);
      if (!text) return;

      // Emit structured events from the session file
      if (event.type === 'response_item') {
        const role = event.payload?.role;

        if (role === 'user') {
          // Don't emit user messages (already added by sendToAgent)
          // this.options.onMessage?.('user', text);
        } else if (role === 'assistant') {
          this.options.onMessage?.('assistant', text);
        }
      } else if (event.type === 'session_meta') {
        const sessionId = event.payload?.id;
        if (sessionId) {
          this.options.onMessage?.('system', `[Codex Session: ${sessionId.substring(0, 8)}...]`);
        }
      }
    });
  }

  /**
   * Wait until Codex is ready to receive input
   */
  async waitUntilReady(): Promise<void> {
    return this.readyPromise;
  }

  /**
   * Send message to Codex (like typing in the terminal)
   */
  async write(message: string): Promise<void> {
    if (!this.pty) {
      throw new Error('PTY not started');
    }

    // Wait until Codex is ready before sending input
    await this.waitUntilReady();

    // Send message followed by Enter
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
   * Send interrupt (Ctrl+C)
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
    if (this.sessionWatcher) {
      this.sessionWatcher();
      this.sessionWatcher = null;
    }

    if (this.sessionsDirWatcher) {
      this.sessionsDirWatcher();
      this.sessionsDirWatcher = null;
    }

    if (this.pty) {
      this.pty.kill();
      this.pty = null;
    }
  }
}
