import type { Database } from "@db/app";
import { isOrgBound } from "@db/app";
import { db as appDb } from "@db/app/client";
import { clerkClient } from "@vendor/clerk/server";

import type { Diagnostic } from "../diagnostics";
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
  | "revoked"
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

  // Clerk org API keys currently use the `ak_` prefix. Keep this as a cheap
  // shape check before making a network request to Clerk.
  if (!token.startsWith("ak_")) {
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
  const clerk = await clerkClient();
  let key;

  try {
    key = await clerk.apiKeys.verify(token);
  } catch {
    throw new ApiKeyAuthError("invalid", "Invalid API key", "UNAUTHORIZED");
  }

  if (key.revoked) {
    throw new ApiKeyAuthError("revoked", "API key revoked", "UNAUTHORIZED");
  }
  if (key.expired) {
    throw new ApiKeyAuthError("expired", "API key expired", "UNAUTHORIZED");
  }
  if (!key.subject.startsWith("org_")) {
    throw new ApiKeyAuthError(
      "not-org-scoped",
      "API key is not org-scoped",
      "FORBIDDEN"
    );
  }
  if (!key.createdBy) {
    throw new ApiKeyAuthError(
      "missing-creator",
      "API key is missing creator metadata",
      "FORBIDDEN"
    );
  }

  const bound = await isOrgBound(input.db ?? appDb, key.subject);
  const bindingStatus = (bound ? "bound" : "unbound") satisfies BindingStatus;
  const identity: ApiKeyAuthIdentity = {
    type: "active",
    userId: key.createdBy,
    orgId: key.subject,
    orgGate: { bindingStatus },
  };

  return { apiKeyId: key.id, identity };
}
