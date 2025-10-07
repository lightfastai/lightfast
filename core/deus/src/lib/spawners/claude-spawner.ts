import { BasePtySpawner, type BasePtySpawnerOptions, stripAnsi } from './base-spawner.js';
import { watchProjectDir, watchConversation, type ClaudeMessage, extractMessageText } from '../sync/claude-sync.js';

/**
 * Claude Code PTY Spawner
 * Runs Claude Code in full interactive mode with all features
 */

export interface ClaudePtySpawnerOptions extends BasePtySpawnerOptions {
  // No additional options needed for now
}

export class ClaudePtySpawner extends BasePtySpawner {
  private conversationWatcher: (() => void) | null = null;

  constructor(options: ClaudePtySpawnerOptions) {
    super(options);
  }

  /**
   * Get command to execute
   */
  protected getCommand(): string {
    const envCommand = process.env.CLAUDE_CODE_COMMAND || process.env.CLAUDE_COMMAND;
    return this.options.command || envCommand || 'claude';
  }

  /**
   * Get agent name for logging
   */
  protected getAgentName(): string {
    return 'Claude Code';
  }

  /**
   * Called immediately after PTY is created
   * Claude Code doesn't need special initialization
   */
  protected onPtyCreated(): void {
    // No special initialization needed for Claude Code
  }

  /**
   * Set up file watchers for session detection
   */
  protected setupFileWatchers(): void {
    // Watch project directory for new conversation files
    const projectDirWatcher = watchProjectDir(
      this.projectPath,
      (sessionId, filePath) => {
        if (process.env.DEBUG) {
          console.log(`[Claude Spawner] Detected conversation file: sessionId=${sessionId}, path=${filePath}`);
        }

        if (!this.sessionId) {
          this.sessionId = sessionId;
          this.options.onSessionDetected?.(sessionId, filePath);
          this.startWatchingConversation(filePath);
        }
      }
    );

    this.watchers.push(projectDirWatcher);
  }

  /**
   * Start watching conversation file for structured messages
   */
  private startWatchingConversation(filePath: string): void {
    if (process.env.DEBUG) {
      console.log(`[Claude Spawner] Starting to watch conversation file: ${filePath}`);
    }

    this.conversationWatcher = watchConversation(filePath, (message: ClaudeMessage) => {
      if (process.env.DEBUG) {
        console.log(`[Claude Spawner] Received conversation event: type=${message.type}`);
      }

      const text = extractMessageText(message);
      if (!text) {
        return;
      }

      if (process.env.DEBUG) {
        console.log(`[Claude Spawner] Extracted text: ${text.slice(0, 50)}...`);
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

    this.watchers.push(() => {
      if (this.conversationWatcher) {
        this.conversationWatcher();
        this.conversationWatcher = null;
      }
    });
  }

  /**
   * Handle incoming PTY data
   * Claude Code doesn't need special handling
   */
  protected onDataReceived(data: string): void {
    // Log for debugging
    if (process.env.DEBUG) {
      const clean = stripAnsi(data);
      if (clean.trim()) {
        console.log(`[Claude Code PTY]`, clean);
      }
    }
  }

  /**
   * Check if data contains ready pattern
   */
  protected isReadyPattern(data: string): boolean {
    // Look for Claude Code ready indicators
    return (
      data.includes('-- INSERT --') ||
      data.includes('Try "') ||
      data.includes('Claude Code v')
    );
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
}

// Re-export for backwards compatibility
export { stripAnsi } from './base-spawner.js';
