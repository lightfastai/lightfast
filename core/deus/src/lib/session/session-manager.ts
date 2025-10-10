import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { nanoid } from 'nanoid';
import {
  type SessionEvent,
  type DeusSessionState,
  type Task,
  type LinkedAgent,
  type AgentType,
  type SessionStatus,
} from '../../types/index.js';

/**
 * Deus Session Manager
 * Manages session state persistence using JSONL event sourcing
 */

/**
 * Get Deus sessions directory
 */
export function getDeusSessionsDir(): string {
  return path.join(os.homedir(), '.deus', 'sessions');
}

/**
 * Get path to session file
 */
export function getSessionFilePath(sessionId: string): string {
  return path.join(getDeusSessionsDir(), `${sessionId}.jsonl`);
}

/**
 * Parse a single JSONL line into SessionEvent
 */
export function parseSessionEvent(line: string): SessionEvent | null {
  try {
    const json = JSON.parse(line.trim());
    return json as SessionEvent;
  } catch (error) {
    return null;
  }
}

/**
 * Read all events from a session file
 */
export async function readSessionEvents(sessionId: string): Promise<SessionEvent[]> {
  const filePath = getSessionFilePath(sessionId);

  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    return lines.map(parseSessionEvent).filter((e): e is SessionEvent => e !== null);
  } catch (error) {
    // File might not exist yet
    return [];
  }
}

/**
 * Append an event to session file
 */
export async function appendSessionEvent(sessionId: string, event: SessionEvent): Promise<void> {
  const filePath = getSessionFilePath(sessionId);
  const sessionsDir = getDeusSessionsDir();

  // Ensure directory exists
  await fs.promises.mkdir(sessionsDir, { recursive: true });

  // Append event as JSONL
  const line = JSON.stringify(event) + '\n';
  await fs.promises.appendFile(filePath, line, 'utf-8');
}

/**
 * Reconstruct session state from events
 */
export function reconstructSessionState(
  sessionId: string,
  events: SessionEvent[]
): DeusSessionState {
  const state: DeusSessionState = {
    sessionId,
    status: 'active',
    linkedAgents: [],
    tasks: [],
    sharedContext: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: {
      cwd: process.cwd(),
    },
  };

  for (const event of events) {
    // Update timestamps
    state.updatedAt = event.timestamp;

    switch (event.type) {
      case 'session_created':
        state.createdAt = event.timestamp;
        state.metadata = event.metadata;
        break;

      case 'agent_linked': {
        // Check if agent already linked
        const existing = state.linkedAgents.find(
          a => a.agentType === event.agentType && a.sessionId === event.sessionId
        );
        if (!existing) {
          state.linkedAgents.push({
            agentType: event.agentType,
            sessionId: event.sessionId,
            filePath: event.filePath,
            linkedAt: event.timestamp,
          });
        }
        break;
      }

      case 'agent_unlinked':
        state.linkedAgents = state.linkedAgents.filter(
          a => !(a.agentType === event.agentType && a.sessionId === event.sessionId)
        );
        break;

      case 'status_changed':
        state.status = event.status;
        break;

      case 'task_added':
        state.tasks.push(event.task);
        break;

      case 'task_updated': {
        const task = state.tasks.find(t => t.id === event.taskId);
        if (task && event.updates) {
          if (event.updates.status) task.status = event.updates.status;
          if (event.updates.content) task.content = event.updates.content;
          if (event.updates.activeForm) task.activeForm = event.updates.activeForm;
        }
        break;
      }

      case 'context_shared':
        state.sharedContext[event.key] = event.value;
        break;

      case 'agent_switched':
        // This is informational, doesn't change state structure
        break;
    }
  }

  return state;
}

/**
 * Session Manager Class
 * Manages a single Deus session with event sourcing
 */
export class SessionManager {
  private sessionId: string;
  private state: DeusSessionState | null = null;
  private listeners: Set<(state: DeusSessionState) => void> = new Set();

  constructor(sessionId?: string) {
    this.sessionId = sessionId || randomUUID();
  }

  /**
   * Initialize or load existing session
   */
  async initialize(): Promise<void> {
    const events = await readSessionEvents(this.sessionId);

    if (events.length === 0) {
      // New session - create it
      const createEvent: SessionEvent = {
        type: 'session_created',
        timestamp: new Date().toISOString(),
        metadata: {
          cwd: process.cwd(),
          // TODO: Add git branch detection
        },
      };

      await this.appendEvent(createEvent);
      this.state = reconstructSessionState(this.sessionId, [createEvent]);
    } else {
      // Existing session - reconstruct state
      this.state = reconstructSessionState(this.sessionId, events);
    }

    this.emit();
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Get current state
   */
  getState(): DeusSessionState | null {
    return this.state;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: DeusSessionState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Emit state changes to listeners
   */
  private emit(): void {
    if (this.state) {
      this.listeners.forEach((listener) => listener(this.state!));
    }
  }

  /**
   * Append event and update state
   */
  private async appendEvent(event: SessionEvent): Promise<void> {
    await appendSessionEvent(this.sessionId, event);

    // Update state
    const events = await readSessionEvents(this.sessionId);
    this.state = reconstructSessionState(this.sessionId, events);
    this.emit();
  }

  /**
   * Link an agent session
   */
  async linkAgent(agentType: AgentType, sessionId: string, filePath: string): Promise<void> {
    const event: SessionEvent = {
      type: 'agent_linked',
      timestamp: new Date().toISOString(),
      agentType,
      sessionId,
      filePath,
    };

    await this.appendEvent(event);
  }

  /**
   * Unlink an agent session
   */
  async unlinkAgent(agentType: AgentType, sessionId: string): Promise<void> {
    const event: SessionEvent = {
      type: 'agent_unlinked',
      timestamp: new Date().toISOString(),
      agentType,
      sessionId,
    };

    await this.appendEvent(event);
  }

  /**
   * Update session status
   */
  async updateStatus(status: SessionStatus): Promise<void> {
    const event: SessionEvent = {
      type: 'status_changed',
      timestamp: new Date().toISOString(),
      status,
    };

    await this.appendEvent(event);
  }

  /**
   * Add a task
   */
  async addTask(content: string, activeForm: string): Promise<string> {
    const task: Task = {
      id: nanoid(),
      content,
      activeForm,
      status: 'pending',
      timestamp: new Date().toISOString(),
    };

    const event: SessionEvent = {
      type: 'task_added',
      timestamp: new Date().toISOString(),
      task,
    };

    await this.appendEvent(event);
    return task.id;
  }

  /**
   * Update a task
   */
  async updateTask(
    taskId: string,
    updates: {
      status?: 'pending' | 'in_progress' | 'completed';
      content?: string;
      activeForm?: string;
    }
  ): Promise<void> {
    const event: SessionEvent = {
      type: 'task_updated',
      timestamp: new Date().toISOString(),
      taskId,
      updates,
    };

    await this.appendEvent(event);
  }

  /**
   * Share context
   */
  async shareContext(key: string, value: unknown): Promise<void> {
    const event: SessionEvent = {
      type: 'context_shared',
      timestamp: new Date().toISOString(),
      key,
      value,
    };

    await this.appendEvent(event);
  }

  /**
   * Record agent switch
   */
  async recordAgentSwitch(from: AgentType, to: AgentType): Promise<void> {
    const event: SessionEvent = {
      type: 'agent_switched',
      timestamp: new Date().toISOString(),
      from,
      to,
    };

    await this.appendEvent(event);
  }

  /**
   * Get linked agents
   */
  getLinkedAgents(): LinkedAgent[] {
    return this.state?.linkedAgents || [];
  }

  /**
   * Get tasks
   */
  getTasks(): Task[] {
    return this.state?.tasks || [];
  }

  /**
   * Get shared context
   */
  getSharedContext(): Record<string, unknown> {
    return this.state?.sharedContext || {};
  }

  /**
   * Watch session file for external changes
   */
  watchSession(callback: (state: DeusSessionState) => void): () => void {
    const filePath = getSessionFilePath(this.sessionId);
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
            // Reload state from file
            const events = await readSessionEvents(this.sessionId);
            this.state = reconstructSessionState(this.sessionId, events);
            callback(this.state);
          }

          lastSize = currentSize;
        } catch (error) {
          console.error('Error watching session:', error);
        }
      }
    });

    return () => watcher.close();
  }
}

/**
 * Find the latest session file
 */
export async function findLatestSession(): Promise<string | null> {
  const sessionsDir = getDeusSessionsDir();

  try {
    if (!fs.existsSync(sessionsDir)) return null;

    const files = await fs.promises.readdir(sessionsDir);
    const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

    if (jsonlFiles.length === 0) return null;

    // Get stats for all files and sort by modification time
    const fileStats = await Promise.all(
      jsonlFiles.map(async (file) => {
        const filePath = path.join(sessionsDir, file);
        const stats = await fs.promises.stat(filePath);
        return { file, mtime: stats.mtime, sessionId: file.replace('.jsonl', '') };
      })
    );

    fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    return fileStats[0]?.sessionId || null;
  } catch {
    return null;
  }
}
