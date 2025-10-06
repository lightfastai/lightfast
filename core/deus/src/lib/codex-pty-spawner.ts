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

    if (process.env.DEBUG) {
      console.log(`[Codex PTY Spawner] Starting command: ${command}`);
      console.log(`[Codex PTY Spawner] CWD: ${this.projectPath}`);
    }

    // Spawn Codex in PTY (full interactive mode)
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
        console.error(`[Codex PTY Spawner] Failed to spawn PTY:`, error);
      }
      throw new Error(`Failed to spawn ${command}: ${errorMsg}`);
    }

    // Send initial cursor position response IMMEDIATELY to prevent timeout
    // Codex queries cursor position on startup and will exit if no response
    this.pty.write('\x1b[1;1R'); // Row 1, Column 1

    // Set up sessions directory watcher to detect new session files
    this.sessionsDirWatcher = watchSessionsDir(
      (sessionId, filePath) => {
        // Only set session ID and notify if not already set
        if (!this.sessionId) {
          this.sessionId = sessionId;
          this.options.onSessionDetected?.(sessionId);
        }

        // Always start watching the session file when detected
        // (even if session ID was already detected from PTY output)
        if (!this.sessionWatcher) {
          this.startWatchingSession(filePath);
        }
      }
    );

    // Handle PTY data (raw output with ANSI codes)
    this.pty.onData((data: string) => {
      // Respond to cursor position queries (CPR) to prevent Codex from timing out
      // Codex sends ESC[6n on startup and expects ESC[row;colR response
      if (data.includes('\x1b[6n')) {
        if (process.env.DEBUG) {
          console.log(`[Codex PTY Spawner] Detected cursor position query, responding with ESC[1;1R`);
        }
        this.pty?.write('\x1b[1;1R'); // Row 1, Column 1
      }

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
    if (process.env.DEBUG) {
      console.log(`[Codex PTY Spawner] Starting to watch session file: ${filePath}`);
    }

    this.sessionWatcher = watchSession(filePath, (event: CodexSessionEvent) => {
      if (process.env.DEBUG) {
        console.log(`[Codex PTY Spawner] Received session event: type=${event.type}, role=${event.payload?.role}`);
      }

      const text = extractEventText(event);
      if (!text) {
        if (process.env.DEBUG) {
          console.log(`[Codex PTY Spawner] No text extracted from event`);
        }
        return;
      }

      if (process.env.DEBUG) {
        console.log(`[Codex PTY Spawner] Extracted text: ${text.slice(0, 50)}...`);
      }

      // Emit structured events from the session file
      // Use event_msg for real-time assistant responses (comes first, faster feedback)
      if (event.type === 'event_msg' && event.payload?.type === 'agent_message') {
        if (process.env.DEBUG) {
          console.log(`[Codex PTY Spawner] Emitting assistant message from event_msg`);
        }
        this.options.onMessage?.('assistant', text);
      }
      // Only emit from response_item if it's a user message (for reference)
      else if (event.type === 'response_item') {
        const role = event.payload?.role;
        if (role === 'user') {
          // Don't emit user messages (already added by sendToAgent)
          // this.options.onMessage?.('user', text);
        }
        // Skip assistant messages from response_item to avoid duplicates
        // (already handled by event_msg above)
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
    // TEMPORARY: Use fixed delay instead of pattern detection
    // Pattern detection has issues with chunked PTY data (same as Claude Code)
    if (!this.isReady) {
      if (process.env.DEBUG) {
        console.log(`[Codex PTY Spawner] Waiting 3 seconds for Codex to be ready...`);
      }
      await new Promise(resolve => setTimeout(resolve, 3000));
      this.isReady = true;
      if (process.env.DEBUG) {
        console.log(`[Codex PTY Spawner] Done waiting, assuming ready`);
      }
    }
    return Promise.resolve();
  }

  /**
   * Send message to Codex (like typing in the terminal)
   */
  async write(message: string): Promise<void> {
    if (!this.pty) {
      throw new Error('PTY not started');
    }

    if (process.env.DEBUG) {
      console.log(`[Codex PTY Spawner] write() called`);
    }

    // Wait until Codex is ready before sending input
    await this.waitUntilReady();

    if (process.env.DEBUG) {
      console.log(`[Codex PTY Spawner] Ready! Writing message: "${message}"`);
    }

    // Try typing character-by-character to simulate human input
    for (const char of message) {
      this.pty.write(char);
      await new Promise(resolve => setTimeout(resolve, 10)); // 10ms between chars
    }

    if (process.env.DEBUG) {
      console.log(`[Codex PTY Spawner] Message typed, waiting 200ms before Enter`);
    }

    // Wait a bit before sending Enter to ensure input is fully registered
    await new Promise(resolve => setTimeout(resolve, 200));

    if (process.env.DEBUG) {
      console.log(`[Codex PTY Spawner] Sending Enter to submit`);
    }

    // Send message followed by Enter
    this.pty.write('\r'); // Carriage return (Enter key)

    // Wait to see if the message submits
    await new Promise(resolve => setTimeout(resolve, 500));

    if (process.env.DEBUG) {
      console.log(`[Codex PTY Spawner] Enter sent, waiting for response`);
    }

    if (process.env.DEBUG) {
      console.log(`[Codex PTY Spawner] Enter sent`);
    }
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
