import { BasePtySpawner, type BasePtySpawnerOptions, stripAnsi } from './base-spawner.js';
import { watchProjectDir, watchConversation, type ClaudeMessage, extractMessageText } from '../sync/claude-sync.js';
import { logger } from '../utils/logger.js';

/**
 * Claude Code PTY Spawner
 * Runs Claude Code in full interactive mode with all features
 */

export interface ClaudePtySpawnerOptions extends BasePtySpawnerOptions {
  // No additional options needed for now
}

/**
 * Approval prompt detection state
 */
interface ApprovalDetectionState {
  isWaitingForApproval: boolean;
  bufferedData: string;
  lastEmitTime: number;
}

export class ClaudePtySpawner extends BasePtySpawner {
  private conversationWatcher: (() => void) | null = null;
  private approvalState: ApprovalDetectionState = {
    isWaitingForApproval: false,
    bufferedData: '',
    lastEmitTime: 0,
  };

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
        logger.debug('[Claude Spawner] Detected conversation file', { sessionId, filePath });

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
    logger.debug('[Claude Spawner] Starting to watch conversation file', { filePath });

    this.conversationWatcher = watchConversation(filePath, (message: ClaudeMessage) => {
      logger.debug('[Claude Spawner] Received conversation event', { type: message.type });

      const text = extractMessageText(message);
      if (!text) {
        return;
      }

      logger.debug('[Claude Spawner] Extracted text', { preview: text.slice(0, 50) });

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
   * Detects approval prompts and emits them to the UI
   */
  protected onDataReceived(data: string): void {
    // Log for debugging
    const clean = stripAnsi(data);
    if (clean.trim()) {
      logger.debug('[Claude Code PTY]', { data: clean });
    }

    // Buffer data for approval detection
    this.approvalState.bufferedData += data;

    // Check if this looks like an approval prompt
    if (this.isApprovalPrompt(this.approvalState.bufferedData)) {
      // Debounce - wait a bit for complete prompt to arrive
      const now = Date.now();
      const timeSinceLastEmit = now - this.approvalState.lastEmitTime;

      if (timeSinceLastEmit > 500 && !this.approvalState.isWaitingForApproval) {
        const approval = this.parseApprovalPrompt(this.approvalState.bufferedData);

        if (approval) {
          this.approvalState.isWaitingForApproval = true;
          this.approvalState.lastEmitTime = now;

          logger.debug('[Claude Spawner] Detected approval prompt', { prompt: approval.prompt });

          this.options.onApprovalRequest?.(approval);
        }

        // Clear buffer after detection
        this.approvalState.bufferedData = '';
      }
    } else {
      // Clear old buffer data if it's getting too large
      if (this.approvalState.bufferedData.length > 5000) {
        this.approvalState.bufferedData = this.approvalState.bufferedData.slice(-2000);
      }
    }
  }

  /**
   * Check if data contains an approval prompt
   *
   * Claude Code approval prompts have this format:
   * ╭─────────────────────────╮
   * │ Bash command           │
   * │ [command]              │
   * │ Do you want to proceed?│
   * │ ❯ 1. Yes              │
   * │   2. Yes, and don't... │
   * │   3. No, and tell...   │
   * ╰─────────────────────────╯
   *
   * Detection strategy: Look for box-drawing + "proceed?" + numbered options
   */
  private isApprovalPrompt(data: string): boolean {
    const clean = stripAnsi(data);

    // Detect box-drawing characters (approval prompts use Unicode boxes)
    const hasBoxDrawing = /[╭╮╰╯─│]/.test(clean);

    // Detect "Do you want to proceed?" text (standard question)
    const hasProceedQuestion = /do you want to proceed\?/i.test(clean);

    // Detect numbered options (1. Yes, 2. Yes and don't ask, 3. No)
    const hasNumberedOptions = /[❯\s]*\d+\.\s+(yes|no)/i.test(clean);

    // Detect tool type headers (Bash command, Edit, Write, etc.)
    const hasToolHeader = /(bash command|edit|write|read|webfetch)/i.test(clean);

    // Need at least 2 of these indicators to be confident it's an approval prompt
    // Usually we'll have all 4, but require at least 2 for robustness
    const indicators = [
      hasBoxDrawing,
      hasProceedQuestion,
      hasNumberedOptions,
      hasToolHeader,
    ].filter(Boolean).length;

    return indicators >= 2;
  }

  /**
   * Parse approval prompt from PTY data
   *
   * Claude Code format:
   * ╭─────────────────────────╮
   * │ [Tool Type]            │  <- Tool header (Bash command, Edit, etc.)
   * │                        │
   * │ [specific action]      │  <- Command or file being modified
   * │                        │
   * │ Do you want to proceed?│  <- Standard question
   * │ ❯ 1. Yes              │  <- Option 1 (approved)
   * │   2. Yes, and don't... │  <- Option 2 (approve + allow)
   * │   3. No, and tell...   │  <- Option 3 (reject)
   * ╰─────────────────────────╯
   */
  private parseApprovalPrompt(data: string): {
    prompt: string;
    options: string[];
    rawData: string;
  } | null {
    const clean = stripAnsi(data);
    const lines = clean.split('\n').map(l => l.trim()).filter(Boolean);

    // Find the "Do you want to proceed?" line
    const proceedLineIndex = lines.findIndex(l => /do you want to proceed\?/i.test(l));

    if (proceedLineIndex === -1) {
      return null;
    }

    // Find tool type (usually first substantive line after box top)
    const toolLine = lines.find(l =>
      /(bash command|edit|write|read|webfetch)/i.test(l) &&
      !l.match(/^[╭╮╰╯─│\s]+$/)
    );

    // Extract the command/action (lines between tool type and question)
    const toolIndex = toolLine ? lines.indexOf(toolLine) : 0;
    const commandLines = lines
      .slice(toolIndex + 1, proceedLineIndex)
      .filter(l => l && !l.match(/^[╭╮╰╯─│\s]+$/));  // Filter box-drawing lines

    // Build the prompt text
    const toolType = toolLine ? toolLine.trim() : '';
    const action = commandLines.join('\n').trim();
    const prompt = toolType && action ? `${toolType}\n${action}` : action || toolType;

    // Extract options (lines after the question)
    const optionLines = lines
      .slice(proceedLineIndex + 1)
      .filter(l => /[❯\s]*\d+\.\s+/.test(l));

    logger.debug('[Claude Spawner] Parsed approval', {
      toolType,
      actionPreview: action.slice(0, 50),
      optionsCount: optionLines.length,
    });

    // If prompt is too short, it's probably not a real approval prompt
    if (prompt.length < 5) {
      return null;
    }

    return {
      prompt,
      options: ['1', '2', '3'], // Numeric options for Claude Code
      rawData: clean,
    };
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

  /**
   * Send approval response to Claude Code
   *
   * Claude Code expects numeric options:
   * - 1 = Yes (approve)
   * - 2 = Yes, and don't ask again (approve + allow)
   * - 3 = No, and tell Claude what to do differently (reject)
   *
   * @param approved - true for yes/approve, false for no/reject
   */
  sendApproval(approved: boolean): void {
    if (!this.pty) {
      throw new Error('PTY not started');
    }

    // Use option 1 (Yes) or option 3 (No)
    const response = approved ? '1' : '3';

    logger.debug('[Claude Spawner] Sending approval response', {
      option: response,
      approved
    });

    // Send the numeric option followed by Enter
    this.pty.write(`${response}\r`);

    // Reset approval state
    this.approvalState.isWaitingForApproval = false;
    this.approvalState.bufferedData = '';
  }
}

// Re-export for backwards compatibility
export { stripAnsi, type ApprovalPrompt } from './base-spawner.js';
