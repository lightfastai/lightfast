/**
 * Session Sync Service
 * Syncs CLI session state to the web app via API
 */

import type { Config } from '../config/config.js';
import type { DeusSessionState } from '../../types/index.js';
import { trpcMutation } from '../api/trpc-client.js';

/**
 * Queue item for offline sync
 */
interface QueuedEvent {
  type: 'create' | 'message' | 'update';
  timestamp: string;
  payload: unknown;
}

/**
 * Session Sync Service
 * Handles syncing CLI session state to the web app
 */
export class SessionSyncService {
  private authConfig: Config & { apiUrl: string };
  private syncQueue: QueuedEvent[] = [];
  private autoSyncInterval: NodeJS.Timeout | null = null;
  private isOnline = true;

  constructor(authConfig: Config & { apiUrl: string }) {
    this.authConfig = authConfig;
  }

  /**
   * Create session on web app
   */
  async createSession(session: DeusSessionState): Promise<void> {
    if (!this.authConfig.defaultOrgId) {
      throw new Error('No default organization set. Run: deus auth login');
    }

    // Transform to API format
    // Note: userId comes from API key authentication context
    const payload = {
      id: session.sessionId,
      organizationId: this.authConfig.defaultOrgId,
      cwd: session.metadata.cwd,
      metadata: {
        status: session.status,
        ...session.metadata,
      },
    };

    await this.syncEvent('create', payload, async () => {
      await trpcMutation('session.create', payload, this.authConfig.apiKey!);
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
    // Transform to API format (parts-based message)
    const payload = {
      sessionId,
      role: role as "system" | "user" | "assistant",
      parts: [{ type: "text" as const, text: content }],
      modelId,
    };

    await this.syncEvent('message', payload, async () => {
      await trpcMutation('session.addMessage', payload, this.authConfig.apiKey!);
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
    const payload = {
      id: sessionId,
      status,
      currentAgent: currentAgent ?? null,
    };

    await this.syncEvent('update', payload, async () => {
      await trpcMutation('session.update', payload, this.authConfig.apiKey!);
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
        // Payloads are already in tRPC format, just need to call the right endpoint
        if (event.type === 'create') {
          await trpcMutation('session.create', event.payload, this.authConfig.apiKey!);
        } else if (event.type === 'message') {
          await trpcMutation('session.addMessage', event.payload, this.authConfig.apiKey!);
        } else if (event.type === 'update') {
          await trpcMutation('session.update', event.payload, this.authConfig.apiKey!);
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
