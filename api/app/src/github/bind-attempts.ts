import { createHash } from "node:crypto";
import { nanoid } from "@vendor/lib";
import { redis } from "@vendor/upstash";
import { z } from "zod";

const INSTALL_PREFIX = "github-bind-install-attempt:";
const OAUTH_PREFIX = "github-bind-oauth-attempt:";
const TTL_SECONDS = 15 * 60;

const stateEnvelopeSchema = z.object({
  attemptId: z.string().min(16),
  nonce: z.string().min(16),
});

export interface GitHubEmulatorAttemptContext {
  emulatorOrigin: string;
  installationId: string;
  providerAccountLogin: string;
}

export interface GitHubBindInstallAttemptRecord {
  clerkOrgId: string;
  emulator: GitHubEmulatorAttemptContext;
  lightfastUserId: string;
  orgSlug: string;
  stateHash: string;
}

export interface GitHubBindOAuthAttemptRecord
  extends GitHubBindInstallAttemptRecord {
  codeVerifier: string;
  providerInstallationId: string;
}

function encodeState(input: { attemptId: string; nonce: string }): string {
  return Buffer.from(JSON.stringify(input), "utf8").toString("base64url");
}

function decodeState(state: string): { attemptId: string; nonce: string } | null {
  try {
    return stateEnvelopeSchema.parse(
      JSON.parse(Buffer.from(state, "base64url").toString("utf8"))
    );
  } catch {
    return null;
  }
}

function hashState(state: string): string {
  return createHash("sha256").update(state).digest("hex");
}

async function readGitHubAttempt<T extends { stateHash: string }>(input: {
  consume: boolean;
  prefix: string;
  state: string;
}): Promise<T | null> {
  const envelope = decodeState(input.state);
  if (!envelope) {
    return null;
  }

  const key = `${input.prefix}${envelope.attemptId}`;
  const record = input.consume
    ? await redis.getdel<T>(key)
    : await redis.get<T>(key);
  if (!record || record.stateHash !== hashState(input.state)) {
    return null;
  }
  return record;
}

export async function issueGitHubInstallAttempt(input: {
  clerkOrgId: string;
  emulator: GitHubEmulatorAttemptContext;
  lightfastUserId: string;
  orgSlug: string;
}) {
  const attemptId = nanoid(32);
  const state = encodeState({ attemptId, nonce: nanoid(32) });
  const record: GitHubBindInstallAttemptRecord = {
    clerkOrgId: input.clerkOrgId,
    emulator: input.emulator,
    lightfastUserId: input.lightfastUserId,
    orgSlug: input.orgSlug,
    stateHash: hashState(state),
  };
  await redis.set(`${INSTALL_PREFIX}${attemptId}`, record, { ex: TTL_SECONDS });
  return { attemptId, state };
}

export async function consumeGitHubInstallAttempt(input: {
  state: string;
}): Promise<GitHubBindInstallAttemptRecord | null> {
  return readGitHubAttempt<GitHubBindInstallAttemptRecord>({
    consume: true,
    prefix: INSTALL_PREFIX,
    state: input.state,
  });
}

export async function lookupGitHubInstallAttempt(input: {
  state: string;
}): Promise<GitHubBindInstallAttemptRecord | null> {
  return readGitHubAttempt<GitHubBindInstallAttemptRecord>({
    consume: false,
    prefix: INSTALL_PREFIX,
    state: input.state,
  });
}

export async function issueGitHubOAuthAttempt(input: {
  clerkOrgId: string;
  codeVerifier: string;
  emulator: GitHubEmulatorAttemptContext;
  lightfastUserId: string;
  orgSlug: string;
  providerInstallationId: string;
}) {
  const attemptId = nanoid(32);
  const state = encodeState({ attemptId, nonce: nanoid(32) });
  const record: GitHubBindOAuthAttemptRecord = {
    clerkOrgId: input.clerkOrgId,
    codeVerifier: input.codeVerifier,
    emulator: input.emulator,
    lightfastUserId: input.lightfastUserId,
    orgSlug: input.orgSlug,
    providerInstallationId: input.providerInstallationId,
    stateHash: hashState(state),
  };
  await redis.set(`${OAUTH_PREFIX}${attemptId}`, record, { ex: TTL_SECONDS });
  return { attemptId, state };
}

export async function consumeGitHubOAuthAttempt(input: {
  state: string;
}): Promise<GitHubBindOAuthAttemptRecord | null> {
  return readGitHubAttempt<GitHubBindOAuthAttemptRecord>({
    consume: true,
    prefix: OAUTH_PREFIX,
    state: input.state,
  });
}

export async function lookupGitHubOAuthAttempt(input: {
  state: string;
}): Promise<GitHubBindOAuthAttemptRecord | null> {
  return readGitHubAttempt<GitHubBindOAuthAttemptRecord>({
    consume: false,
    prefix: OAUTH_PREFIX,
    state: input.state,
  });
}
