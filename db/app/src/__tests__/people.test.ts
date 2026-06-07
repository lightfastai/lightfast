import type {
  Database,
  EntityPerson,
  EntitySourceIdentity,
  Person,
} from "@db/app";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { describe, expect, it, vi } from "vitest";

import {
  orgEntityPeople,
  orgEntitySourceIdentities,
  orgPeople,
  PERSON_DISPLAY_NAME_LENGTH,
  PERSON_NORMALIZED_IDENTITY_VALUE_LENGTH,
} from "../schema";
import {
  escapeLikePattern,
  getPersonByPublicId,
  listPeople,
  projectEntityGraphPeopleToOrgPeople,
  upsertPeopleFromCandidates,
} from "../utils/people";
import {
  createPersonIdentityKey,
  normalizePersonIdentityCandidate,
  shouldIncrementSeenCount,
} from "../utils/people-identities";

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

  it("rejects LinkedIn profile URLs without a slug", () => {
    expect(
      normalizePersonIdentityCandidate({
        identityProvider: "linkedin",
        identityType: "profile_url",
        identityValue: "https://www.linkedin.com/in//",
      })
    ).toBeUndefined();
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
        existingLastSeenSignalId: "signal_a",
        sourceSignalId: "signal_b",
      })
    ).toBe(true);
    expect(
      shouldIncrementSeenCount({
        existingLastSeenSignalId: "signal_a",
        sourceSignalId: "signal_a",
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
    firstSeenSignalId: "signal_first",
    lastSeenSignalId: "signal_first",
    seenCount: 1,
    metadata: {},
    personSource: "signal",
    memberStatus: null,
    clerkUserId: null,
    memberRole: null,
    memberSyncedAt: null,
    createdAt: new Date("2026-05-22T00:00:00.000Z"),
    updatedAt: new Date("2026-05-22T00:00:00.000Z"),
    ...overrides,
  };
}

function makeSourceIdentity(
  overrides: Partial<EntitySourceIdentity> = {}
): EntitySourceIdentity {
  return {
    id: 1,
    publicId: "sid_123e4567-e89b-12d3-a456-426614174000",
    clerkOrgId: "org_test",
    provider: "x",
    identityType: "handle",
    identityValue: "ava_ai",
    normalizedValue: "ava_ai",
    identityKey: "x:handle:ava_ai",
    status: "likely",
    metadata: {},
    createdAt: new Date("2026-06-06T00:00:00.000Z"),
    updatedAt: new Date("2026-06-06T00:00:00.000Z"),
    ...overrides,
  };
}

function makeEntityPerson(overrides: Partial<EntityPerson> = {}): EntityPerson {
  return {
    id: 21,
    publicId: "person_123e4567-e89b-12d3-a456-426614174000",
    canonicalKey: "person:github:handle:avachen|x:handle:ava_ai",
    clerkOrgId: "org_test",
    displayName: "Ava Chen",
    status: "likely",
    confidence: "0.9200",
    primarySourceIdentityId: 1,
    confirmedByType: null,
    confirmedById: null,
    confirmationPolicy: null,
    confirmedAt: null,
    metadata: {},
    createdAt: new Date("2026-06-06T00:00:00.000Z"),
    updatedAt: new Date("2026-06-06T00:00:00.000Z"),
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
        sourceSignalId: "signal_source",
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
        firstSeenSignalId: "signal_source",
        lastSeenSignalId: "signal_source",
        seenCount: 1,
        personSource: "signal",
      })
    );
    expect(spies.duplicateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        lastSeenSignalId: "signal_source",
        personSource: expect.anything(),
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
        sourceSignalId: "signal_source",
      })
    ).resolves.toEqual([]);

    expect(spies.insertValues).not.toHaveBeenCalled();
  });

  it("deduplicates candidates that normalize to the same identity", async () => {
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
          },
          {
            displayName: "Jeevan Pillay",
            identityProvider: "x",
            identityType: "handle",
            identityValue: "@jeevanp",
          },
        ],
        sourceSignalId: "signal_source",
      })
    ).resolves.toEqual([existing]);

    expect(spies.insertValues).toHaveBeenCalledTimes(1);
  });

  it("bounds AI-provided display names to the table column length", async () => {
    const existing = makePerson();
    const { db, spies } = makePeopleDb([[existing]]);
    const longDisplayName = "J".repeat(PERSON_DISPLAY_NAME_LENGTH + 20);

    await upsertPeopleFromCandidates(db, {
      clerkOrgId: "org_test",
      candidates: [
        {
          displayName: longDisplayName,
          identityProvider: "x",
          identityType: "handle",
          identityValue: "@jeevanp",
        },
      ],
      sourceSignalId: "signal_source",
    });

    expect(spies.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: "J".repeat(PERSON_DISPLAY_NAME_LENGTH),
      })
    );
  });

  it("skips candidates whose normalized identity exceeds the table column length", async () => {
    const { db, spies } = makePeopleDb([]);

    await expect(
      upsertPeopleFromCandidates(db, {
        clerkOrgId: "org_test",
        candidates: [
          {
            identityProvider: "website",
            identityType: "profile_url",
            identityValue: `https://example.com/${"a".repeat(PERSON_NORMALIZED_IDENTITY_VALUE_LENGTH + 1)}`,
          },
        ],
        sourceSignalId: "signal_source",
      })
    ).resolves.toEqual([]);

    expect(spies.insertValues).not.toHaveBeenCalled();
  });
});

function makeProjectionDb(input: {
  graphPeople: EntityPerson[];
  projectedPeople: Person[];
  sourceIdentities: EntitySourceIdentity[];
}) {
  const peopleQueue = [...input.projectedPeople];
  const spies = {
    duplicateSet: vi.fn(),
    graphPeopleLimit: vi.fn(() => Promise.resolve(input.graphPeople)),
    graphPeopleWhere: vi.fn(),
    insertValues: vi.fn(),
    peopleLimit: vi.fn(() =>
      Promise.resolve([peopleQueue.shift()].filter(Boolean))
    ),
    sourceIdentityLimit: vi.fn(() => Promise.resolve(input.sourceIdentities)),
  };
  const db = {
    insert: () => ({
      values: (values: unknown) => {
        spies.insertValues(values);
        return {
          onDuplicateKeyUpdate: ({ set }: { set: Record<string, unknown> }) => {
            spies.duplicateSet(set);
            return Promise.resolve({ rowsAffected: 1 });
          },
        };
      },
    }),
    select: () => ({
      from: (table: unknown) => ({
        where: (condition: unknown) => {
          if (table === orgEntitySourceIdentities) {
            return { limit: spies.sourceIdentityLimit };
          }
          if (table === orgEntityPeople) {
            spies.graphPeopleWhere(condition);
            return { limit: spies.graphPeopleLimit };
          }
          if (table === orgPeople) {
            return { limit: spies.peopleLimit };
          }
          throw new Error("Unexpected projection table.");
        },
      }),
    }),
  };
  return { db: db as unknown as Database, spies };
}

describe("projectEntityGraphPeopleToOrgPeople", () => {
  it("projects one People row per graph person with source identity aliases", async () => {
    const graphPerson = makeEntityPerson();
    const xSource = makeSourceIdentity();
    const githubSource = makeSourceIdentity({
      id: 2,
      publicId: "sid_223e4567-e89b-12d3-a456-426614174000",
      provider: "github",
      identityKey: "github:handle:avachen",
      identityValue: "avachen",
      normalizedValue: "avachen",
    });
    const xRow = makePerson({
      displayName: "Ava Chen",
      identityProvider: "x",
      identityType: "handle",
      identityValue: "ava_ai",
      normalizedIdentityValue: "ava_ai",
      identityKey: createPersonIdentityKey({
        identityProvider: "x",
        identityType: "handle",
        normalizedIdentityValue: "ava_ai",
      }),
      metadata: {
        entityGraph: expect.any(Object),
      },
      personSource: "entity_graph",
    });
    const { db, spies } = makeProjectionDb({
      graphPeople: [graphPerson],
      projectedPeople: [xRow],
      sourceIdentities: [xSource, githubSource],
    });

    await expect(
      projectEntityGraphPeopleToOrgPeople(db, {
        clerkOrgId: "org_test",
        resolverVersion: "signal-entity-enrichment-v1",
        source: {
          kind: "signal_entity_enrichment",
          reason: "signal_indexed",
          signalId: "signal_123",
        },
        sourceIdentityKeys: ["x:handle:ava_ai", "github:handle:avachen"],
      })
    ).resolves.toEqual([xRow]);

    expect(spies.insertValues).toHaveBeenCalledTimes(1);
    expect(spies.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        clerkOrgId: "org_test",
        displayName: "Ava Chen",
        identityProvider: "x",
        identityType: "handle",
        identityValue: "ava_ai",
        normalizedIdentityValue: "ava_ai",
        personSource: "entity_graph",
        metadata: {
          entityGraph: {
            personCanonicalKey: graphPerson.canonicalKey,
            personConfidence: graphPerson.confidence,
            personPublicId: graphPerson.publicId,
            personStatus: graphPerson.status,
            resolverVersion: "signal-entity-enrichment-v1",
            source: {
              kind: "signal_entity_enrichment",
              reason: "signal_indexed",
              signalId: "signal_123",
            },
            sourceIdentityKey: xSource.identityKey,
            sourceIdentityKeys: [xSource.identityKey, githubSource.identityKey],
            sourceIdentityPublicId: xSource.publicId,
            sourceIdentityPublicIds: [xSource.publicId, githubSource.publicId],
            sourceIdentities: [
              {
                identityKey: xSource.identityKey,
                identityType: xSource.identityType,
                identityValue: xSource.identityValue,
                normalizedValue: xSource.normalizedValue,
                provider: xSource.provider,
                publicId: xSource.publicId,
              },
              {
                identityKey: githubSource.identityKey,
                identityType: githubSource.identityType,
                identityValue: githubSource.identityValue,
                normalizedValue: githubSource.normalizedValue,
                provider: githubSource.provider,
                publicId: githubSource.publicId,
              },
            ],
          },
        },
      })
    );

    const duplicateSet = spies.duplicateSet.mock.calls[0]?.[0];
    expect(duplicateSet).toEqual(
      expect.objectContaining({
        displayName: expect.anything(),
        metadata: expect.any(Object),
        personSource: expect.anything(),
      })
    );
    const query = new MySqlDialect().sqlToQuery(
      duplicateSet?.personSource as never
    );
    expect(query.sql).toContain("person_source");
    expect(query.sql).toContain("entity_graph");
    expect(query.sql).toContain("mixed");
  });

  it("does not project graph people from source identity prefix matches", async () => {
    const requestedSource = makeSourceIdentity({
      id: 10,
      identityKey: "x:handle:ava",
      identityValue: "ava",
      normalizedValue: "ava",
      publicId: "sid_333e4567-e89b-12d3-a456-426614174000",
    });
    const wrongGraphPerson = makeEntityPerson({
      canonicalKey: "person:x:handle:ava_ai",
      primarySourceIdentityId: 99,
    });
    const { db, spies } = makeProjectionDb({
      graphPeople: [wrongGraphPerson],
      projectedPeople: [makePerson()],
      sourceIdentities: [requestedSource],
    });

    await expect(
      projectEntityGraphPeopleToOrgPeople(db, {
        clerkOrgId: "org_test",
        resolverVersion: "signal-entity-enrichment-v1",
        sourceIdentityKeys: [requestedSource.identityKey],
      })
    ).resolves.toEqual([]);

    expect(spies.insertValues).not.toHaveBeenCalled();
    const condition = spies.graphPeopleWhere.mock.calls[0]?.[0];
    const query = new MySqlDialect().sqlToQuery(condition);
    expect(query.params).toEqual(
      expect.arrayContaining([
        "person:x:handle:ava",
        "person:x:handle:ava|%",
        "%|x:handle:ava|%",
        "%|x:handle:ava",
      ])
    );
    expect(query.params).not.toContain("%x:handle:ava%");
  });
});

function makePeopleListDb(rows: Person[]) {
  const spies = {
    limit: vi.fn((value: number) => Promise.resolve(rows.slice(0, value))),
    orderBy: vi.fn(),
    where: vi.fn(),
  };
  const db = {
    select: () => ({
      from: () => ({
        where: (condition: unknown) => {
          spies.where(condition);
          return {
            orderBy: (...order: unknown[]) => {
              spies.orderBy(...order);
              return {
                limit: spies.limit,
              };
            },
          };
        },
      }),
    }),
  };
  return { db: db as unknown as Database, spies };
}

describe("listPeople", () => {
  it("escapes MySQL LIKE wildcard characters in search input", () => {
    expect(escapeLikePattern(String.raw`50%_done\soon`)).toBe(
      String.raw`50\%\_done\\soon`
    );
  });

  it("returns people rows with cursor pagination", async () => {
    const rows = [
      makePerson({
        id: 3,
        publicId: "person_333e4567-e89b-12d3-a456-426614174000",
      }),
      makePerson({
        id: 2,
        publicId: "person_222e4567-e89b-12d3-a456-426614174000",
      }),
      makePerson({
        id: 1,
        publicId: "person_111e4567-e89b-12d3-a456-426614174000",
      }),
    ];
    const { db, spies } = makePeopleListDb(rows);

    await expect(
      listPeople(db, { clerkOrgId: "org_test", limit: 2 })
    ).resolves.toEqual({
      items: rows.slice(0, 2),
      nextCursor: { createdAt: rows[1]!.createdAt, id: rows[1]!.id },
    });
    expect(spies.limit).toHaveBeenCalledWith(3);
    expect(spies.where).toHaveBeenCalledOnce();
    expect(spies.orderBy).toHaveBeenCalled();
  });

  it("bounds people list limits to 100 rows", async () => {
    const { db, spies } = makePeopleListDb([]);

    await listPeople(db, { clerkOrgId: "org_test", limit: 500 });

    expect(spies.limit).toHaveBeenCalledWith(101);
  });

  it("searches for literal wildcard characters", async () => {
    const { db, spies } = makePeopleListDb([]);

    await listPeople(db, {
      clerkOrgId: "org_test",
      search: String.raw`50%_done\soon`,
    });

    const condition = spies.where.mock.calls[0]?.[0];
    const query = new MySqlDialect().sqlToQuery(condition);

    expect(query.sql).toContain("like ? escape '\\\\'");
    expect(query.params).toContain(String.raw`%50\%\_done\\soon%`);
  });
});

function makeGetDb(rows: Person[]) {
  const spies = {
    where: vi.fn(),
    limit: vi.fn(() => Promise.resolve(rows)),
  };
  const db = {
    select: () => ({
      from: () => ({
        where: (condition: unknown) => {
          spies.where(condition);
          return { limit: spies.limit };
        },
      }),
    }),
  };
  return { db: db as unknown as Database, spies };
}

describe("getPersonByPublicId", () => {
  it("returns the org-scoped person when present", async () => {
    const person = makePerson();
    const { db } = makeGetDb([person]);

    await expect(
      getPersonByPublicId(db, {
        clerkOrgId: "org_test",
        publicId: person.publicId,
      })
    ).resolves.toEqual(person);
  });

  it("returns undefined when no row matches", async () => {
    const { db } = makeGetDb([]);

    await expect(
      getPersonByPublicId(db, {
        clerkOrgId: "org_test",
        publicId: "person_missing",
      })
    ).resolves.toBeUndefined();
  });
});

describe("listPeople filters", () => {
  it("passes provider and type filters through without throwing and returns rows", async () => {
    const person = makePerson();
    const { db, spies } = makePeopleListDb([person]);

    await expect(
      listPeople(db, {
        clerkOrgId: "org_test",
        providers: ["x", "email"],
        types: ["handle"],
        limit: 10,
      })
    ).resolves.toEqual({ items: [person], nextCursor: null });

    expect(spies.where).toHaveBeenCalledOnce();
    expect(spies.limit).toHaveBeenCalledWith(11);
  });

  it("ignores empty provider/type arrays", async () => {
    const { db, spies } = makePeopleListDb([]);

    await listPeople(db, {
      clerkOrgId: "org_test",
      providers: [],
      types: [],
      limit: 10,
    });

    expect(spies.where).toHaveBeenCalledOnce();
  });

  it("passes source and member status filters through without throwing", async () => {
    const person = makePerson({
      personSource: "team_member",
      memberStatus: "active",
    });
    const { db, spies } = makePeopleListDb([person]);

    await expect(
      listPeople(db, {
        clerkOrgId: "org_test",
        limit: 10,
        memberStatuses: ["active"],
        sources: ["team_member", "mixed"],
      })
    ).resolves.toEqual({ items: [person], nextCursor: null });

    const condition = spies.where.mock.calls[0]?.[0];
    const query = new MySqlDialect().sqlToQuery(condition);

    expect(query.sql).toContain("person_source");
    expect(query.sql).toContain("member_status");
    expect(spies.where).toHaveBeenCalledOnce();
    expect(spies.limit).toHaveBeenCalledWith(11);
  });

  it("ignores empty source and member status arrays", async () => {
    const { db, spies } = makePeopleListDb([]);

    await listPeople(db, {
      clerkOrgId: "org_test",
      limit: 10,
      memberStatuses: [],
      sources: [],
    });

    const condition = spies.where.mock.calls[0]?.[0];
    const query = new MySqlDialect().sqlToQuery(condition);

    expect(query.sql).not.toContain("person_source");
    expect(query.sql).not.toContain("member_status");
    expect(spies.where).toHaveBeenCalledOnce();
  });
});
