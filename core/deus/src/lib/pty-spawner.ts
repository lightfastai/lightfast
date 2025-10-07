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
  onSessionDetected?: (sessionId: string, filePath: string) => void;
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
  private startupBuffer: string = ''; // Buffer for detecting ready state

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
      },
    });

    // Set up project directory watcher to detect new conversation files
    this.projectDirWatcher = watchProjectDir(
      this.projectPath,
      (sessionId, filePath) => {
        if (process.env.DEBUG) {
          console.log(`[PTY Spawner] Detected conversation file: sessionId=${sessionId}, path=${filePath}`);
        }

        if (!this.sessionId) {
          this.sessionId = sessionId;
          this.options.onSessionDetected?.(sessionId, filePath);
          this.startWatchingConversation(filePath);
        }
      }
    );

    // Handle PTY data (raw output with ANSI codes)
    this.pty.onData((data: string) => {
      if (process.env.DEBUG && !this.isReady) {
        console.log(`[PTY Spawner] onData called, data length: ${data.length}`);
      }

      // Pass raw data to consumer for real-time display
      this.options.onData?.(data);

      // Detect when Claude is ready for input by buffering startup output
      if (!this.isReady) {
        // Add to buffer (keep last 2000 chars to avoid memory issues)
        this.startupBuffer += data;
        if (this.startupBuffer.length > 2000) {
          this.startupBuffer = this.startupBuffer.slice(-2000);
        }

        if (process.env.DEBUG) {
          console.log(`[PTY Spawner] Added to buffer, new length: ${this.startupBuffer.length}`);
        }

        // Check buffer for ready indicators
        // With vim mode disabled, look for the prompt (> or Try "...")
        // Or just mark ready after seeing the Claude banner
        const hasInsertMode = this.startupBuffer.includes('-- INSERT --');
        const hasTryPrompt = this.startupBuffer.includes('Try "');
        const hasBanner = this.startupBuffer.includes('Claude Code v');

        // Debug: log buffer when it's getting large
        if (process.env.DEBUG && this.startupBuffer.length > 500 && this.startupBuffer.length < 550) {
          const clean = this.startupBuffer.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
          console.log(`[PTY Spawner] Buffer @${this.startupBuffer.length}: ${clean.slice(0, 300)}`);
          console.log(`[PTY Spawner] Checking: hasInsertMode=${hasInsertMode}, hasTryPrompt=${hasTryPrompt}, hasBanner=${hasBanner}`);
        }

        if (process.env.DEBUG && (hasInsertMode || hasTryPrompt || hasBanner)) {
          console.log(`[PTY Spawner] Found ready indicator! INSERT=${hasInsertMode}, TRY=${hasTryPrompt}, BANNER=${hasBanner}`);
          console.log(`[PTY Spawner] Buffer sample: ${this.startupBuffer.slice(0, 200).replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')}`);
        }

        if (hasInsertMode || hasTryPrompt || hasBanner) {
          if (process.env.DEBUG) {
            console.log(`[PTY Spawner] Ready detected in buffer! Setting isReady=true`);
          }
          this.isReady = true;
          this.resolveReady();
          // Clear buffer after detecting ready
          this.startupBuffer = '';
        }
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
    if (process.env.DEBUG) {
      console.log(`[PTY Spawner] Starting to watch conversation file: ${filePath}`);
    }

    this.conversationWatcher = watchConversation(filePath, (message: ClaudeMessage) => {
      if (process.env.DEBUG) {
        console.log(`[PTY Spawner] Received conversation event: type=${message.type}`);
      }

      const text = extractMessageText(message);
      if (!text) {
        if (process.env.DEBUG) {
          console.log(`[PTY Spawner] No text extracted from message`);
        }
        return;
      }

      if (process.env.DEBUG) {
        console.log(`[PTY Spawner] Extracted text: ${text.slice(0, 50)}...`);
      }

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
    // TEMPORARY: Use fixed delay instead of pattern detection
    // Pattern detection has issues with chunked PTY data
    if (!this.isReady) {
      if (process.env.DEBUG) {
        console.log(`[PTY Spawner] Waiting 3 seconds for Claude to be ready...`);
      }
      await new Promise(resolve => setTimeout(resolve, 3000));
      this.isReady = true;
      if (process.env.DEBUG) {
        console.log(`[PTY Spawner] Done waiting, assuming ready`);
      }
    }
    return Promise.resolve();
  }

  /**
   * Send message to Claude (like typing in the terminal)
   */
  async write(message: string): Promise<void> {
    if (!this.pty) {
      throw new Error('PTY not started');
    }

    if (process.env.DEBUG) {
      console.log(`[PTY Spawner] write() called, isReady=${this.isReady}`);
    }

    // Wait until Claude is ready before sending input
    await this.waitUntilReady();

    if (process.env.DEBUG) {
      console.log(`[PTY Spawner] Ready! Writing message: "${message}"`);
    }

    // Create a buffer to track output after our input
    let outputBuffer = '';
    const outputHandler = (data: string) => {
      outputBuffer += data;
      if (process.env.DEBUG) {
        console.log(`[PTY Spawner] Output after input: ${data.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').trim()}`);
      }
    };

    const originalHandler = this.pty.onData(outputHandler);

    try {
      // Try typing character-by-character to simulate human input
      if (process.env.DEBUG) {
        console.log(`[PTY Spawner] Typing "${message}" character-by-character...`);
      }

      for (let i = 0; i < message.length; i++) {
        const char = message[i];
        if (process.env.DEBUG && i === 0) {
          console.log(`[PTY Spawner] First char: "${char}" (code: ${char?.charCodeAt(0)})`);
        }
        this.pty.write(char as string);
        await new Promise(resolve => setTimeout(resolve, 10)); // 10ms between chars
      }

      if (process.env.DEBUG) {
        console.log(`[PTY Spawner] Message typed, waiting 100ms before Enter`);
        console.log(`[PTY Spawner] Output buffer so far: ${outputBuffer.slice(0, 100)}`);
      }

      // Wait a bit before sending Enter
      await new Promise(resolve => setTimeout(resolve, 100));

      if (process.env.DEBUG) {
        console.log(`[PTY Spawner] Sending Enter (\\r) to submit`);
      }

      // With vim mode disabled, plain Enter submits (shortcuts show \↵ for newline)
      this.pty.write('\r'); // Enter/Return to submit

      // Wait to see if we get any response
      await new Promise(resolve => setTimeout(resolve, 500));

      if (process.env.DEBUG) {
        console.log(`[PTY Spawner] Enter sent, output buffer after 500ms: ${outputBuffer.slice(-200)}`);
      }
    } finally {
      originalHandler.dispose();
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
