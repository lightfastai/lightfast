/**
 * Redis key convention functions for the Connections service.
 *
 * All keys are namespaced under `gw:` to share the same namespace as the relay service.
 */
import type { ProviderName } from "@repo/gateway-types";

/** Connection state keyed by connection ID */
export const connectionKey = (id: string) => `gw:connection:${id}`;

/** Set of connection IDs for an org */
export const orgConnectionsKey = (orgId: string) =>
  `gw:org:${orgId}:connections`;

/** Provider account → connection mapping */
export const providerAccountKey = (provider: ProviderName, accountId: string) =>
  `gw:provider:${provider}:account:${accountId}`;

/** Resource → connection mapping (for webhook routing) */
export const resourceKey = (provider: ProviderName, resourceId: string) =>
  `gw:resource:${provider}:${resourceId}`;

/** Set of resource IDs linked to a connection */
export const connectionResourcesKey = (connId: string) =>
  `gw:connection:${connId}:resources`;

/** Short-lived OAuth state token (TTL 600s) */
export const oauthStateKey = (token: string) => `gw:oauth:state:${token}`;

/** Short-lived OAuth result for CLI polling (TTL 300s) */
export const oauthResultKey = (state: string) => `gw:oauth:result:${state}`;
