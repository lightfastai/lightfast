import type { Database } from "@db/app";
import { isOrgBound } from "@db/app";
import { db as appDb } from "@db/app/client";
import { getUnkeyClient } from "@vendor/unkey/server";

import type { Diagnostic } from "../diagnostics";
import { LIGHTFAST_API_KEY_PREFIX } from "./api-key-prefix";
import type { AuthIdentity, BindingStatus } from "./identity";

export type ApiKeyAuthIdentity = Extract<AuthIdentity, { type: "active" }>;

export interface ApiKeyAuthResult {
  apiKeyId: string;
  identity: ApiKeyAuthIdentity;
}

export type ApiKeyAuthFailure =
  | "missing"
  | "invalid-format"
  | "invalid"
  | "disabled"
  | "expired"
  | "not-org-scoped"
  | "missing-creator";

type ApiKeyAuthOrpcCode = "UNAUTHORIZED" | "FORBIDDEN";

export class ApiKeyAuthError extends Error {
  constructor(
    public readonly reason: ApiKeyAuthFailure,
    message: string,
    public readonly orpcCode: ApiKeyAuthOrpcCode
  ) {
    super(message);
    this.name = "ApiKeyAuthError";
  }

  get diagnostic(): Diagnostic {
    return {
      code: this.orpcCode === "FORBIDDEN" ? "ORG_REQUIRED" : "AUTH_REQUIRED",
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
      "UNAUTHORIZED"
    );
  }

  // Lightfast public API keys use Unkey's `lf_` prefix. Keep this as a cheap
  // shape check before making a network request to Unkey.
  if (!token.startsWith(LIGHTFAST_API_KEY_PREFIX)) {
    throw new ApiKeyAuthError(
      "invalid-format",
      "Invalid API key format.",
      "UNAUTHORIZED"
    );
  }

  return token;
}

export async function resolveApiKeyAuth(input: {
  db?: Database;
  headers: Headers;
}): Promise<ApiKeyAuthResult> {
  const token = parseBearerApiKey(input.headers);
  const unkey = getUnkeyClient();
  let verification;

  try {
    verification = await unkey.keys.verifyKey({ key: token });
  } catch {
    throw new ApiKeyAuthError("invalid", "Invalid API key", "UNAUTHORIZED");
  }

  const key = verification.data;
  if (!key.valid) {
    if (key.code === "DISABLED") {
      throw new ApiKeyAuthError("disabled", "API key disabled", "UNAUTHORIZED");
    }
    if (key.code === "EXPIRED") {
      throw new ApiKeyAuthError("expired", "API key expired", "UNAUTHORIZED");
    }
    throw new ApiKeyAuthError("invalid", "Invalid API key", "UNAUTHORIZED");
  }

  const orgId = key.identity?.externalId;
  if (!orgId) {
    throw new ApiKeyAuthError(
      "not-org-scoped",
      "API key is not org-scoped",
      "FORBIDDEN"
    );
  }

  const createdByUserId = key.meta?.createdByUserId;
  if (typeof createdByUserId !== "string") {
    throw new ApiKeyAuthError(
      "missing-creator",
      "API key is missing creator metadata",
      "FORBIDDEN"
    );
  }

  const bound = await isOrgBound(input.db ?? appDb, orgId);
  const bindingStatus = (bound ? "bound" : "unbound") satisfies BindingStatus;
  const identity: ApiKeyAuthIdentity = {
    type: "active",
    userId: createdByUserId,
    orgId,
    orgGate: { bindingStatus },
  };

  if (!key.keyId) {
    throw new ApiKeyAuthError("invalid", "Invalid API key", "UNAUTHORIZED");
  }

  return { apiKeyId: key.keyId, identity };
}
