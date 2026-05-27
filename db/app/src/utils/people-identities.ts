import { createHash } from "node:crypto";

import type { PersonIdentityProvider, PersonIdentityType } from "../schema";

export interface PersonIdentityCandidateInput {
  identityProvider: PersonIdentityProvider;
  identityType: PersonIdentityType;
  identityValue: string;
}

export interface NormalizedPersonIdentity {
  identityProvider: PersonIdentityProvider;
  identityType: PersonIdentityType;
  normalizedIdentityValue: string;
}

export function normalizePersonIdentityCandidate(
  input: PersonIdentityCandidateInput
): NormalizedPersonIdentity | undefined {
  if (input.identityProvider === "email" && input.identityType === "email") {
    const normalized = input.identityValue.trim().toLowerCase();
    return normalized.includes("@")
      ? {
          identityProvider: "email",
          identityType: "email",
          normalizedIdentityValue: normalized,
        }
      : undefined;
  }

  if (input.identityType === "handle") {
    return normalizeHandle(input.identityProvider, input.identityValue);
  }

  if (input.identityType === "profile_url") {
    return normalizeProfileUrl(input.identityProvider, input.identityValue);
  }

  return;
}

export function createPersonIdentityKey(
  input: NormalizedPersonIdentity
): string {
  return createHash("sha256")
    .update(
      [
        input.identityProvider,
        input.identityType,
        input.normalizedIdentityValue,
      ].join("\0")
    )
    .digest("hex");
}

export function shouldIncrementSeenCount(input: {
  existingLastSeenSignalId: string | null;
  sourceSignalId: string;
}): boolean {
  return input.existingLastSeenSignalId !== input.sourceSignalId;
}

function normalizeHandle(
  provider: PersonIdentityProvider,
  value: string
): NormalizedPersonIdentity | undefined {
  if (!["x", "github"].includes(provider)) {
    return;
  }

  const normalized = value.trim().replace(/^@/, "").toLowerCase();
  if (!normalized || normalized.includes("/") || normalized.includes(" ")) {
    return;
  }

  return {
    identityProvider: provider,
    identityType: "handle",
    normalizedIdentityValue: normalized,
  };
}

function normalizeProfileUrl(
  provider: PersonIdentityProvider,
  value: string
): NormalizedPersonIdentity | undefined {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return;
  }

  url.hash = "";
  url.search = "";
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const pathname = url.pathname.replace(/\/$/, "");

  if (provider === "x" && ["x.com", "twitter.com"].includes(host)) {
    const handle = pathname.split("/").filter(Boolean)[0];
    return handle ? normalizeHandle("x", handle) : undefined;
  }

  if (provider === "github" && host === "github.com") {
    const handle = pathname.split("/").filter(Boolean)[0];
    return handle ? normalizeHandle("github", handle) : undefined;
  }

  if (provider === "linkedin" && host === "linkedin.com") {
    const normalizedPath = pathname || "/";
    const match = /^\/in\/([^/\s]+)$/.exec(normalizedPath);
    if (!match) {
      return;
    }
    return {
      identityProvider: "linkedin",
      identityType: "profile_url",
      normalizedIdentityValue: `https://www.linkedin.com/in/${match[1]}`,
    };
  }

  if (provider === "website" && url.protocol.startsWith("http")) {
    return {
      identityProvider: "website",
      identityType: "profile_url",
      normalizedIdentityValue: `${url.protocol}//${host}${pathname || ""}`,
    };
  }

  return;
}
