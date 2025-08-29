import { useEffect, useState, useCallback, useRef } from 'react';
import type { SSEMessage } from '../server/hot-reload.js';

export interface HotReloadState {
  /**
   * Whether the hot reload connection is established
   */
  connected: boolean;
  
  /**
   * Whether a configuration compilation is in progress
   */
  isCompiling: boolean;
  
  /**
   * Last compilation result
   */
  lastCompilationResult: {
    success: boolean;
    outputPath?: string;
    compilationTime?: number;
    sourcePath?: string;
    warnings?: string[];
    errors?: string[];
    timestamp: number;
  } | null;
  
  /**
   * Current watched configuration file paths
   */
  watchedPaths: string[];
  
  /**
   * Connection error if any
   */
  error: string | null;
  
  /**
   * Number of successful compilations
   */
  compilationCount: number;
  
  /**
   * Last activity timestamp
   */
  lastActivity: number;
}

export interface HotReloadActions {
  /**
   * Force a recompilation of the configuration
   */
  forceCompile: () => Promise<void>;
  
  /**
   * Manually reconnect to the hot reload service
   */
  reconnect: () => void;
  
  /**
   * Disconnect from the hot reload service
   */
  disconnect: () => void;
  
  /**
   * Get detailed service information
   */
  getInfo: () => Promise<any>;
}

export interface UseHotReloadOptions {
  /**
   * Hot reload endpoint URL
   * @default '/api/hot-reload'
   */
  endpoint?: string;
  
  /**
   * Auto-reconnect on connection loss
   * @default true
   */
  autoReconnect?: boolean;
  
  /**
   * Reconnection delay in milliseconds
   * @default 3000
   */
  reconnectDelay?: number;
  
  /**
   * Maximum reconnection attempts
   * @default 5
   */
  maxReconnectAttempts?: number;
  
  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean;
  
  /**
   * Callback when compilation starts
   */
  onCompileStart?: (configPath: string) => void;
  
  /**
   * Callback when compilation succeeds
   */
  onCompileSuccess?: (result: any) => void;
  
  /**
   * Callback when compilation fails
   */
  onCompileError?: (error: string, configPath: string) => void;
  
  /**
   * Callback when configuration file is added
   */
  onConfigAdded?: (configPath: string) => void;
  
  /**
   * Callback when configuration file is removed
   */
  onConfigRemoved?: (configPath: string) => void;
}

/**
 * React hook for consuming hot-reload events from the Lightfast configuration watcher
 */
export function useHotReload(options: UseHotReloadOptions = {}): [HotReloadState, HotReloadActions] {
  const {
    endpoint = '/api/hot-reload',
    autoReconnect = true,
    reconnectDelay = 3000,
    maxReconnectAttempts = 5,
    debug = false,
    onCompileStart,
    onCompileSuccess,
    onCompileError,
    onConfigAdded,
    onConfigRemoved
  } = options;
  
  const [state, setState] = useState<HotReloadState>({
    connected: false,
    isCompiling: false,
    lastCompilationResult: null,
    watchedPaths: [],
    error: null,
    compilationCount: 0,
    lastActivity: Date.now()
  });
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isMountedRef = useRef(true);
  
  const log = useCallback((message: string, ...args: any[]) => {
    if (debug) {
      console.log(`[useHotReload] ${message}`, ...args);
    }
  }, [debug]);
  
  const connect = useCallback(() => {
    if (!isMountedRef.current) return;
    
    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    log('Connecting to hot reload service...');
    
    try {
      const eventSource = new EventSource(endpoint);
      eventSourceRef.current = eventSource;
      
      eventSource.onopen = () => {
        if (!isMountedRef.current) return;
        
        log('Connected to hot reload service');
        reconnectAttemptsRef.current = 0;
        
        setState(prev => ({
          ...prev,
          connected: true,
          error: null,
          lastActivity: Date.now()
        }));
      };
      
      eventSource.onerror = (error) => {
        if (!isMountedRef.current) return;
        
        log('Hot reload connection error:', error);
        
        setState(prev => ({
          ...prev,
          connected: false,
          error: 'Connection lost',
          lastActivity: Date.now()
        }));
        
        // Attempt reconnection if enabled
        if (autoReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          log(`Attempting reconnection ${reconnectAttemptsRef.current}/${maxReconnectAttempts} in ${reconnectDelay}ms`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              connect();
            }
          }, reconnectDelay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setState(prev => ({
            ...prev,
            error: 'Max reconnection attempts reached'
          }));
        }
      };
      
      // Handle specific event types
      eventSource.addEventListener('watcher-ready', (event) => {
        if (!isMountedRef.current) return;
        
        const data = JSON.parse(event.data);
        log('Watcher ready:', data);
        
        setState(prev => ({
          ...prev,
          watchedPaths: data.watchedPaths || [],
          isCompiling: data.isCompiling || false,
          lastActivity: Date.now()
        }));
      });
      
      eventSource.addEventListener('compile-start', (event) => {
        if (!isMountedRef.current) return;
        
        const data = JSON.parse(event.data);
        log('Compilation started:', data.configPath);
        
        setState(prev => ({
          ...prev,
          isCompiling: true,
          lastActivity: Date.now()
        }));
        
        onCompileStart?.(data.configPath);
      });
      
      eventSource.addEventListener('compile-success', (event) => {
        if (!isMountedRef.current) return;
        
        const data = JSON.parse(event.data);
        log('Compilation succeeded:', data);
        
        setState(prev => ({
          ...prev,
          isCompiling: false,
          lastCompilationResult: {
            success: true,
            outputPath: data.outputPath,
            compilationTime: data.compilationTime,
            sourcePath: data.sourcePath,
            warnings: data.warnings || [],
            errors: [],
            timestamp: Date.now()
          },
          compilationCount: prev.compilationCount + 1,
          lastActivity: Date.now()
        }));
        
        onCompileSuccess?.(data);
      });
      
      eventSource.addEventListener('compile-error', (event) => {
        if (!isMountedRef.current) return;
        
        const data = JSON.parse(event.data);
        log('Compilation failed:', data.error);
        
        setState(prev => ({
          ...prev,
          isCompiling: false,
          lastCompilationResult: {
            success: false,
            sourcePath: data.configPath,
            errors: [data.error],
            warnings: [],
            timestamp: Date.now()
          },
          lastActivity: Date.now()
        }));
        
        onCompileError?.(data.error, data.configPath);
      });
      
      eventSource.addEventListener('config-added', (event) => {
        if (!isMountedRef.current) return;
        
        const data = JSON.parse(event.data);
        log('Configuration file added:', data.configPath);
        
        setState(prev => ({
          ...prev,
          watchedPaths: [...new Set([...prev.watchedPaths, data.configPath])],
          lastActivity: Date.now()
        }));
        
        onConfigAdded?.(data.configPath);
      });
      
      eventSource.addEventListener('config-removed', (event) => {
        if (!isMountedRef.current) return;
        
        const data = JSON.parse(event.data);
        log('Configuration file removed:', data.configPath);
        
        setState(prev => ({
          ...prev,
          watchedPaths: prev.watchedPaths.filter(path => path !== data.configPath),
          lastActivity: Date.now()
        }));
        
        onConfigRemoved?.(data.configPath);
      });
      
      eventSource.addEventListener('ping', () => {
        if (!isMountedRef.current) return;
        
        setState(prev => ({
          ...prev,
          lastActivity: Date.now()
        }));
      });
      
    } catch (error) {
      log('Failed to establish connection:', error);
      
      setState(prev => ({
        ...prev,
        connected: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      }));
    }
  }, [endpoint, autoReconnect, reconnectDelay, maxReconnectAttempts, log, onCompileStart, onCompileSuccess, onCompileError, onConfigAdded, onConfigRemoved]);
  
  const disconnect = useCallback(() => {
    log('Disconnecting from hot reload service');
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    setState(prev => ({
      ...prev,
      connected: false,
      error: null
    }));
  }, [log]);
  
  const forceCompile = useCallback(async () => {
    try {
      log('Forcing compilation...');
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'force-compile' })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      log('Force compile result:', result);
      
    } catch (error) {
      log('Force compile failed:', error);
      throw error;
    }
  }, [endpoint, log]);
  
  const getInfo = useCallback(async () => {
    try {
      log('Getting service info...');
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'get-info' })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      log('Service info:', result);
      
      return result.data;
      
    } catch (error) {
      log('Get info failed:', error);
      throw error;
    }
  }, [endpoint, log]);
  
  // Connect on mount
  useEffect(() => {
    isMountedRef.current = true;
    connect();
    
    return () => {
      isMountedRef.current = false;
      disconnect();
    };
  }, [connect, disconnect]);
  
  const actions: HotReloadActions = {
    forceCompile,
    reconnect: connect,
    disconnect,
    getInfo
  };
  
  return [state, actions];
}

export default useHotReload;