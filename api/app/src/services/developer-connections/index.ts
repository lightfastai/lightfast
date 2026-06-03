import type { Database } from "@db/app";
import {
  replaceCurrentDeveloperConnection,
  revokeCurrentDeveloperConnection,
  setCurrentDeveloperConnectionSandboxEnabled,
} from "@db/app";
import type {
  DeveloperConnectionCompleteAuthInput,
  DeveloperConnectionConnectInput,
  DeveloperConnectionProvider,
  DeveloperConnectionSetSandboxEnabledInput,
  DeveloperConnectionStartAuthInput,
} from "@repo/developer-connection-contract";
import { TRPCError } from "@trpc/server";
import type { AuthContext } from "../../trpc";
import { verifyDeveloperConnectionInput } from "./adapters";
import { sentryAuthBoxClient } from "./auth-box";
import { listDeveloperConnectionsForOrg } from "./catalog";
import { encryptDeveloperCredential } from "./credentials";
import { issueDeveloperConnectionLeases } from "./leases";

interface DeveloperConnectionServiceContext {
  auth: AuthContext;
  db: Database;
  headers: Headers;
}

export { issueDeveloperConnectionLeases, listDeveloperConnectionsForOrg };

function activeAdmin(ctx: DeveloperConnectionServiceContext) {
  const identity = ctx.auth.identity;
  const access = ctx.auth.access;
  if (
    identity.type !== "active" ||
    access?.kind !== "clerk-session" ||
    access.userId !== identity.userId ||
    access.orgId !== identity.orgId ||
    !access.has({ role: "org:admin" })
  ) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return identity;
}

export async function connectDeveloperConnection(
  ctx: DeveloperConnectionServiceContext,
  input: DeveloperConnectionConnectInput
) {
  const identity = activeAdmin(ctx);
  const verified = await verifyDeveloperConnectionInput(input);
  const encryptedCredential = await encryptDeveloperCredential(
    verified.credentialPayload
  );
  const connection = await replaceCurrentDeveloperConnection(ctx.db, {
    clerkOrgId: identity.orgId,
    provider: input.provider,
    providerAccountId: verified.providerAccountId,
    providerAccountName: verified.providerAccountName,
    credentialKind: verified.credentialKind,
    credentialSchemaVersion: verified.credentialSchemaVersion,
    encryptedCredential,
    scopes: verified.scopes,
    metadata: verified.metadata,
    expiresAt: verified.expiresAt,
    actorUserId: identity.userId,
    verifiedAt: new Date(),
  });
  return { provider: connection.provider, status: connection.status };
}

export async function startSentryDeveloperConnectionAuth(
  ctx: DeveloperConnectionServiceContext,
  input: DeveloperConnectionStartAuthInput
) {
  const identity = activeAdmin(ctx);
  return await sentryAuthBoxClient.start({
    actorUserId: identity.userId,
    clerkOrgId: identity.orgId,
    providerAccountName: input.providerAccountName,
  });
}

export async function completeSentryDeveloperConnectionAuth(
  ctx: DeveloperConnectionServiceContext,
  input: DeveloperConnectionCompleteAuthInput
) {
  const identity = activeAdmin(ctx);
  const verified = await sentryAuthBoxClient.complete({
    actorUserId: identity.userId,
    attemptId: input.attemptId,
    clerkOrgId: identity.orgId,
  });
  const encryptedCredential = await encryptDeveloperCredential({
    token: verified.token,
  });
  const connection = await replaceCurrentDeveloperConnection(ctx.db, {
    clerkOrgId: identity.orgId,
    provider: "sentry",
    providerAccountId: verified.providerAccountId,
    providerAccountName: verified.providerAccountName,
    credentialKind: "sentry_oauth_token",
    credentialSchemaVersion: "1",
    encryptedCredential,
    scopes: verified.scopes,
    metadata: { authType: "device_code" },
    expiresAt: verified.expiresAt,
    actorUserId: identity.userId,
    verifiedAt: new Date(),
  });
  return { provider: connection.provider, status: connection.status };
}

export async function setDeveloperConnectionSandboxEnabled(
  ctx: DeveloperConnectionServiceContext,
  input: DeveloperConnectionSetSandboxEnabledInput
) {
  const identity = activeAdmin(ctx);
  await setCurrentDeveloperConnectionSandboxEnabled(ctx.db, {
    clerkOrgId: identity.orgId,
    provider: input.provider,
    enabled: input.enabled,
    actorUserId: identity.userId,
  });
  return { enabled: input.enabled };
}

export async function disconnectDeveloperConnection(
  ctx: DeveloperConnectionServiceContext,
  input: { provider: DeveloperConnectionProvider }
) {
  const identity = activeAdmin(ctx);
  await revokeCurrentDeveloperConnection(ctx.db, {
    clerkOrgId: identity.orgId,
    provider: input.provider,
    actorUserId: identity.userId,
  });
  return { disconnected: true };
}
