import "@tanstack/react-start/server-only";

import {
  issueMcpAuthorizationCode,
  isValidMcpS256CodeChallenge,
  McpOAuthError,
  parseMcpScopes,
} from "@api/app";
import { getMcpOauthClientByClientId } from "@db/app";
import { db } from "@db/app/client";
import type { McpScope } from "@repo/api-contract";
import { notFound } from "@tanstack/react-router";
import { auth, clerkClient, currentUser } from "@vendor/clerk/server";
import { z } from "zod";
import type {
  McpAuthorizationInput,
  McpConsentViewModel,
} from "./mcp-consent-types";

const authorizeSearchParamsSchema = z.object({
  client_id: z.string().min(1),
  code_challenge: z.string().refine(isValidMcpS256CodeChallenge),
  code_challenge_method: z.literal("S256"),
  redirect_uri: z.string().url(),
  resource: z.string().url(),
  scope: z.string().optional(),
  state: z.string().optional(),
});

export async function getMcpConsentViewModel(
  searchParams: Record<string, string | undefined>
): Promise<McpConsentViewModel> {
  const parsed = authorizeSearchParamsSchema.safeParse(searchParams);
  if (!parsed.success) {
    throw notFound();
  }

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
      resource: parsed.data.resource,
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

export async function approveMcpAuthorizationRequest(
  input: McpAuthorizationInput
) {
  const authState = await auth({ treatPendingAsSignedOut: false });
  if (!authState.userId) {
    throw new McpOAuthError("access_denied", "Authentication required.", 401);
  }

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
    resource: input.resource,
    scope: input.scope,
  });

  const url = new URL(input.redirectUri);
  url.searchParams.set("code", result.code);
  if (input.state) {
    url.searchParams.set("state", input.state);
  }
  return url.toString();
}

export async function denyMcpAuthorizationRequest(
  input: McpAuthorizationInput
) {
  const authState = await auth({ treatPendingAsSignedOut: false });
  if (!authState.userId) {
    throw new McpOAuthError("access_denied", "Authentication required.", 401);
  }

  const redirectUri = await requireRegisteredRedirectUri(input);
  const url = new URL(redirectUri);
  url.searchParams.set("error", "access_denied");
  if (input.state) {
    url.searchParams.set("state", input.state);
  }
  return url.toString();
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
