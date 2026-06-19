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
} from "@repo/api-contract";
import { verifyDeveloperConnectionInput } from "./adapters";
import { sentryAuthBoxClient } from "./auth-box";
import { listDeveloperConnectionsForOrg } from "./catalog";
import { encryptDeveloperCredential } from "./credentials";
import {
  issueAllEnabledDeveloperConnectionLeases,
  issueDeveloperConnectionLeases,
  materializeDeveloperConnectionLeasesForSandboxRun,
} from "./leases";

interface DeveloperConnectionServiceContext {
  actor: {
    userId: string;
  };
  db: Database;
  organization: {
    orgId: string;
  };
}

export {
  issueAllEnabledDeveloperConnectionLeases,
  issueDeveloperConnectionLeases,
  listDeveloperConnectionsForOrg,
  materializeDeveloperConnectionLeasesForSandboxRun,
};

export async function connectDeveloperConnection(
  ctx: DeveloperConnectionServiceContext,
  input: DeveloperConnectionConnectInput
) {
  const verified = await verifyDeveloperConnectionInput(input);
  const encryptedCredential = await encryptDeveloperCredential(
    verified.credentialPayload
  );
  const connection = await replaceCurrentDeveloperConnection(ctx.db, {
    clerkOrgId: ctx.organization.orgId,
    provider: input.provider,
    providerAccountId: verified.providerAccountId,
    providerAccountName: verified.providerAccountName,
    credentialKind: verified.credentialKind,
    credentialSchemaVersion: verified.credentialSchemaVersion,
    encryptedCredential,
    scopes: verified.scopes,
    metadata: verified.metadata,
    expiresAt: verified.expiresAt,
    actorUserId: ctx.actor.userId,
    verifiedAt: new Date(),
  });
  return { provider: connection.provider, status: connection.status };
}

export async function startSentryDeveloperConnectionAuth(
  ctx: DeveloperConnectionServiceContext,
  input: DeveloperConnectionStartAuthInput
) {
  return await sentryAuthBoxClient.start({
    actorUserId: ctx.actor.userId,
    clerkOrgId: ctx.organization.orgId,
    providerAccountName: input.providerAccountName,
  });
}

export async function completeSentryDeveloperConnectionAuth(
  ctx: DeveloperConnectionServiceContext,
  input: DeveloperConnectionCompleteAuthInput
) {
  const verified = await sentryAuthBoxClient.complete({
    actorUserId: ctx.actor.userId,
    attemptId: input.attemptId,
    clerkOrgId: ctx.organization.orgId,
  });
  const encryptedCredential = await encryptDeveloperCredential({
    token: verified.token,
  });
  const connection = await replaceCurrentDeveloperConnection(ctx.db, {
    clerkOrgId: ctx.organization.orgId,
    provider: "sentry",
    providerAccountId: verified.providerAccountId,
    providerAccountName: verified.providerAccountName,
    credentialKind: "sentry_oauth_token",
    credentialSchemaVersion: "1",
    encryptedCredential,
    scopes: verified.scopes,
    metadata: { authType: "device_code" },
    expiresAt: verified.expiresAt,
    actorUserId: ctx.actor.userId,
    verifiedAt: new Date(),
  });
  return { provider: connection.provider, status: connection.status };
}

export async function setDeveloperConnectionSandboxEnabled(
  ctx: DeveloperConnectionServiceContext,
  input: DeveloperConnectionSetSandboxEnabledInput
) {
  await setCurrentDeveloperConnectionSandboxEnabled(ctx.db, {
    clerkOrgId: ctx.organization.orgId,
    provider: input.provider,
    enabled: input.enabled,
    actorUserId: ctx.actor.userId,
  });
  return { enabled: input.enabled };
}

export async function disconnectDeveloperConnection(
  ctx: DeveloperConnectionServiceContext,
  input: { provider: DeveloperConnectionProvider }
) {
  await revokeCurrentDeveloperConnection(ctx.db, {
    clerkOrgId: ctx.organization.orgId,
    provider: input.provider,
    actorUserId: ctx.actor.userId,
  });
  return { disconnected: true };
}
