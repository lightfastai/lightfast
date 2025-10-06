import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Codex session file manager
 * Handles reading/writing/watching .jsonl session files
 */

export interface CodexSessionEvent {
  timestamp: string;
  type: 'session_meta' | 'response_item' | 'tool_use' | 'tool_result';
  payload: any;
}

export interface CodexSessionMeta {
  id: string;
  timestamp: string;
  cwd: string;
  originator: string;
  cli_version: string;
  git?: {
    commit_hash: string;
    branch: string;
    repository_url: string;
  };
}

/**
 * Get Codex sessions directory
 */
export function getCodexSessionsDir(): string {
  return path.join(os.homedir(), '.codex', 'sessions');
}

/**
 * Get path to current date's session directory
 */
export function getTodaySessionDir(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return path.join(getCodexSessionsDir(), String(year), month, day);
}

/**
 * Parse session filename to extract session ID
 * Format: rollout-{timestamp}-{session_id}.jsonl
 */
export function parseSessionFilename(filename: string): string | null {
  const match = filename.match(/rollout-.*-([a-f0-9-]+)\.jsonl$/);
  return match && match[1] ? match[1] : null;
}

/**
 * Get path to session file by ID
 */
export async function findSessionFile(sessionId: string): Promise<string | null> {
  const sessionsDir = getCodexSessionsDir();

  try {
    // Search in recent dates (last 7 days)
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');

      const dayDir = path.join(sessionsDir, String(year), month, day);

      if (fs.existsSync(dayDir)) {
        const files = await fs.promises.readdir(dayDir);
        const sessionFile = files.find(f => f.includes(sessionId));

        if (sessionFile) {
          return path.join(dayDir, sessionFile);
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Parse a single JSONL line into CodexSessionEvent
 */
export function parseSessionEvent(line: string): CodexSessionEvent | null {
  try {
    const json = JSON.parse(line.trim());
    return json as CodexSessionEvent;
  } catch (error) {
    return null;
  }
}

/**
 * Read all events from a session file
 */
export async function readSession(filePath: string): Promise<CodexSessionEvent[]> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    return lines.map(parseSessionEvent).filter((e): e is CodexSessionEvent => e !== null);
  } catch (error) {
    return [];
  }
}

/**
 * Extract session metadata from events
 */
export function extractSessionMeta(events: CodexSessionEvent[]): CodexSessionMeta | null {
  const metaEvent = events.find(e => e.type === 'session_meta');
  return metaEvent?.payload as CodexSessionMeta || null;
}

/**
 * Watch a session file for new events
 */
export function watchSession(
  filePath: string,
  callback: (event: CodexSessionEvent) => void
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
              const event = parseSessionEvent(line);
              if (event) {
                callback(event);
              }
            }
          });

          lastSize = currentSize;
        }
      } catch (error) {
        console.error('Error watching session:', error);
      }
    }
  });

  return () => watcher.close();
}

/**
 * Watch sessions directory for new session files
 */
export function watchSessionsDir(
  callback: (sessionId: string, filePath: string) => void
): () => void {
  const todayDir = getTodaySessionDir();

  if (process.env.DEBUG) {
    console.log(`[codex-sync] Watching sessions directory: ${todayDir}`);
  }

  // Ensure directory exists
  fs.mkdirSync(todayDir, { recursive: true });

  const watcher = fs.watch(todayDir, (eventType, filename) => {
    if (process.env.DEBUG) {
      console.log(`[codex-sync] File event: type=${eventType}, filename=${filename}`);
    }

    if (eventType === 'rename' && filename && filename.endsWith('.jsonl')) {
      const sessionId = parseSessionFilename(filename);
      const filePath = path.join(todayDir, filename);

      if (process.env.DEBUG) {
        console.log(`[codex-sync] Detected session file: sessionId=${sessionId}, path=${filePath}`);
      }

      // Check if file was created (not deleted)
      if (sessionId) {
        try {
          if (fs.existsSync(filePath)) {
            if (process.env.DEBUG) {
              console.log(`[codex-sync] Session file exists, calling callback`);
            }
            callback(sessionId, filePath);
          }
        } catch (error) {
          if (process.env.DEBUG) {
            console.error(`[codex-sync] Error checking file:`, error);
          }
        }
      }
    }
  });

  return () => watcher.close();
}

/**
 * Extract text content from Codex event
 */
export function extractEventText(event: CodexSessionEvent): string {
  if (event.type === 'response_item' && event.payload?.content) {
    const content = event.payload.content;

    if (Array.isArray(content)) {
      return content
        .filter((c: any) => c.type === 'input_text' || c.type === 'output_text' || c.type === 'text')
        .map((c: any) => c.text)
        .join('\n');
    }

    if (typeof content === 'string') {
      return content;
    }
  }

  return '';
}

/**
 * Find the latest session file
 */
export async function findLatestSession(): Promise<string | null> {
  const todayDir = getTodaySessionDir();

  try {
    if (!fs.existsSync(todayDir)) return null;

    const files = await fs.promises.readdir(todayDir);
    const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

    if (jsonlFiles.length === 0) return null;

    // Get stats for all files and sort by modification time
    const fileStats = await Promise.all(
      jsonlFiles.map(async (file) => {
        const filePath = path.join(todayDir, file);
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
