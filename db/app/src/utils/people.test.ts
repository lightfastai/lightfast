import { describe, expect, it } from "vitest";

import {
  createPersonIdentityKey,
  normalizePersonIdentityCandidate,
  shouldIncrementSeenCount,
} from "./people-identities";

describe("people identity normalization", () => {
  it("normalizes email identities", () => {
    expect(
      normalizePersonIdentityCandidate({
        identityProvider: "email",
        identityType: "email",
        identityValue: "  Jeevan@SomeDomain.com ",
      })
    ).toEqual({
      identityProvider: "email",
      identityType: "email",
      normalizedIdentityValue: "jeevan@somedomain.com",
    });
  });

  it("collapses X profile URLs to X handles", () => {
    expect(
      normalizePersonIdentityCandidate({
        identityProvider: "x",
        identityType: "profile_url",
        identityValue: "https://x.com/JeevanP?ref=home",
      })
    ).toEqual({
      identityProvider: "x",
      identityType: "handle",
      normalizedIdentityValue: "jeevanp",
    });
  });

  it("normalizes X handles", () => {
    expect(
      normalizePersonIdentityCandidate({
        identityProvider: "x",
        identityType: "handle",
        identityValue: " @JeevanP ",
      })
    ).toEqual({
      identityProvider: "x",
      identityType: "handle",
      normalizedIdentityValue: "jeevanp",
    });
  });

  it("keeps non-collapsible profile URLs as profile URLs", () => {
    expect(
      normalizePersonIdentityCandidate({
        identityProvider: "linkedin",
        identityType: "profile_url",
        identityValue: "https://www.linkedin.com/in/JeevanP/?trk=public",
      })
    ).toEqual({
      identityProvider: "linkedin",
      identityType: "profile_url",
      normalizedIdentityValue: "https://www.linkedin.com/in/JeevanP",
    });
  });

  it("returns undefined for unsupported or non-durable identities", () => {
    expect(
      normalizePersonIdentityCandidate({
        identityProvider: "website",
        identityType: "handle",
        identityValue: "not a useful website handle",
      })
    ).toBeUndefined();
  });

  it("creates stable hash keys from normalized identities", () => {
    const first = createPersonIdentityKey({
      identityProvider: "x",
      identityType: "handle",
      normalizedIdentityValue: "jeevanp",
    });
    const second = createPersonIdentityKey({
      identityProvider: "x",
      identityType: "handle",
      normalizedIdentityValue: "jeevanp",
    });

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it("increments seen count only for a new source signal", () => {
    expect(
      shouldIncrementSeenCount({
        existingLastSeenSignalId: "sig_a",
        sourceSignalId: "sig_b",
      })
    ).toBe(true);
    expect(
      shouldIncrementSeenCount({
        existingLastSeenSignalId: "sig_a",
        sourceSignalId: "sig_a",
      })
    ).toBe(false);
  });
});
