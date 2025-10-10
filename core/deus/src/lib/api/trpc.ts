/**
 * Typed tRPC Client for CLI
 * Uses proper @trpc/client conventions with full type safety
 */

import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { DeusAppRouter } from '@api/deus';
import superjson from 'superjson';

import { getApiUrl } from '../config/config.js';

/**
 * tRPC client type for type-safe usage throughout the CLI
 */
export type DeusClient = ReturnType<typeof createTRPCClient<DeusAppRouter>>;

/**
 * Create a tRPC client instance with authentication
 *
 * @param apiKey - API key for authorization (Bearer token)
 * @returns Typed tRPC client instance
 *
 * @example
 * ```typescript
 * const client = createDeusClient('deus_sk_...');
 *
 * // Queries
 * const orgs = await client.user.organizations.query();
 *
 * // Mutations
 * await client.session.create.mutate({
 *   id: 'session_123',
 *   organizationId: 'org_456',
 *   cwd: '/path/to/project'
 * });
 * ```
 */
export function createDeusClient(apiKey: string): DeusClient {
  const apiUrl = getApiUrl();

  return createTRPCClient<DeusAppRouter>({
    links: [
      httpBatchLink({
        url: `${apiUrl}/api/trpc`,

        // SuperJSON transformer for Date/Map/Set serialization
        transformer: superjson,

        // Authentication header
        headers() {
          return {
            Authorization: `Bearer ${apiKey}`,
            'x-trpc-source': 'cli',
          };
        },

        // Fetch configuration
        fetch(url, options) {
          return fetch(url, {
            ...options,
            // Ensure credentials are included if needed
            credentials: 'include',
          });
        },
      }),
    ],
  });
}
