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

export interface GitHubBindInstallAttemptRecord {
  clerkOrgId: string;
  lightfastUserId: string;
  orgSlug: string;
  stateHash: string;
}

export interface GitHubBindOAuthAttemptRecord
  extends GitHubBindInstallAttemptRecord {
  codeVerifier: string;
  providerInstallationId: string;
  setupAction?: string;
}

function encodeState(input: { attemptId: string; nonce: string }): string {
  return Buffer.from(JSON.stringify(input), "utf8").toString("base64url");
}

function decodeState(
  state: string
): { attemptId: string; nonce: string } | null {
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

function getAttemptKey(input: { prefix: string; state: string }) {
  const envelope = decodeState(input.state);
  if (!envelope) {
    return null;
  }

  return `${input.prefix}${envelope.attemptId}`;
}

function isMatchingAttempt<T extends { stateHash: string }>(
  record: T | null,
  state: string
) {
  if (!record || record.stateHash !== hashState(state)) {
    return false;
  }
  return true;
}

async function lookupGitHubAttempt<T extends { stateHash: string }>(input: {
  prefix: string;
  state: string;
}): Promise<T | null> {
  const key = getAttemptKey(input);
  if (!key) {
    return null;
  }

  const record = await redis.get<T>(key);
  return isMatchingAttempt(record, input.state) ? record : null;
}

async function consumeGitHubAttempt<T extends { stateHash: string }>(input: {
  prefix: string;
  state: string;
}): Promise<T | null> {
  const key = getAttemptKey(input);
  if (!key) {
    return null;
  }

  const pendingRecord = await redis.get<T>(key);
  if (!isMatchingAttempt(pendingRecord, input.state)) {
    return null;
  }

  const consumedRecord = await redis.getdel<T>(key);
  return isMatchingAttempt(consumedRecord, input.state) ? consumedRecord : null;
}

export async function issueGitHubInstallAttempt(input: {
  clerkOrgId: string;
  lightfastUserId: string;
  orgSlug: string;
}) {
  const attemptId = nanoid(32);
  const state = encodeState({ attemptId, nonce: nanoid(32) });
  const record: GitHubBindInstallAttemptRecord = {
    clerkOrgId: input.clerkOrgId,
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
  return consumeGitHubAttempt<GitHubBindInstallAttemptRecord>({
    prefix: INSTALL_PREFIX,
    state: input.state,
  });
}

export async function lookupGitHubInstallAttempt(input: {
  state: string;
}): Promise<GitHubBindInstallAttemptRecord | null> {
  return lookupGitHubAttempt<GitHubBindInstallAttemptRecord>({
    prefix: INSTALL_PREFIX,
    state: input.state,
  });
}

export async function issueGitHubOAuthAttempt(input: {
  clerkOrgId: string;
  codeVerifier: string;
  lightfastUserId: string;
  orgSlug: string;
  providerInstallationId: string;
  setupAction?: string;
}) {
  const attemptId = nanoid(32);
  const state = encodeState({ attemptId, nonce: nanoid(32) });
  const record: GitHubBindOAuthAttemptRecord = {
    clerkOrgId: input.clerkOrgId,
    codeVerifier: input.codeVerifier,
    lightfastUserId: input.lightfastUserId,
    orgSlug: input.orgSlug,
    providerInstallationId: input.providerInstallationId,
    ...(input.setupAction ? { setupAction: input.setupAction } : {}),
    stateHash: hashState(state),
  };
  await redis.set(`${OAUTH_PREFIX}${attemptId}`, record, { ex: TTL_SECONDS });
  return { attemptId, state };
}

export async function consumeGitHubOAuthAttempt(input: {
  state: string;
}): Promise<GitHubBindOAuthAttemptRecord | null> {
  return consumeGitHubAttempt<GitHubBindOAuthAttemptRecord>({
    prefix: OAUTH_PREFIX,
    state: input.state,
  });
}

export async function lookupGitHubOAuthAttempt(input: {
  state: string;
}): Promise<GitHubBindOAuthAttemptRecord | null> {
  return lookupGitHubAttempt<GitHubBindOAuthAttemptRecord>({
    prefix: OAUTH_PREFIX,
    state: input.state,
  });
}
