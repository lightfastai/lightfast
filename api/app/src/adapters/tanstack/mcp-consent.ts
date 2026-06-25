import { getMcpOauthClientByClientId } from "@db/app";
import { db } from "@db/app/client";
import type { McpScope } from "@repo/api-contract";
import { notFound, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { auth, clerkClient, currentUser } from "@vendor/clerk/server";
import { z } from "zod";

import {
  issueMcpAuthorizationCode,
  isValidMcpS256CodeChallenge,
  McpOAuthError,
  parseMcpScopes,
  requireHostedMcpResource,
} from "../../mcp-oauth";

export interface McpConsentViewModel {
  client: {
    id: string;
    name: string;
    redirectUri: string;
    verified: boolean;
  };
  organizations: Array<{
    id: string;
    name: string;
    slug: string | null;
  }>;
  permissions: Array<{
    description: string;
    kind: "read" | "write";
    label: string;
    scope: McpScope;
  }>;
  request: {
    clientId: string;
    codeChallenge: string;
    codeChallengeMethod: "S256";
    redirectUri: string;
    resource: string;
    scope: string;
    state?: string;
  };
  user: {
    email: string;
    id: string;
    name: string;
  };
}

export interface McpAuthorizationInput {
  clientId: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  organizationId: string;
  redirectUri: string;
  resource: string;
  scope?: string;
  state?: string;
}

const mcpAuthorizationInputSchema = z.object({
  clientId: z.string().min(1),
  codeChallenge: z.string().min(1),
  codeChallengeMethod: z.literal("S256"),
  organizationId: z.string().min(1),
  redirectUri: z.string().url(),
  resource: z.string().url(),
  scope: z.string().optional(),
  state: z.string().optional(),
});

const authorizeSearchParamsSchema = z.object({
  client_id: z.string().min(1),
  code_challenge: z.string().refine(isValidMcpS256CodeChallenge),
  code_challenge_method: z.literal("S256"),
  redirect_uri: z.string().url(),
  resource: z.string().url(),
  scope: z.string().optional(),
  state: z.string().optional(),
});

export const loadMcpConsentViewModel = createServerFn({ method: "GET" })
  .inputValidator(validateMcpAuthorizeSearchInput)
  .handler(async ({ data }) => {
    const request = getRequest();
    const authState = await auth({ treatPendingAsSignedOut: false });
    if (!authState.userId) {
      redirectToSignInForOAuth(request.url);
    }

    noStore();
    return getMcpConsentViewModel(data);
  });

export const approveMcpAuthorization = createServerFn({ method: "POST" })
  .inputValidator(mcpAuthorizationInputSchema)
  .handler(async ({ data }) =>
    approveMcpAuthorizationRequest(data satisfies McpAuthorizationInput)
  );

export const denyMcpAuthorization = createServerFn({ method: "POST" })
  .inputValidator(mcpAuthorizationInputSchema)
  .handler(async ({ data }) =>
    denyMcpAuthorizationRequest(data satisfies McpAuthorizationInput)
  );

async function getMcpConsentViewModel(
  searchParams: Record<string, string | undefined>
): Promise<McpConsentViewModel> {
  const parsed = authorizeSearchParamsSchema.safeParse(searchParams);
  if (!parsed.success) {
    throw notFound();
  }
  const resource = requireHostedMcpResource(parsed.data.resource);

  const authState = await auth({ treatPendingAsSignedOut: false });
  if (!authState.userId) {
    throw notFound();
  }

  const client = await getMcpOauthClientByClientId(db, {
    publicClientId: parsed.data.client_id,
  });
  if (!client?.redirectUris.includes(parsed.data.redirect_uri)) {
    throw notFound();
  }

  const scopes = parseConsentScopes(parsed.data.scope);
  const clerk = await clerkClient();
  const [user, memberships] = await Promise.all([
    currentUser(),
    clerk.users.getOrganizationMembershipList({
      limit: 100,
      userId: authState.userId,
    }),
  ]);
  if (memberships.data.length === 0) {
    throw notFound();
  }

  return {
    client: {
      id: client.publicClientId,
      name: client.clientName,
      redirectUri: parsed.data.redirect_uri,
      verified: false,
    },
    organizations: memberships.data.map((membership) => ({
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
    })),
    permissions: scopes.map(permissionForScope),
    request: {
      clientId: parsed.data.client_id,
      codeChallenge: parsed.data.code_challenge,
      codeChallengeMethod: parsed.data.code_challenge_method,
      redirectUri: parsed.data.redirect_uri,
      resource,
      scope: scopes.join(" "),
      state: parsed.data.state,
    },
    user: {
      email: user?.primaryEmailAddress?.emailAddress ?? authState.userId,
      id: authState.userId,
      name: user?.fullName ?? user?.username ?? "Lightfast user",
    },
  };
}

async function approveMcpAuthorizationRequest(input: McpAuthorizationInput) {
  const authState = await auth({ treatPendingAsSignedOut: false });
  if (!authState.userId) {
    throw new McpOAuthError("access_denied", "Authentication required.", 401);
  }
  const resource = requireHostedMcpResource(input.resource);

  await requireUserOrgMembership({
    clerkOrgId: input.organizationId,
    userId: authState.userId,
  });

  const result = await issueMcpAuthorizationCode(db, {
    clientId: input.clientId,
    clerkOrgId: input.organizationId,
    clerkUserId: authState.userId,
    codeChallenge: input.codeChallenge,
    codeChallengeMethod: input.codeChallengeMethod,
    redirectUri: input.redirectUri,
    resource,
    scope: input.scope,
  });

  const url = new URL(input.redirectUri);
  url.searchParams.set("code", result.code);
  if (input.state) {
    url.searchParams.set("state", input.state);
  }
  return url.toString();
}

async function denyMcpAuthorizationRequest(input: McpAuthorizationInput) {
  const authState = await auth({ treatPendingAsSignedOut: false });
  if (!authState.userId) {
    throw new McpOAuthError("access_denied", "Authentication required.", 401);
  }
  requireHostedMcpResource(input.resource);

  const redirectUri = await requireRegisteredRedirectUri(input);
  const url = new URL(redirectUri);
  url.searchParams.set("error", "access_denied");
  if (input.state) {
    url.searchParams.set("state", input.state);
  }
  return url.toString();
}

function validateMcpAuthorizeSearchInput(input: unknown) {
  if (!(input && typeof input === "object")) {
    throw new Error("Invalid OAuth authorization search input");
  }

  const record = input as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(record).flatMap(([key, value]) => {
      const normalized = singleSearchValue(value);
      return normalized ? [[key, normalized]] : [];
    })
  ) as Record<string, string | undefined>;
}

function singleSearchValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  if (!Array.isArray(value) || value.length === 0) {
    return;
  }

  if (value.some((item) => typeof item !== "string" || item.length === 0)) {
    return;
  }

  const values = value as string[];
  const [first] = values;
  return values.every((item) => item === first) ? first : undefined;
}

function oauthRequestRedirectTarget(requestUrl: string): string {
  try {
    const url = new URL(requestUrl);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return requestUrl.startsWith("/") ? requestUrl : "/";
  }
}

function redirectToSignInForOAuth(requestUrl: string): never {
  throw redirect({
    search: { redirect_url: oauthRequestRedirectTarget(requestUrl) },
    throw: true,
    to: "/sign-in",
  });
}

function noStore() {
  setResponseHeader("cache-control", "private, no-store");
  setResponseHeader("vary", "Cookie, Authorization");
}

function parseConsentScopes(scope: string | undefined): McpScope[] {
  try {
    return parseMcpScopes(scope);
  } catch (error) {
    if (error instanceof McpOAuthError) {
      throw notFound();
    }
    throw error;
  }
}

async function requireUserOrgMembership(input: {
  clerkOrgId: string;
  userId: string;
}): Promise<void> {
  const clerk = await clerkClient();
  const memberships = await clerk.users.getOrganizationMembershipList({
    limit: 100,
    userId: input.userId,
  });
  if (
    !memberships.data.some(
      (membership) => membership.organization.id === input.clerkOrgId
    )
  ) {
    throw new McpOAuthError(
      "access_denied",
      "Organization access denied.",
      403
    );
  }
}

async function requireRegisteredRedirectUri(
  input: McpAuthorizationInput
): Promise<string> {
  const client = await getMcpOauthClientByClientId(db, {
    publicClientId: input.clientId,
  });
  if (!client?.redirectUris.includes(input.redirectUri)) {
    throw new McpOAuthError(
      "invalid_request",
      "Redirect URI is not registered."
    );
  }
  return input.redirectUri;
}

function permissionForScope(
  scope: McpScope
): McpConsentViewModel["permissions"][number] {
  switch (scope) {
    case "mcp:signals:write":
      return {
        description: "Create new signals and read their status.",
        kind: "write",
        label: "Create signals",
        scope,
      };
    case "mcp:signals:read":
      return {
        description: "Read signals visible to your selected organization.",
        kind: "read",
        label: "Read signals",
        scope,
      };
    case "mcp:decisions:read":
      return {
        description:
          "Search and read decision history for your selected organization.",
        kind: "read",
        label: "Read decisions",
        scope,
      };
    case "mcp:provider_routines:write":
      return {
        description:
          "Call enabled connector routines for your selected organization.",
        kind: "write",
        label: "Call connector routines",
        scope,
      };
    case "mcp:provider_routines:read":
      return {
        description:
          "Find enabled connector routines for your selected organization.",
        kind: "read",
        label: "Find connector routines",
        scope,
      };
    case "mcp:system:read":
      return {
        description: "Check connection health and available capabilities.",
        kind: "read",
        label: "Check connection status",
        scope,
      };
    default: {
      const unsupportedScope: never = scope;
      throw new Error(`Unsupported MCP OAuth scope: ${unsupportedScope}`);
    }
  }
}
