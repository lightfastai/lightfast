"use server";

import { issueMcpAuthorizationCode, McpOAuthError } from "@api/app";
import { db } from "@db/app/client";
import { auth } from "@vendor/clerk/server";
import { redirect } from "next/navigation";

export async function approveMcpAuthorizationAction(formData: FormData) {
  const authState = await auth();
  if (!authState.userId) {
    throw new McpOAuthError("access_denied", "Authentication required.", 401);
  }

  const redirectUri = requireString(formData, "redirectUri");
  const result = await issueMcpAuthorizationCode(db, {
    clientId: requireString(formData, "clientId"),
    clerkOrgId: requireString(formData, "organizationId"),
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
  redirect(url.toString());
}

export async function denyMcpAuthorizationAction(formData: FormData) {
  const redirectUri = requireString(formData, "redirectUri");
  const url = new URL(redirectUri);
  url.searchParams.set("error", "access_denied");
  const state = optionalString(formData, "state");
  if (state) {
    url.searchParams.set("state", state);
  }
  redirect(url.toString());
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
