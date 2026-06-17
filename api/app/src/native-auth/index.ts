import type { Database } from "@db/app";
import { db as defaultDb } from "@db/app/client";
import {
  NATIVE_AUTH_HEADERS,
  type NativeClient,
  type NativeCreateAttemptInput,
  type NativeOAuthConfig,
  type NativeOrganization,
  type NativeSessionMetadata,
  type nativeFinalizeRequestSchema,
  nativeSessionMetadataSchema,
} from "@repo/native-auth-contract";
import { clerkClient } from "@vendor/clerk/server";
import type { z } from "zod";

import {
  findUserOrganizationMembership,
  listUserOrganizationMemberships,
} from "../auth/clerk-org-membership";
import type { AuthIdentity, ResolvedAuthContext } from "../auth/identity";
import { resolveAuthContextFromClerk } from "../auth/identity";
import {
  consumeNativeAuthAttempt,
  issueNativeAuthAttempt,
} from "../auth/native-auth-attempts";
import {
  buildClerkAuthorizeUrl,
  getNativeOAuthConfig,
} from "../auth/native-oauth";
import { resolveOrgSetupGate } from "../auth/org-setup-gate";
import { toAccountProfile } from "../domain/account";

export type NativeFinalizeRequest = z.infer<typeof nativeFinalizeRequestSchema>;

export type NativeAuthErrorCode =
  | "FORBIDDEN"
  | "INTERNAL_SERVER_ERROR"
  | "UNAUTHORIZED";

const nativeAuthErrorStatuses = {
  FORBIDDEN: 403,
  INTERNAL_SERVER_ERROR: 500,
  UNAUTHORIZED: 401,
} satisfies Record<NativeAuthErrorCode, number>;

export class NativeAuthError extends Error {
  readonly code: NativeAuthErrorCode;
  readonly status: number;

  constructor(code: NativeAuthErrorCode, message: string) {
    super(message);
    this.name = "NativeAuthError";
    this.code = code;
    this.status = nativeAuthErrorStatuses[code];
  }
}

export function isNativeAuthError(error: unknown): error is NativeAuthError {
  return error instanceof NativeAuthError;
}

export function getNativeOAuthClientConfig(input: {
  client: NativeClient;
}): NativeOAuthConfig {
  const config = getNativeOAuthConfig(input.client);
  if (!config) {
    throw new NativeAuthError(
      "INTERNAL_SERVER_ERROR",
      `${input.client} OAuth is not configured`
    );
  }
  return config;
}

async function listMembershipsForUser(userId: string) {
  return listUserOrganizationMemberships({ userId });
}

export async function listNativeOrganizationsForUser(input: {
  db: Database;
  userId: string;
}): Promise<NativeOrganization[]> {
  const memberships = await listMembershipsForUser(input.userId);
  return Promise.all(
    memberships.map(async (membership) => {
      const gate = await resolveOrgSetupGate({
        db: input.db,
        clerkOrgId: membership.organization.id,
      });
      return {
        bindingStatus: gate.bindingStatus,
        id: membership.organization.id,
        name: membership.organization.name,
        role: membership.role,
        slug: membership.organization.slug,
      };
    })
  );
}

function requireSignedInIdentity(
  auth: ResolvedAuthContext
): Extract<AuthIdentity, { type: "active" | "pending" }> {
  if (auth.identity.type === "unauthenticated") {
    throw new NativeAuthError(
      "UNAUTHORIZED",
      "Authentication required. Please sign in."
    );
  }
  return auth.identity;
}

function requireNativeOAuthContext(auth: ResolvedAuthContext) {
  if (
    auth.identity.type === "unauthenticated" ||
    auth.access?.kind !== "clerk-oauth"
  ) {
    throw new NativeAuthError(
      "UNAUTHORIZED",
      "Lightfast native OAuth authentication required."
    );
  }

  return {
    access: auth.access,
    identity: auth.identity,
  };
}

async function assertNativeOrgMembership(input: {
  organizationId: string;
  userId: string;
}): Promise<void> {
  const membership = await findUserOrganizationMembership({
    organizationId: input.organizationId,
    userId: input.userId,
  });
  if (!membership) {
    throw new NativeAuthError(
      "FORBIDDEN",
      "User is not a member of the selected organization"
    );
  }
}

async function createNativeSessionMetadata(input: {
  client: NativeClient;
  db: Database;
  organizationId: string;
  userId: string;
}): Promise<NativeSessionMetadata> {
  const clerk = await clerkClient();
  const [user, organizations] = await Promise.all([
    clerk.users.getUser(input.userId),
    listNativeOrganizationsForUser({
      db: input.db,
      userId: input.userId,
    }),
  ]);
  const organization = organizations.find(
    (entry) => entry.id === input.organizationId
  );
  if (!organization) {
    throw new NativeAuthError(
      "FORBIDDEN",
      "User is not a member of the selected organization"
    );
  }
  const profile = toAccountProfile(user);

  return nativeSessionMetadataSchema.parse({
    client: input.client,
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    },
    user: {
      email: profile.primaryEmailAddress,
      id: profile.id,
      imageUrl: profile.imageUrl,
      initials: profile.initials,
      username: profile.username,
    },
  });
}

export async function listNativeOrganizationsForAuthContext(input: {
  auth: ResolvedAuthContext;
  db: Database;
}): Promise<NativeOrganization[]> {
  const identity = requireSignedInIdentity(input.auth);
  return listNativeOrganizationsForUser({
    db: input.db,
    userId: identity.userId,
  });
}

export async function createNativeAuthAttemptForUser(input: {
  db: Database;
  data: NativeCreateAttemptInput;
  userId: string;
}) {
  await assertNativeOrgMembership({
    organizationId: input.data.organizationId,
    userId: input.userId,
  });
  const config = getNativeOAuthClientConfig({ client: input.data.client });
  const issued = await issueNativeAuthAttempt({
    ...input.data,
    userId: input.userId,
  });
  return {
    authorizationUrl: buildClerkAuthorizeUrl({
      codeChallenge: input.data.codeChallenge,
      config,
      redirectUri: input.data.redirectUri,
      state: issued.state,
    }),
    attemptId: issued.attemptId,
  };
}

export async function createNativeAuthAttemptForAuthContext(input: {
  auth: ResolvedAuthContext;
  data: NativeCreateAttemptInput;
  db: Database;
}) {
  const identity = requireSignedInIdentity(input.auth);
  return createNativeAuthAttemptForUser({
    data: input.data,
    db: input.db,
    userId: identity.userId,
  });
}

export async function getNativeAuthSessionForAuthContext(input: {
  auth: ResolvedAuthContext;
  db: Database;
}) {
  const { access, identity } = requireNativeOAuthContext(input.auth);
  if (identity.type !== "active") {
    throw new NativeAuthError(
      "FORBIDDEN",
      "Native session organization required"
    );
  }

  return createNativeSessionMetadata({
    db: input.db,
    client: access.client,
    organizationId: identity.orgId,
    userId: identity.userId,
  });
}

export async function finalizeNativeAuthAttemptForAuthContext(input: {
  auth: ResolvedAuthContext;
  data: NativeFinalizeRequest;
  db: Database;
}) {
  const { access } = requireNativeOAuthContext(input.auth);
  const attempt = await consumeNativeAuthAttempt({
    attemptId: input.data.attemptId,
    state: input.data.state,
  });
  if (!attempt || attempt.client !== input.data.client) {
    throw new NativeAuthError("UNAUTHORIZED", "Invalid native auth attempt");
  }
  if (access.userId !== attempt.userId) {
    throw new NativeAuthError("FORBIDDEN", "Native auth user mismatch");
  }
  return createNativeSessionMetadata({
    db: input.db,
    client: input.data.client,
    organizationId: attempt.organizationId,
    userId: attempt.userId,
  });
}

async function resolveNativeOAuthRequestAuth(input: {
  db?: Database;
  headers: Headers;
  source: NativeClient;
}) {
  const headers = new Headers(input.headers);
  headers.set(NATIVE_AUTH_HEADERS.client, input.source);

  return resolveAuthContextFromClerk({
    db: input.db ?? defaultDb,
    headers,
  });
}

export async function getNativeAuthSessionForRequest(input: {
  db?: Database;
  headers: Headers;
  source: NativeClient;
}) {
  const auth = await resolveNativeOAuthRequestAuth(input);
  return getNativeAuthSessionForAuthContext({
    auth,
    db: input.db ?? defaultDb,
  });
}

export async function finalizeNativeAuthAttemptForRequest(input: {
  data: NativeFinalizeRequest;
  db?: Database;
  headers: Headers;
  source: NativeClient;
}) {
  const auth = await resolveNativeOAuthRequestAuth(input);
  return finalizeNativeAuthAttemptForAuthContext({
    auth,
    data: input.data,
    db: input.db ?? defaultDb,
  });
}
