/**
 * Redis key convention functions for the Platform service.
 *
 * All keys are namespaced under `gw:` (legacy namespace from the former
 * gateway and relay services — preserved for Redis key compatibility).
 */

/** Short-lived OAuth state token (TTL 600s) */
export const oauthStateKey = (token: string) => `gw:oauth:state:${token}`;

/** Short-lived OAuth result for CLI polling (TTL 300s) */
export const oauthResultKey = (state: string) => `gw:oauth:result:${state}`;
