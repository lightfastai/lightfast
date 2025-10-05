import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Claude conversation file manager
 * Handles reading/writing/watching .jsonl conversation files
 */

export interface ClaudeMessage {
  type: 'user' | 'assistant' | 'summary';
  message?: {
    role: 'user' | 'assistant';
    content: Array<{ type: string; text: string }>;
  };
  uuid: string;
  parentUuid: string | null;
  sessionId: string;
  cwd: string;
  timestamp: string;
  version?: string;
  gitBranch?: string;
  summary?: string;
  leafUuid?: string;
}

/**
 * Encode project path for .claude directory structure
 * Example: /Users/foo/project -> -Users-foo-project
 */
export function encodeProjectPath(projectPath: string): string {
  return projectPath.replace(/\//g, '-');
}

/**
 * Get path to conversation file
 */
export function getConversationPath(projectPath: string, sessionId: string): string {
  const encoded = encodeProjectPath(projectPath);
  return path.join(os.homedir(), '.claude', 'projects', encoded, `${sessionId}.jsonl`);
}

/**
 * Get project directory path in .claude
 */
export function getProjectDir(projectPath: string): string {
  const encoded = encodeProjectPath(projectPath);
  return path.join(os.homedir(), '.claude', 'projects', encoded);
}

/**
 * Parse a single JSONL line into ClaudeMessage
 */
export function parseMessage(line: string): ClaudeMessage | null {
  try {
    const json = JSON.parse(line.trim());
    return json as ClaudeMessage;
  } catch (error) {
    return null;
  }
}

/**
 * Read all messages from a conversation file
 */
export async function readConversation(filePath: string): Promise<ClaudeMessage[]> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    return lines.map(parseMessage).filter((m): m is ClaudeMessage => m !== null);
  } catch (error) {
    // File might not exist yet
    return [];
  }
}

/**
 * Watch a conversation file for new messages
 */
export function watchConversation(
  filePath: string,
  callback: (message: ClaudeMessage) => void
): () => void {
  let lastSize = 0;

  // Get initial size
  try {
    const stats = fs.statSync(filePath);
    lastSize = stats.size;
  } catch {
    // File doesn't exist yet
  }

  const watcher = fs.watch(filePath, async (eventType) => {
    if (eventType === 'change') {
      try {
        const stats = fs.statSync(filePath);
        const currentSize = stats.size;

        if (currentSize > lastSize) {
          // Read only new content
          const stream = fs.createReadStream(filePath, {
            start: lastSize,
            encoding: 'utf-8',
          });

          let buffer = '';
          stream.on('data', (chunk) => {
            buffer += chunk;
            const lines = buffer.split('\n');
            // Keep last incomplete line in buffer
            buffer = lines.pop() || '';

            for (const line of lines) {
              const message = parseMessage(line);
              if (message) {
                callback(message);
              }
            }
          });

          lastSize = currentSize;
        }
      } catch (error) {
        console.error('Error watching conversation:', error);
      }
    }
  });

  return () => watcher.close();
}

/**
 * Watch project directory for new conversation files
 */
export function watchProjectDir(
  projectPath: string,
  callback: (sessionId: string, filePath: string) => void
): () => void {
  const projectDir = getProjectDir(projectPath);

  // Ensure directory exists
  fs.mkdirSync(projectDir, { recursive: true });

  const watcher = fs.watch(projectDir, (eventType, filename) => {
    if (eventType === 'rename' && filename && filename.endsWith('.jsonl')) {
      const sessionId = filename.replace('.jsonl', '');
      const filePath = path.join(projectDir, filename);

      // Check if file was created (not deleted)
      try {
        if (fs.existsSync(filePath)) {
          callback(sessionId, filePath);
        }
      } catch {
        // Ignore errors
      }
    }
  });

  return () => watcher.close();
}

/**
 * Extract text content from Claude message
 */
export function extractMessageText(message: ClaudeMessage): string {
  if (message.type === 'summary' && message.summary) {
    return `[Summary: ${message.summary}]`;
  }

  if (message.message?.content) {
    return message.message.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n');
  }

  return '';
}

/**
 * Find the latest conversation file in project directory
 */
export async function findLatestConversation(projectPath: string): Promise<string | null> {
  const projectDir = getProjectDir(projectPath);

  try {
    const files = await fs.promises.readdir(projectDir);
    const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

    if (jsonlFiles.length === 0) return null;

    // Get stats for all files and sort by modification time
    const fileStats = await Promise.all(
      jsonlFiles.map(async (file) => {
        const filePath = path.join(projectDir, file);
        const stats = await fs.promises.stat(filePath);
        return { file, mtime: stats.mtime, path: filePath };
      })
    );

    fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    return fileStats[0]?.path || null;
  } catch {
    return null;
  }
}
