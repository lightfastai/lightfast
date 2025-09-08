import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import type { CliRouter } from '@api/cli';


export interface LightfastCloudClientOptions {
  /**
   * Base URL for the Lightfast Cloud API
   */
  baseUrl: string;
  
  /**
   * API key for authentication
   */
  apiKey: string;

  /**
   * API version to use
   */
  apiVersion: string;

  /**
   * Custom headers to include with requests
   */
  headers?: Record<string, string>;
}

/**
 * Build cloud URL for user-facing pages
 */
export function getCloudUrl(baseUrl: string, path: string = ''): string {
  return `${baseUrl}${path}`;
}

/**
 * Create a type-safe Lightfast CLI API client
 */
export function createLightfastCloudClient(options: LightfastCloudClientOptions) {
  const baseUrl = options.baseUrl;
  const apiVersion = options.apiVersion;
  
  return createTRPCProxyClient<CliRouter>({
    links: [
      httpBatchLink({
        url: `${baseUrl}/api/cli/${apiVersion}`,
        transformer: superjson,
        headers() {
          const headers: Record<string, string> = {
            'User-Agent': 'lightfast-cli-client',
            ...options.headers,
          };
          
          if (options.apiKey) {
            headers.Authorization = `Bearer ${options.apiKey}`;
          }
          
          return headers;
        },
      }),
    ],
  });
}

/**
 * Response types for convenience
 */
export type ValidateKeyResponse = {
  valid: boolean;
  userId: string;
  keyId: string;
};

export type WhoAmIResponse = {
  userId: string;
  keyId: string;
};

/**
 * Re-export types from the CLI API for convenience
 */
export type { CliRouter } from '@api/cli';