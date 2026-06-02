"use server";

import { issueMcpAuthorizationCode, McpOAuthError } from "@api/app";
import { getMcpOauthClientByClientId } from "@db/app";
import { db } from "@db/app/client";
import { auth, clerkClient } from "@vendor/clerk/server";
import type { Route } from "next";
import { redirect } from "next/navigation";

export async function approveMcpAuthorizationAction(formData: FormData) {
  const authState = await auth();
  if (!authState.userId) {
    throw new McpOAuthError("access_denied", "Authentication required.", 401);
  }

  const clerkOrgId = requireString(formData, "organizationId");
  await requireUserOrgMembership({
    clerkOrgId,
    userId: authState.userId,
  });

  const redirectUri = requireString(formData, "redirectUri");
  const result = await issueMcpAuthorizationCode(db, {
    clientId: requireString(formData, "clientId"),
    clerkOrgId,
    clerkUserId: authState.userId,
    codeChallenge: requireString(formData, "codeChallenge"),
    codeChallengeMethod: "S256",
    redirectUri,
    resource: requireString(formData, "resource"),
    scope: optionalString(formData, "scope"),
  });

  const url = new URL(redirectUri);
  url.searchParams.set("code", result.code);
  const state = optionalString(formData, "state");
  if (state) {
    url.searchParams.set("state", state);
  }
  redirect(url.toString() as Route);
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

export async function denyMcpAuthorizationAction(formData: FormData) {
  const authState = await auth();
  if (!authState.userId) {
    throw new McpOAuthError("access_denied", "Authentication required.", 401);
  }

  const redirectUri = await requireRegisteredRedirectUri(formData);
  const url = new URL(redirectUri);
  url.searchParams.set("error", "access_denied");
  const state = optionalString(formData, "state");
  if (state) {
    url.searchParams.set("state", state);
  }
  redirect(url.toString() as Route);
}

async function requireRegisteredRedirectUri(
  formData: FormData
): Promise<string> {
  const clientId = requireString(formData, "clientId");
  const redirectUri = requireString(formData, "redirectUri");
  const client = await getMcpOauthClientByClientId(db, {
    publicClientId: clientId,
  });
  if (!client?.redirectUris.includes(redirectUri)) {
    throw new McpOAuthError(
      "invalid_request",
      "Redirect URI is not registered."
    );
  }
  return redirectUri;
}

function requireString(formData: FormData, key: string): string {
  const value = optionalString(formData, key);
  if (!value) {
    throw new McpOAuthError("invalid_request", `${key} is required.`);
  }
  return value;
}

function optionalString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
