import type { ApiKeyAuthResult } from "../auth/api-key";
import type { AuthIdentity, OrgGate } from "../auth/identity";
import { AuthzError } from "./errors";

export type Actor =
  | {
      kind: "clerkUser";
      orgGate?: OrgGate;
      orgId?: string;
      orgRole?: string;
      source: "desktop-web" | "web";
      userId: string;
    }
  | {
      client: "cli" | "desktop";
      kind: "nativeClient";
      orgId: string;
      source: "cli" | "desktop-main";
      userId: string;
    }
  | {
      createdByUserId: string;
      keyId: string;
      kind: "apiKey";
      orgGate?: OrgGate;
      orgId: string;
      scopes: string[];
    }
  | {
      clientId: string;
      grantId: string;
      kind: "mcpClient";
      orgId: string;
      scopes: string[];
      userId: string;
    }
  | {
      kind: "service";
      service: "apps-mcp" | "inngest" | "qstash" | "system";
    };

export type Caller =
  | { kind: "firstPartyClient"; client: "cli" | "desktop" }
  | { kind: "service"; service: "apps-mcp" | "inngest" | "qstash" };

export interface ExecutionContext {
  actor: Actor;
  caller?: Caller;
  request?: {
    id: string;
    source:
      | "cli-rpc"
      | "desktop-rpc"
      | "job"
      | "mcp"
      | "public-api"
      | "tanstack";
  };
}

export function actorFromAuthIdentity(
  identity: AuthIdentity,
  source: "desktop-web" | "web"
): Actor {
  if (identity.type === "unauthenticated") {
    throw new AuthzError(
      "AUTH_REQUIRED",
      "Authentication required. Please sign in."
    );
  }

  if (identity.type === "pending") {
    return {
      kind: "clerkUser",
      source,
      userId: identity.userId,
    };
  }

  return {
    kind: "clerkUser",
    orgGate: identity.orgGate,
    orgId: identity.orgId,
    source,
    userId: identity.userId,
  };
}

export function actorFromApiKeyAuth(auth: ApiKeyAuthResult): Actor {
  return {
    createdByUserId: auth.identity.userId,
    keyId: auth.apiKeyId,
    kind: "apiKey",
    orgGate: auth.identity.orgGate,
    orgId: auth.identity.orgId,
    scopes: auth.scopes,
  };
}
