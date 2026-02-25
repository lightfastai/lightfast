/**
 * Redis key convention functions for the Gateway service.
 *
 * All keys are namespaced under `gw:` to avoid collisions.
 */

/** Connection state keyed by connection ID */
export const connectionKey = (id: string) => `gw:connection:${id}`;

/** Set of connection IDs for an org */
export const orgConnectionsKey = (orgId: string) =>
  `gw:org:${orgId}:connections`;

/** Provider account → connection mapping */
export const providerAccountKey = (provider: string, accountId: string) =>
  `gw:provider:${provider}:account:${accountId}`;

/** Resource → connection mapping (for webhook routing) */
export const resourceKey = (provider: string, resourceId: string) =>
  `gw:resource:${provider}:${resourceId}`;

/** Set of resource IDs linked to a connection */
export const connectionResourcesKey = (connId: string) =>
  `gw:connection:${connId}:resources`;

/** Short-lived OAuth state token (TTL 600s) */
export const oauthStateKey = (token: string) => `gw:oauth:state:${token}`;

/** Deduplication key for received webhooks (TTL 86400s) */
export const webhookSeenKey = (provider: string, deliveryId: string) =>
  `gw:webhook:seen:${provider}:${deliveryId}`;
