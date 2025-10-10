/**
 * Session Sync Service
 * Syncs CLI session state to the web app via API
 */

import type { AuthConfig } from '../config/profile-config.js';
import type { DeusSessionState } from '../../types/index.js';

/**
 * Queue item for offline sync
 */
interface QueuedEvent {
  type: 'create' | 'message' | 'update';
  timestamp: string;
  payload: unknown;
}

/**
 * Session creation payload
 */
interface CreateSessionPayload {
  sessionId: string;
  status: string;
  metadata: {
    cwd: string;
    branch?: string;
  };
}

/**
 * Message sync payload
 */
interface MessagePayload {
  role: string;
  content: string;
  modelId?: string;
  metadata?: {
    agentType?: string;
    createdAt?: string;
  };
}

/**
 * Status update payload
 */
interface StatusUpdatePayload {
  status: string;
  currentAgent?: string;
}

/**
 * Session Sync Service
 * Handles syncing CLI session state to the web app
 */
export class SessionSyncService {
  private authConfig: AuthConfig;
  private syncQueue: QueuedEvent[] = [];
  private autoSyncInterval: NodeJS.Timeout | null = null;
  private isOnline = true;

  constructor(authConfig: AuthConfig) {
    this.authConfig = authConfig;
  }

  /**
   * Create session on web app
   */
  async createSession(session: DeusSessionState): Promise<void> {
    const payload: CreateSessionPayload = {
      sessionId: session.sessionId,
      status: session.status,
      metadata: session.metadata,
    };

    await this.syncEvent('create', payload, async () => {
      const response = await fetch(
        `${this.authConfig.apiUrl}/api/trpc/session.create`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.authConfig.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.status} ${response.statusText}`);
      }
    });
  }

  /**
   * Sync message to web app
   */
  async syncMessage(
    sessionId: string,
    role: string,
    content: string,
    modelId?: string,
    agentType?: string
  ): Promise<void> {
    const payload: MessagePayload = {
      role,
      content,
      modelId,
      metadata: {
        agentType,
        createdAt: new Date().toISOString(),
      },
    };

    await this.syncEvent('message', { sessionId, ...payload }, async () => {
      const response = await fetch(
        `${this.authConfig.apiUrl}/api/trpc/session.addMessage`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.authConfig.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sessionId, ...payload }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to sync message: ${response.status} ${response.statusText}`);
      }
    });
  }

  /**
   * Update session status on web app
   */
  async updateStatus(
    sessionId: string,
    status: string,
    currentAgent?: string
  ): Promise<void> {
    const payload: StatusUpdatePayload = {
      status,
      currentAgent,
    };

    await this.syncEvent('update', { sessionId, ...payload }, async () => {
      const response = await fetch(
        `${this.authConfig.apiUrl}/api/trpc/session.update`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.authConfig.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sessionId, ...payload }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update status: ${response.status} ${response.statusText}`);
      }
    });
  }

  /**
   * Generic event sync with offline queue support
   */
  private async syncEvent(
    type: QueuedEvent['type'],
    payload: unknown,
    syncFn: () => Promise<void>
  ): Promise<void> {
    try {
      // Try to sync immediately
      await syncFn();

      // Mark as online
      if (!this.isOnline) {
        this.isOnline = true;
        if (process.env.DEBUG) {
          console.log('[SessionSync] Back online, processing queue...');
        }
        await this.processQueue();
      }
    } catch (error) {
      // Log error but don't throw (graceful degradation)
      if (process.env.DEBUG) {
        console.error(
          `[SessionSync] Failed to sync ${type}:`,
          error instanceof Error ? error.message : String(error)
        );
      }

      // Queue for later retry
      this.syncQueue.push({
        type,
        timestamp: new Date().toISOString(),
        payload,
      });

      this.isOnline = false;
    }
  }

  /**
   * Process queued events
   */
  private async processQueue(): Promise<void> {
    if (this.syncQueue.length === 0) {
      return;
    }

    const queue = [...this.syncQueue];
    this.syncQueue = [];

    for (const event of queue) {
      try {
        if (event.type === 'create') {
          const payload = event.payload as CreateSessionPayload;
          await this.createSession(payload as unknown as DeusSessionState);
        } else if (event.type === 'message') {
          const payload = event.payload as { sessionId: string } & MessagePayload;
          await this.syncMessage(
            payload.sessionId,
            payload.role,
            payload.content,
            payload.modelId,
            payload.metadata?.agentType
          );
        } else if (event.type === 'update') {
          const payload = event.payload as { sessionId: string } & StatusUpdatePayload;
          await this.updateStatus(payload.sessionId, payload.status, payload.currentAgent);
        }
      } catch (error) {
        // If still failing, put back in queue
        this.syncQueue.push(event);
        this.isOnline = false;
        break;
      }
    }
  }

  /**
   * Start auto-sync background process
   */
  startAutoSync(sessionId: string): void {
    if (this.autoSyncInterval) {
      this.stopAutoSync();
    }

    // Auto-sync every 5 seconds
    this.autoSyncInterval = setInterval(async () => {
      if (this.syncQueue.length > 0) {
        if (process.env.DEBUG) {
          console.log(`[SessionSync] Auto-sync: ${this.syncQueue.length} queued events`);
        }
        await this.processQueue();
      }
    }, 5000);

    if (process.env.DEBUG) {
      console.log('[SessionSync] Auto-sync started');
    }
  }

  /**
   * Stop auto-sync background process
   */
  stopAutoSync(): void {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
      if (process.env.DEBUG) {
        console.log('[SessionSync] Auto-sync stopped');
      }
    }
  }

  /**
   * Check if online
   */
  isServiceOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.syncQueue.length;
  }
}
