import { BasePtySpawner, type BasePtySpawnerOptions, stripAnsi } from './base-spawner.js';
import { watchSessionsDir, watchSession, type CodexSessionEvent, extractEventText } from '../sync/codex-sync.js';

/**
 * Codex PTY Spawner
 * Runs Codex in interactive mode with full features
 */

export interface CodexPtySpawnerOptions extends BasePtySpawnerOptions {
  // No additional options needed for now
}

export class CodexPtySpawner extends BasePtySpawner {
  private sessionWatcher: (() => void) | null = null;

  constructor(options: CodexPtySpawnerOptions) {
    super(options);
  }

  /**
   * Get command to execute
   */
  protected getCommand(): string {
    return this.options.command || process.env.CODEX_COMMAND || 'codex';
  }

  /**
   * Get agent name for logging
   */
  protected getAgentName(): string {
    return 'Codex';
  }

  /**
   * Called immediately after PTY is created
   * Codex requires cursor position response
   */
  protected onPtyCreated(): void {
    if (!this.pty) return;

    // Send initial cursor position response IMMEDIATELY to prevent timeout
    // Codex queries cursor position on startup and will exit if no response
    this.pty.write('\x1b[1;1R'); // Row 1, Column 1

    if (process.env.DEBUG) {
      console.log(`[Codex Spawner] Sent initial cursor position response`);
    }
  }

  /**
   * Set up file watchers for session detection
   */
  protected setupFileWatchers(): void {
    // Watch sessions directory for new session files
    const sessionsDirWatcher = watchSessionsDir(
      (sessionId, filePath) => {
        if (process.env.DEBUG) {
          console.log(`[Codex Spawner] Detected session file: sessionId=${sessionId}, path=${filePath}`);
        }

        // Only set session ID and notify if not already set
        if (!this.sessionId) {
          this.sessionId = sessionId;
          this.options.onSessionDetected?.(sessionId, filePath);
        }

        // Always start watching the session file when detected
        if (!this.sessionWatcher) {
          this.startWatchingSession(filePath);
        }
      }
    );

    this.watchers.push(sessionsDirWatcher);
  }

  /**
   * Start watching session file for structured events
   */
  private startWatchingSession(filePath: string): void {
    if (process.env.DEBUG) {
      console.log(`[Codex Spawner] Starting to watch session file: ${filePath}`);
    }

    this.sessionWatcher = watchSession(filePath, (event: CodexSessionEvent) => {
      if (process.env.DEBUG) {
        console.log(`[Codex Spawner] Received session event: type=${event.type}`);
      }

      const text = extractEventText(event);
      if (!text) {
        return;
      }

      if (process.env.DEBUG) {
        console.log(`[Codex Spawner] Extracted text: ${text.slice(0, 50)}...`);
      }

      // Emit structured events from the session file
      // Use event_msg for real-time assistant responses
      if (event.type === 'event_msg' && event.payload?.type === 'agent_message') {
        this.options.onMessage?.('assistant', text);
      }
      // Handle session metadata
      else if (event.type === 'session_meta') {
        const sessionId = event.payload?.id;
        if (sessionId) {
          this.options.onMessage?.('system', `[Codex Session: ${sessionId.substring(0, 8)}...]`);
        }
      }
      // Note: We don't emit user messages from response_item to avoid duplicates
      // (they're already added by sendToAgent)
    });

    this.watchers.push(() => {
      if (this.sessionWatcher) {
        this.sessionWatcher();
        this.sessionWatcher = null;
      }
    });
  }

  /**
   * Handle incoming PTY data
   * Codex needs cursor position query responses
   */
  protected onDataReceived(data: string): void {
    // Respond to cursor position queries (CPR) to prevent Codex from timing out
    // Codex sends ESC[6n on startup and expects ESC[row;colR response
    if (data.includes('\x1b[6n')) {
      if (process.env.DEBUG) {
        console.log(`[Codex Spawner] Detected cursor position query, responding`);
      }
      this.pty?.write('\x1b[1;1R'); // Row 1, Column 1
    }

    // Log for debugging
    if (process.env.DEBUG) {
      const clean = stripAnsi(data);
      if (clean.trim()) {
        console.log(`[Codex PTY]`, clean);
      }
    }
  }

  /**
   * Check if data contains ready pattern
   */
  protected isReadyPattern(data: string): boolean {
    // Codex shows ">" prompt when ready
    return data.includes('>');
  }
}
