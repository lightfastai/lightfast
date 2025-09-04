import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import type { CloudAppRouter } from '@api/cloud';

export interface LightfastCloudClientOptions {
  /**
   * Base URL for the Lightfast Cloud API
   * @default "https://cloud.lightfast.ai"
   */
  baseUrl?: string;
  
  /**
   * API key for authentication (optional for public endpoints)
   */
  apiKey?: string;

  /**
   * Custom headers to include with requests
   */
  headers?: Record<string, string>;
}

/**
 * Create a type-safe Lightfast Cloud API client
 */
export function createLightfastCloudClient(options: LightfastCloudClientOptions = {}) {
  const baseUrl = options.baseUrl || 'https://cloud.lightfast.ai';
  
  return createTRPCProxyClient<CloudAppRouter>({
    links: [
      httpBatchLink({
        url: `${baseUrl}/api/trpc`,
        transformer: superjson,
        headers() {
          const headers: Record<string, string> = {
            'User-Agent': 'lightfast-cloud-client',
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
 * Re-export types from the cloud API for convenience
 */
export type { CloudAppRouter } from '@api/cloud';