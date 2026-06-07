import type { EntityObservation } from "@repo/entity-resolution";
import { z } from "zod";

const optionalNullableStringSchema = z.string().nullable().optional();
const stringOrNumberSchema = z.union([z.string(), z.number()]);

const rawXUserPayloadSchema = z
  .object({
    description: optionalNullableStringSchema,
    id: stringOrNumberSchema,
    location: optionalNullableStringSchema,
    name: optionalNullableStringSchema,
    url: optionalNullableStringSchema,
    username: z.string(),
  })
  .passthrough();

const rawGitHubUserPayloadSchema = z
  .object({
    bio: optionalNullableStringSchema,
    blog: optionalNullableStringSchema,
    company: optionalNullableStringSchema,
    email: optionalNullableStringSchema,
    id: stringOrNumberSchema,
    location: optionalNullableStringSchema,
    login: z.string(),
    name: optionalNullableStringSchema,
    twitter_username: optionalNullableStringSchema,
    twitterUsername: optionalNullableStringSchema,
  })
  .passthrough();

export function xUserPayloadToObservation(
  payload: unknown,
  observedAt: Date
): EntityObservation | null {
  const parsed = rawXUserPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return null;
  }

  const id = cleanRequiredString(parsed.data.id);
  const username = cleanRequiredString(parsed.data.username);
  if (!id || !username) {
    return null;
  }

  const profile: Extract<EntityObservation, { provider: "x" }>["profile"] = {
    id,
    username,
  };
  setOptionalProfileField(profile, "description", parsed.data.description);
  setOptionalProfileField(profile, "location", parsed.data.location);
  setOptionalProfileField(profile, "name", parsed.data.name);
  setOptionalProfileField(profile, "url", parsed.data.url);

  return {
    observedAt: observedAt.toISOString(),
    profile,
    provider: "x",
  };
}

export function githubUserPayloadToObservation(
  payload: unknown,
  observedAt: Date
): EntityObservation | null {
  const parsed = rawGitHubUserPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return null;
  }

  const id = cleanRequiredString(parsed.data.id);
  const login = cleanRequiredString(parsed.data.login);
  if (!id || !login) {
    return null;
  }

  const profile: Extract<
    EntityObservation,
    { provider: "github" }
  >["profile"] = {
    id,
    login,
  };
  setOptionalProfileField(profile, "bio", parsed.data.bio);
  setOptionalProfileField(profile, "blog", parsed.data.blog);
  setOptionalProfileField(profile, "company", parsed.data.company);
  setOptionalProfileField(profile, "email", parsed.data.email);
  setOptionalProfileField(profile, "location", parsed.data.location);
  setOptionalProfileField(profile, "name", parsed.data.name);
  setOptionalProfileField(
    profile,
    "twitterUsername",
    parsed.data.twitterUsername ?? parsed.data.twitter_username
  );

  return {
    observedAt: observedAt.toISOString(),
    profile,
    provider: "github",
  };
}

function cleanRequiredString(value: string | number): string | null {
  const cleaned = String(value).trim();
  return cleaned.length > 0 ? cleaned : null;
}

function cleanOptionalNullableString(
  value: string | null | undefined
): string | null | undefined {
  if (value === null) {
    return null;
  }
  if (value === undefined) {
    return undefined;
  }
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
}

function setOptionalProfileField<
  TProfile extends Record<string, unknown>,
  TKey extends keyof TProfile,
>(
  profile: TProfile,
  key: TKey,
  value: string | null | undefined
) {
  const cleaned = cleanOptionalNullableString(value);
  if (cleaned !== undefined) {
    profile[key] = cleaned as TProfile[TKey];
  }
}
