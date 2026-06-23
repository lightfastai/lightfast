import type { Database } from "@db/app";
import { db as appDb } from "@db/app/client";
import { getUnkeyClient } from "@vendor/unkey/server";

import type { Diagnostic } from "../diagnostics";
import { LIGHTFAST_API_KEY_PREFIX } from "./api-key-prefix";
import type { AuthIdentity } from "./identity";
import { resolveOrgSetupGate } from "./org-setup-gate";

export type ApiKeyAuthIdentity = Extract<AuthIdentity, { type: "active" }>;

export const PUBLIC_API_KEY_SCOPES = [
  "api.signals.read",
  "api.signals.write",
] as const;

export type PublicApiKeyScope = (typeof PUBLIC_API_KEY_SCOPES)[number];

export const PUBLIC_API_KEY_PERMISSION_CHECK =
  PUBLIC_API_KEY_SCOPES.join(" OR ");

export interface ApiKeyAuthResult {
  apiKeyId: string;
  identity: ApiKeyAuthIdentity;
  scopes: PublicApiKeyScope[];
}

export type ApiKeyAuthFailure =
  | "missing"
  | "invalid-format"
  | "invalid"
  | "disabled"
  | "expired"
  | "insufficient-scope"
  | "not-org-scoped"
  | "missing-creator";

type ApiKeyAuthStatus = 401 | 403;

export class ApiKeyAuthError extends Error {
  constructor(
    public readonly reason: ApiKeyAuthFailure,
    message: string,
    public readonly status: ApiKeyAuthStatus
  ) {
    super(message);
    this.name = "ApiKeyAuthError";
  }

  get diagnostic(): Diagnostic {
    return {
      code: this.status === 403 ? "ORG_REQUIRED" : "AUTH_REQUIRED",
      message: this.message,
    };
  }
}

export function isApiKeyAuthError(error: unknown): error is ApiKeyAuthError {
  return error instanceof ApiKeyAuthError;
}

function parseBearerApiKey(headers: Headers): string {
  const authHeader = headers.get("authorization");
  const [scheme, token] = authHeader?.trim().split(/\s+/, 2) ?? [];
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
    throw new ApiKeyAuthError(
      "missing",
      "API key required. Provide 'Authorization: Bearer <api-key>' header.",
      401
    );
  }

  // Lightfast public API keys use Unkey's `lf_` prefix. Keep this as a cheap
  // shape check before making a network request to Unkey.
  if (!token.startsWith(LIGHTFAST_API_KEY_PREFIX)) {
    throw new ApiKeyAuthError("invalid-format", "Invalid API key format.", 401);
  }

  return token;
}

function parsePublicApiKeyScopes(permissions: unknown): PublicApiKeyScope[] {
  if (!Array.isArray(permissions)) {
    return [];
  }

  return PUBLIC_API_KEY_SCOPES.filter((scope) => permissions.includes(scope));
}

export async function resolveApiKeyAuth(input: {
  db?: Database;
  headers: Headers;
}): Promise<ApiKeyAuthResult> {
  const token = parseBearerApiKey(input.headers);
  const unkey = getUnkeyClient();
  let verification;

  try {
    verification = await unkey.keys.verifyKey({
      key: token,
      permissions: PUBLIC_API_KEY_PERMISSION_CHECK,
    });
  } catch {
    throw new ApiKeyAuthError("invalid", "Invalid API key", 401);
  }

  const key = verification.data;
  if (!key.valid) {
    if (key.code === "DISABLED") {
      throw new ApiKeyAuthError("disabled", "API key disabled", 401);
    }
    if (key.code === "EXPIRED") {
      throw new ApiKeyAuthError("expired", "API key expired", 401);
    }
    if (key.code === "FORBIDDEN" || key.code === "INSUFFICIENT_PERMISSIONS") {
      throw new ApiKeyAuthError(
        "insufficient-scope",
        "API key is missing required permissions",
        403
      );
    }
    throw new ApiKeyAuthError("invalid", "Invalid API key", 401);
  }

  const scopes = parsePublicApiKeyScopes(key.permissions);
  if (scopes.length === 0) {
    throw new ApiKeyAuthError(
      "insufficient-scope",
      "API key is missing required permissions",
      403
    );
  }

  const orgId = key.identity?.externalId;
  if (!orgId) {
    throw new ApiKeyAuthError(
      "not-org-scoped",
      "API key is not org-scoped",
      403
    );
  }

  const createdByUserId = key.meta?.createdByUserId;
  if (typeof createdByUserId !== "string") {
    throw new ApiKeyAuthError(
      "missing-creator",
      "API key is missing creator metadata",
      403
    );
  }

  const orgGate = await resolveOrgSetupGate({
    db: input.db ?? appDb,
    clerkOrgId: orgId,
  });
  const identity: ApiKeyAuthIdentity = {
    type: "active",
    userId: createdByUserId,
    orgId,
    orgGate,
  };

  if (!key.keyId) {
    throw new ApiKeyAuthError("invalid", "Invalid API key", 401);
  }

  return { apiKeyId: key.keyId, identity, scopes };
}
