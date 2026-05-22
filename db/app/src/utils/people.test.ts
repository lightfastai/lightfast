import type { Database, Person } from "@db/app";
import { describe, expect, it, vi } from "vitest";

import { upsertPeopleFromCandidates } from "./people";
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

function makePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: 1,
    publicId: "person_123e4567-e89b-12d3-a456-426614174000",
    clerkOrgId: "org_test",
    displayName: "Jeevan Pillay",
    identityProvider: "x",
    identityType: "handle",
    identityValue: "@jeevanp",
    normalizedIdentityValue: "jeevanp",
    identityKey: createPersonIdentityKey({
      identityProvider: "x",
      identityType: "handle",
      normalizedIdentityValue: "jeevanp",
    }),
    firstSeenSignalId: "sig_first",
    lastSeenSignalId: "sig_first",
    seenCount: 1,
    metadata: {},
    createdAt: "2026-05-22 00:00:00.000",
    updatedAt: "2026-05-22 00:00:00.000",
    ...overrides,
  };
}

function makePeopleDb(selectResults: Person[][]) {
  const selectQueue = [...selectResults];
  const spies = {
    insertValues: vi.fn(),
    duplicateSet: vi.fn(),
  };
  const db = {
    insert: () => ({
      values: (values: unknown) => {
        spies.insertValues(values);
        return {
          onDuplicateKeyUpdate: ({ set }: { set: unknown }) => {
            spies.duplicateSet(set);
            return Promise.resolve({ rowsAffected: 1 });
          },
        };
      },
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(selectQueue.shift() ?? []),
        }),
      }),
    }),
  };
  return { db: db as unknown as Database, spies };
}

describe("upsertPeopleFromCandidates", () => {
  it("normalizes and upserts durable candidates", async () => {
    const existing = makePerson();
    const { db, spies } = makePeopleDb([[existing]]);

    await expect(
      upsertPeopleFromCandidates(db, {
        clerkOrgId: "org_test",
        candidates: [
          {
            displayName: "Jeevan Pillay",
            identityProvider: "x",
            identityType: "profile_url",
            identityValue: "https://x.com/JeevanP",
            metadata: { confidence: 0.91 },
          },
        ],
        sourceSignalId: "sig_source",
      })
    ).resolves.toEqual([existing]);

    expect(spies.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        clerkOrgId: "org_test",
        displayName: "Jeevan Pillay",
        identityProvider: "x",
        identityType: "handle",
        identityValue: "https://x.com/JeevanP",
        normalizedIdentityValue: "jeevanp",
        firstSeenSignalId: "sig_source",
        lastSeenSignalId: "sig_source",
        seenCount: 1,
      })
    );
    expect(spies.duplicateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        lastSeenSignalId: "sig_source",
      })
    );
  });

  it("skips candidates that cannot be normalized", async () => {
    const { db, spies } = makePeopleDb([]);

    await expect(
      upsertPeopleFromCandidates(db, {
        clerkOrgId: "org_test",
        candidates: [
          {
            identityProvider: "website",
            identityType: "handle",
            identityValue: "not durable",
            metadata: { confidence: 0.1 },
          },
        ],
        sourceSignalId: "sig_source",
      })
    ).resolves.toEqual([]);

    expect(spies.insertValues).not.toHaveBeenCalled();
  });
});
