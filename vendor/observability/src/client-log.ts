'use client';

import { useLogger as useLogtailLogger } from '@logtail/next';
import { useMemo } from 'react';

/**
 * Client logger interface that matches the Logtail Logger
 */
export interface ClientLogger {
  debug: (message: string, args?: Record<string, any>) => void;
  info: (message: string, args?: Record<string, any>) => void;
  warn: (message: string, args?: Record<string, any>) => void;
  error: (message: string, args?: Record<string, any>) => void;
}

/**
 * Console logger that matches the Logtail interface
 */
const consoleLogger: ClientLogger = {
  debug: (message: string, args?: Record<string, any>) => console.debug(message, args),
  info: (message: string, args?: Record<string, any>) => console.info(message, args),
  warn: (message: string, args?: Record<string, any>) => console.warn(message, args),
  error: (message: string, args?: Record<string, any>) => console.error(message, args),
};

/**
 * Client-safe logger hook for React components
 * Uses BetterStack Logtail when configured, falls back to console
 */
export function useLogger(): ClientLogger {
  const logtailLogger = useLogtailLogger();
  
  return useMemo(() => {
    // Check if BetterStack is configured by checking if the logger has a proper config
    // When not configured, Logtail returns a logger but it won't actually send logs
    const isBetterStackConfigured = process.env.NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN;
    
    if (!isBetterStackConfigured) {
      return consoleLogger;
    }
    
    return logtailLogger;
  }, [logtailLogger]);
}