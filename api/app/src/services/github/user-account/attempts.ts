import { createHash } from "node:crypto";
import { githubUserAccountReturnToSchema } from "@lightfast/connector-github/contract";
import { nanoid } from "@vendor/lib";
import { redis } from "@vendor/upstash";
import { z } from "zod";

const USER_ACCOUNT_OAUTH_PREFIX = "github-user-account-oauth-attempt:";
const TTL_SECONDS = 15 * 60;

const stateEnvelopeSchema = z.object({
  attemptId: z.string().min(16),
  nonce: z.string().min(16),
});

const optionalReturnToSchema = githubUserAccountReturnToSchema.optional();

const attemptRecordSchema = z.object({
  codeVerifier: z.string().min(1),
  lightfastUserId: z.string().min(1),
  returnTo: optionalReturnToSchema,
  stateHash: z.string().regex(/^[a-f0-9]{64}$/i),
});

export interface GitHubUserAccountOAuthAttemptRecord {
  codeVerifier: string;
  lightfastUserId: string;
  returnTo?: string;
  stateHash: string;
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

function getAttemptKey(state: string): string | null {
  const envelope = decodeState(state);
  if (!envelope) {
    return null;
  }

  return `${USER_ACCOUNT_OAUTH_PREFIX}${envelope.attemptId}`;
}

function parseMatchingAttempt(
  record: unknown,
  state: string
): GitHubUserAccountOAuthAttemptRecord | null {
  const parsedRecord = attemptRecordSchema.safeParse(record);
  if (
    !parsedRecord.success ||
    parsedRecord.data.stateHash !== hashState(state)
  ) {
    return null;
  }
  return parsedRecord.data;
}

export async function issueGitHubUserAccountOAuthAttempt(input: {
  codeVerifier: string;
  lightfastUserId: string;
  returnTo?: string;
}): Promise<{ attemptId: string; state: string }> {
  const attemptId = nanoid(32);
  const state = encodeState({ attemptId, nonce: nanoid(32) });
  const returnTo = optionalReturnToSchema.parse(input.returnTo);
  const record: GitHubUserAccountOAuthAttemptRecord = {
    codeVerifier: input.codeVerifier,
    lightfastUserId: input.lightfastUserId,
    ...(returnTo === undefined ? {} : { returnTo }),
    stateHash: hashState(state),
  };
  await redis.set(`${USER_ACCOUNT_OAUTH_PREFIX}${attemptId}`, record, {
    ex: TTL_SECONDS,
  });
  return { attemptId, state };
}

export async function lookupGitHubUserAccountOAuthAttempt(input: {
  state: string;
}): Promise<GitHubUserAccountOAuthAttemptRecord | null> {
  const key = getAttemptKey(input.state);
  if (!key) {
    return null;
  }

  const record = await redis.get<unknown>(key);
  return parseMatchingAttempt(record, input.state);
}

export async function consumeGitHubUserAccountOAuthAttempt(input: {
  state: string;
}): Promise<GitHubUserAccountOAuthAttemptRecord | null> {
  const key = getAttemptKey(input.state);
  if (!key) {
    return null;
  }

  const pendingRecord = parseMatchingAttempt(
    await redis.get<unknown>(key),
    input.state
  );
  if (!pendingRecord) {
    return null;
  }

  const consumedRecord = await redis.getdel<unknown>(key);
  return parseMatchingAttempt(consumedRecord, input.state);
}
