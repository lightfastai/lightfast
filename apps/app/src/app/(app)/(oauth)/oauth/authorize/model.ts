import {
  isValidMcpS256CodeChallenge,
  McpOAuthError,
  parseMcpScopes,
} from "@api/app";
import { getMcpOauthClientByClientId } from "@db/app";
import { db } from "@db/app/client";
import type { McpScope } from "@repo/api-contract";
import { auth, clerkClient, currentUser } from "@vendor/clerk/server";
import { notFound } from "next/navigation";
import { z } from "zod";

const authorizeSearchParamsSchema = z.object({
  client_id: z.string().min(1),
  code_challenge: z.string().refine(isValidMcpS256CodeChallenge),
  code_challenge_method: z.literal("S256"),
  redirect_uri: z.string().url(),
  resource: z.string().url(),
  scope: z.string().optional(),
  state: z.string().optional(),
});

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

export async function getMcpConsentViewModel(
  searchParams: Record<string, string | string[] | undefined>
): Promise<McpConsentViewModel> {
  const parsed = authorizeSearchParamsSchema.safeParse(flatten(searchParams));
  if (!parsed.success) {
    notFound();
  }

  const authState = await auth();
  if (!authState.userId) {
    notFound();
  }

  const client = await getMcpOauthClientByClientId(db, {
    publicClientId: parsed.data.client_id,
  });
  if (!client?.redirectUris.includes(parsed.data.redirect_uri)) {
    notFound();
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
    notFound();
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

function parseConsentScopes(scope: string | undefined): McpScope[] {
  try {
    return parseMcpScopes(scope);
  } catch (error) {
    if (error instanceof McpOAuthError) {
      notFound();
    }
    throw error;
  }
}

function flatten(input: Record<string, string | string[] | undefined>) {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ])
  );
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
