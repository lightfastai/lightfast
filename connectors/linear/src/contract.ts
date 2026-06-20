export const LINEAR_OAUTH_SCOPES = ["read", "write"] as const;

export const LINEAR_OAUTH_SCOPE = LINEAR_OAUTH_SCOPES.join(",");

export type LinearOAuthScope = (typeof LINEAR_OAUTH_SCOPES)[number];
