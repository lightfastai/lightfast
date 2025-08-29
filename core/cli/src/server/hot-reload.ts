import { EventEmitter } from 'node:events';
import type { ConfigWatcher, WatcherEvents } from '../compiler/watcher.js';
import type { CompilationResult } from '../compiler/index.js';

export interface HotReloadOptions {
  /**
   * Configuration watcher instance
   */
  watcher: ConfigWatcher;
  
  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean;
}

export interface SSEMessage {
  type: 'compile-start' | 'compile-success' | 'compile-error' | 'config-added' | 'config-removed' | 'watcher-ready' | 'watcher-error' | 'ping';
  data?: any;
  timestamp: number;
}

export interface ClientConnection {
  id: string;
  response: Response;
  controller: ReadableStreamDefaultController;
  lastPing: number;
}

/**
 * Hot reload service that provides Server-Sent Events for configuration changes
 */
export class HotReloadService extends EventEmitter {
  private readonly watcher: ConfigWatcher;
  private readonly debug: boolean;
  private readonly connections = new Map<string, ClientConnection>();
  private pingInterval?: NodeJS.Timeout;
  
  constructor(options: HotReloadOptions) {
    super();
    
    this.watcher = options.watcher;
    this.debug = options.debug ?? false;
    
    this.setupWatcherListeners();
  }
  
  /**
   * Create a Server-Sent Events response for a client connection
   */
  createSSEResponse(request: Request): Response {
    const clientId = this.generateClientId();
    
    if (this.debug) {
      console.log(`[HotReload] New SSE connection: ${clientId}`);
    }
    
    const stream = new ReadableStream({
      start: (controller) => {
        // Store connection
        const connection: ClientConnection = {
          id: clientId,
          response: new Response(), // Will be replaced
          controller,
          lastPing: Date.now()
        };
        
        this.connections.set(clientId, connection);
        
        // Send initial connection message
        this.sendToClient(clientId, {
          type: 'watcher-ready',
          data: {
            watchedPaths: this.watcher.getWatchedPaths(),
            isCompiling: this.watcher.isCurrentlyCompiling()
          },
          timestamp: Date.now()
        });
        
        if (this.debug) {
          console.log(`[HotReload] Client ${clientId} connected, total clients: ${this.connections.size}`);
        }
      },
      
      cancel: () => {
        this.connections.delete(clientId);
        if (this.debug) {
          console.log(`[HotReload] Client ${clientId} disconnected, total clients: ${this.connections.size}`);
        }
      }
    });
    
    // Set up ping interval if this is the first connection
    if (this.connections.size === 1 && !this.pingInterval) {
      this.startPingInterval();
    }
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    });
  }
  
  /**
   * Get the number of active connections
   */
  getConnectionCount(): number {
    return this.connections.size;
  }
  
  /**
   * Get connection information
   */
  getConnectionInfo(): Array<{ id: string; lastPing: number }> {
    return Array.from(this.connections.values()).map(conn => ({
      id: conn.id,
      lastPing: conn.lastPing
    }));
  }
  
  /**
   * Broadcast a message to all connected clients
   */
  broadcast(message: Omit<SSEMessage, 'timestamp'>): void {
    const fullMessage: SSEMessage = {
      ...message,
      timestamp: Date.now()
    };
    
    if (this.debug) {
      console.log(`[HotReload] Broadcasting to ${this.connections.size} clients:`, fullMessage.type);
    }
    
    for (const [clientId] of this.connections) {
      this.sendToClient(clientId, fullMessage);
    }
  }
  
  /**
   * Send a message to a specific client
   */
  sendToClient(clientId: string, message: SSEMessage): void {
    const connection = this.connections.get(clientId);
    if (!connection) {
      return;
    }
    
    try {
      const sseData = this.formatSSEMessage(message);
      connection.controller.enqueue(new TextEncoder().encode(sseData));
      connection.lastPing = Date.now();
      
    } catch (error) {
      if (this.debug) {
        console.warn(`[HotReload] Failed to send message to client ${clientId}:`, error);
      }
      
      // Remove failed connection
      this.connections.delete(clientId);
    }
  }
  
  /**
   * Disconnect all clients and stop the service
   */
  disconnect(): void {
    if (this.debug) {
      console.log(`[HotReload] Disconnecting ${this.connections.size} clients`);
    }
    
    // Stop ping interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }
    
    // Close all connections
    for (const [clientId, connection] of this.connections) {
      try {
        connection.controller.close();
      } catch (error) {
        // Ignore close errors
      }
    }
    
    this.connections.clear();
  }
  
  private setupWatcherListeners(): void {
    this.watcher.on('compile-start', (configPath: string) => {
      this.broadcast({
        type: 'compile-start',
        data: { configPath }
      });
    });
    
    this.watcher.on('compile-success', (result: CompilationResult) => {
      this.broadcast({
        type: 'compile-success',
        data: {
          outputPath: result.outputPath,
          fromCache: result.fromCache,
          compilationTime: result.compilationTime,
          sourcePath: result.sourcePath,
          warnings: result.warnings
        }
      });
    });
    
    this.watcher.on('compile-error', (error: Error, result?: CompilationResult) => {
      this.broadcast({
        type: 'compile-error',
        data: {
          error: error.message,
          stack: error.stack,
          configPath: result?.sourcePath,
          errors: result?.errors
        }
      });
    });
    
    this.watcher.on('config-added', (configPath: string) => {
      this.broadcast({
        type: 'config-added',
        data: { configPath }
      });
    });
    
    this.watcher.on('config-removed', (configPath: string) => {
      this.broadcast({
        type: 'config-removed',
        data: { configPath }
      });
    });
    
    this.watcher.on('watcher-ready', () => {
      this.broadcast({
        type: 'watcher-ready',
        data: {
          watchedPaths: this.watcher.getWatchedPaths(),
          isCompiling: this.watcher.isCurrentlyCompiling()
        }
      });
    });
    
    this.watcher.on('watcher-error', (error: Error) => {
      this.broadcast({
        type: 'watcher-error',
        data: {
          error: error.message,
          stack: error.stack
        }
      });
    });
  }
  
  private formatSSEMessage(message: SSEMessage): string {
    const data = message.data ? JSON.stringify(message.data) : '';
    return `event: ${message.type}\ndata: ${data}\nid: ${message.timestamp}\n\n`;
  }
  
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      // Send ping to keep connections alive
      this.broadcast({
        type: 'ping',
        data: { serverTime: Date.now() }
      });
      
      // Clean up stale connections (older than 30 seconds)
      const now = Date.now();
      const staleTimeout = 30000; // 30 seconds
      
      for (const [clientId, connection] of this.connections) {
        if (now - connection.lastPing > staleTimeout) {
          if (this.debug) {
            console.log(`[HotReload] Removing stale connection: ${clientId}`);
          }
          
          try {
            connection.controller.close();
          } catch (error) {
            // Ignore close errors
          }
          
          this.connections.delete(clientId);
        }
      }
      
      // Stop ping interval if no connections remain
      if (this.connections.size === 0 && this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = undefined;
      }
      
    }, 10000); // Ping every 10 seconds
  }
}

/**
 * Create a hot reload service instance
 */
export function createHotReloadService(options: HotReloadOptions): HotReloadService {
  return new HotReloadService(options);
}

/**
 * Create a Server-Sent Events endpoint handler
 */
export function createSSEHandler(watcher: ConfigWatcher, options: { debug?: boolean } = {}) {
  const hotReloadService = createHotReloadService({
    watcher,
    debug: options.debug
  });
  
  return {
    /**
     * Handle incoming SSE requests
     */
    handleRequest: (request: Request): Response => {
      // Check if request accepts event-stream
      const acceptsEventStream = request.headers.get('accept')?.includes('text/event-stream');
      
      if (!acceptsEventStream) {
        return new Response('This endpoint only supports Server-Sent Events', {
          status: 406,
          headers: {
            'Content-Type': 'text/plain'
          }
        });
      }
      
      return hotReloadService.createSSEResponse(request);
    },
    
    /**
     * Get service information
     */
    getInfo: () => ({
      connectionCount: hotReloadService.getConnectionCount(),
      connections: hotReloadService.getConnectionInfo(),
      watchedPaths: watcher.getWatchedPaths(),
      isCompiling: watcher.isCurrentlyCompiling()
    }),
    
    /**
     * Disconnect all clients
     */
    disconnect: () => hotReloadService.disconnect(),
    
    /**
     * Get the service instance
     */
    service: hotReloadService
  };
}

// Type exports for external use
export type { 
  HotReloadOptions as HotReloadServiceOptions, 
  SSEMessage as HotReloadSSEMessage, 
  ClientConnection as HotReloadClientConnection 
};