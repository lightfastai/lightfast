import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import type { CliRouter } from '@api/cli';

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
 * Get the base URL from environment variables or use default
 */
export function getBaseUrl(): string {
  return process.env.LIGHTFAST_BASE_URL || 'https://cloud.lightfast.ai';
}

/**
 * Build cloud URL for user-facing pages
 */
export function getCloudUrl(path: string = ''): string {
  return `${getBaseUrl()}${path}`;
}

/**
 * Create a type-safe Lightfast CLI API client
 */
export function createLightfastCloudClient(options: LightfastCloudClientOptions = {}) {
  const baseUrl = options.baseUrl || getBaseUrl();
  
  return createTRPCProxyClient<CliRouter>({
    links: [
      httpBatchLink({
        url: `${baseUrl}/api/cli/v1`,
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