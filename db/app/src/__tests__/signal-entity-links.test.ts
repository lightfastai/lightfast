import type { Database, Person } from "@db/app";
import type { SignalEntityLinkCandidate } from "@repo/ai/signal-entity-linker";
import { describe, expect, it, vi } from "vitest";

import {
  orgPeople as peopleTable,
  type SignalEntityLink,
  orgSignalEntityLinks as signalEntityLinksTable,
} from "../schema";
import { createPersonIdentityKey } from "../utils/people-identities";
import {
  buildSignalEntityLinkResolutionHints,
  listSignalEntityLinksForSignal,
  reconcileSignalEntityLinksForPeople,
  replaceSignalEntityLinks,
} from "../utils/signal-entity-links";

const signalId = "signal_123e4567-e89b-12d3-a456-426614174000";

function candidate(
  overrides: Partial<SignalEntityLinkCandidate> = {}
): SignalEntityLinkCandidate {
  return {
    targetType: "person",
    localEntityKey: "person_1",
    label: "Jordi",
    mentionKind: "name",
    anchorText: "Jordi",
    anchorOccurrence: 1,
    extractionMethod: "ai",
    rationale: "Jordi is explicitly named.",
    confidence: 0.73,
    ...overrides,
  };
}

function makePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: 1,
    publicId: "person_123e4567-e89b-12d3-a456-426614174000",
    clerkOrgId: "org_test",
    displayName: "Jordi",
    identityProvider: "email",
    identityType: "email",
    identityValue: "jordi@doccy.com.au",
    normalizedIdentityValue: "jordi@doccy.com.au",
    identityKey: createPersonIdentityKey({
      identityProvider: "email",
      identityType: "email",
      normalizedIdentityValue: "jordi@doccy.com.au",
    }),
    firstSeenSignalId: signalId,
    lastSeenSignalId: signalId,
    seenCount: 1,
    metadata: {},
    personSource: "signal",
    memberStatus: null,
    clerkUserId: null,
    memberRole: null,
    memberSyncedAt: null,
    createdAt: new Date("2026-06-06T00:00:00.000Z"),
    updatedAt: new Date("2026-06-06T00:00:00.000Z"),
    ...overrides,
  };
}

function makeLink(overrides: Partial<SignalEntityLink> = {}): SignalEntityLink {
  return {
    id: 1,
    anchorOccurrence: 1,
    anchorText: "Jordi",
    clerkOrgId: "org_test",
    confidenceBasisPoints: 7300,
    createdAt: new Date("2026-06-06T00:00:00.000Z"),
    extractionMethod: "ai",
    label: "Jordi",
    localEntityKey: "person_1",
    mentionKind: "name",
    normalizedMentionValue: "jordi",
    rationale: "Jordi is explicitly named.",
    resolvedAt: null,
    resolvedPersonId: null,
    signalId,
    targetType: "person",
    updatedAt: new Date("2026-06-06T00:00:00.000Z"),
    ...overrides,
  };
}

describe("signal entity link resolution hints", () => {
  it("normalizes name mentions for display-name reconciliation", () => {
    expect(
      buildSignalEntityLinkResolutionHints(
        candidate({ anchorText: "  Jordi   Archer  " })
      )
    ).toMatchObject({
      displayName: "jordi archer",
      identityKeys: [],
      normalizedMentionValue: "jordi archer",
    });
  });

  it("creates durable identity keys for email mentions", () => {
    const hints = buildSignalEntityLinkResolutionHints(
      candidate({
        label: "Jordi@Doccy.com.au",
        anchorText: "Jordi@Doccy.com.au",
        mentionKind: "email",
      })
    );

    expect(hints.normalizedMentionValue).toBe("jordi@doccy.com.au");
    expect(hints.identityKeys).toEqual([
      createPersonIdentityKey({
        identityProvider: "email",
        identityType: "email",
        normalizedIdentityValue: "jordi@doccy.com.au",
      }),
    ]);
  });

  it("treats bare handles as provider-ambiguous durable handles", () => {
    const hints = buildSignalEntityLinkResolutionHints(
      candidate({
        anchorText: "@archer",
        label: "@archer",
        mentionKind: "handle",
      })
    );

    expect(hints.normalizedMentionValue).toBe("archer");
    expect(hints.identityKeys).toEqual([
      createPersonIdentityKey({
        identityProvider: "x",
        identityType: "handle",
        normalizedIdentityValue: "archer",
      }),
      createPersonIdentityKey({
        identityProvider: "github",
        identityType: "handle",
        normalizedIdentityValue: "archer",
      }),
    ]);
  });

  it("normalizes recognized profile URLs through the People identity normalizer", () => {
    const hints = buildSignalEntityLinkResolutionHints(
      candidate({
        anchorText: "https://x.com/JordiDev?ref=signal",
        label: "https://x.com/JordiDev?ref=signal",
        mentionKind: "profile_url",
      })
    );

    expect(hints.normalizedMentionValue).toBe("jordidev");
    expect(hints.identityKeys).toEqual([
      createPersonIdentityKey({
        identityProvider: "x",
        identityType: "handle",
        normalizedIdentityValue: "jordidev",
      }),
    ]);
  });
});

function makeReplaceDb(selectResults: Person[][]) {
  const selectQueue = [...selectResults];
  const spies = {
    deleteWhere: vi.fn(),
    insertValues: vi.fn(),
    transaction: vi.fn(),
  };
  const query = {
    limit: vi.fn(() => Promise.resolve(selectQueue.shift() ?? [])),
    where: vi.fn(() => ({ limit: query.limit })),
  };
  const tx = {
    delete: vi.fn(() => ({
      where: spies.deleteWhere,
    })),
    insert: vi.fn(() => ({
      values: spies.insertValues,
    })),
  };
  const db = {
    select: () => ({
      from: () => ({
        where: query.where,
      }),
    }),
    transaction: async (fn: (transaction: typeof tx) => Promise<void>) => {
      spies.transaction();
      await fn(tx);
    },
  };
  return { db: db as unknown as Database, spies };
}

function makeReconcileDb(input: {
  peopleResults: Person[][];
  unresolvedBatches: SignalEntityLink[][];
}) {
  const peopleQueue = [...input.peopleResults];
  const unresolvedQueue = [...input.unresolvedBatches];
  const spies = {
    peopleLimit: vi.fn(() => Promise.resolve(peopleQueue.shift() ?? [])),
    signalLimit: vi.fn(() => Promise.resolve(unresolvedQueue.shift() ?? [])),
    signalOrderBy: vi.fn(() => ({ limit: spies.signalLimit })),
    updateSet: vi.fn(() => ({ where: spies.updateWhere })),
    updateWhere: vi.fn(() => Promise.resolve({ rowsAffected: 1 })),
  };
  const db = {
    select: () => ({
      from: (table: unknown) => {
        if (table === signalEntityLinksTable) {
          return {
            where: () => ({
              orderBy: spies.signalOrderBy,
            }),
          };
        }

        if (table === peopleTable) {
          return {
            where: () => ({
              limit: spies.peopleLimit,
            }),
          };
        }

        throw new Error("Unexpected table in signal entity link test.");
      },
    }),
    update: () => ({
      set: spies.updateSet,
    }),
  };

  return { db: db as unknown as Database, spies };
}

interface SignalEntityLinkListRow {
  anchorOccurrence: number;
  anchorText: string;
  confidenceBasisPoints: number;
  extractionMethod: SignalEntityLink["extractionMethod"];
  label: string;
  localEntityKey: string;
  mentionKind: SignalEntityLink["mentionKind"];
  personDisplayName: string | null;
  personIdentityProvider: Person["identityProvider"] | null;
  personIdentityType: Person["identityType"] | null;
  personIdentityValue: string | null;
  personPublicId: string | null;
  rationale: string;
  targetType: SignalEntityLink["targetType"];
}

function makeListDb(rows: SignalEntityLinkListRow[]) {
  const spies = {
    leftJoin: vi.fn(() => ({ where: spies.where })),
    orderBy: vi.fn(() => Promise.resolve(rows)),
    where: vi.fn(() => ({ orderBy: spies.orderBy })),
  };
  const db = {
    select: () => ({
      from: () => ({
        leftJoin: spies.leftJoin,
      }),
    }),
  };

  return { db: db as unknown as Database, spies };
}

describe("replaceSignalEntityLinks", () => {
  it("replaces links idempotently and resolves an unambiguous name", async () => {
    const person = makePerson();
    const { db, spies } = makeReplaceDb([[person]]);

    await expect(
      replaceSignalEntityLinks(db, {
        candidates: [candidate()],
        clerkOrgId: "org_test",
        signalId,
      })
    ).resolves.toEqual({ links: 1, resolved: 1 });

    expect(spies.transaction).toHaveBeenCalledTimes(1);
    expect(spies.deleteWhere).toHaveBeenCalledTimes(1);
    expect(spies.insertValues).toHaveBeenCalledWith([
      expect.objectContaining({
        anchorText: "Jordi",
        clerkOrgId: "org_test",
        confidenceBasisPoints: 7300,
        localEntityKey: "person_1",
        normalizedMentionValue: "jordi",
        resolvedPersonId: person.publicId,
        signalId,
      }),
    ]);
  });

  it("leaves ambiguous names unresolved", async () => {
    const { db, spies } = makeReplaceDb([
      [
        makePerson({ id: 1, publicId: "person_one" }),
        makePerson({ id: 2, publicId: "person_two" }),
      ],
    ]);

    await expect(
      replaceSignalEntityLinks(db, {
        candidates: [candidate()],
        clerkOrgId: "org_test",
        signalId,
      })
    ).resolves.toEqual({ links: 1, resolved: 0 });

    expect(spies.insertValues).toHaveBeenCalledWith([
      expect.objectContaining({
        normalizedMentionValue: "jordi",
        resolvedAt: null,
        resolvedPersonId: null,
      }),
    ]);
  });
});

describe("reconcileSignalEntityLinksForPeople", () => {
  it("walks multiple unresolved-link batches with an id cursor", async () => {
    const unresolvedFirstBatch = Array.from({ length: 500 }, (_, index) =>
      makeLink({
        id: index + 1,
        anchorText: `Ghost ${index + 1}`,
        label: `Ghost ${index + 1}`,
        localEntityKey: `person_${index + 1}`,
        normalizedMentionValue: "jordi@doccy.com.au",
      })
    );
    const matchingLink = makeLink({
      id: 501,
      anchorText: "jordi@doccy.com.au",
      label: "jordi@doccy.com.au",
      localEntityKey: "person_501",
      mentionKind: "email",
      normalizedMentionValue: "jordi@doccy.com.au",
    });
    const person = makePerson();
    const { db, spies } = makeReconcileDb({
      peopleResults: [...Array.from({ length: 500 }, () => []), [person]],
      unresolvedBatches: [unresolvedFirstBatch, [matchingLink]],
    });

    await expect(
      reconcileSignalEntityLinksForPeople(db, {
        clerkOrgId: "org_test",
        people: [
          {
            displayName: "Jordi",
            normalizedIdentityValue: "jordi@doccy.com.au",
          },
        ],
      })
    ).resolves.toEqual({ resolved: 1 });

    expect(spies.signalLimit).toHaveBeenCalledTimes(2);
    expect(spies.signalOrderBy).toHaveBeenCalledTimes(2);
    expect(spies.updateSet).toHaveBeenCalledWith({
      resolvedAt: expect.any(Date),
      resolvedPersonId: person.publicId,
    });
  });
});

describe("listSignalEntityLinksForSignal", () => {
  it("returns resolved person details and unresolved links", async () => {
    const { db, spies } = makeListDb([
      {
        anchorOccurrence: 1,
        anchorText: "Jordi",
        confidenceBasisPoints: 7300,
        extractionMethod: "ai",
        label: "Jordi",
        localEntityKey: "person_1",
        mentionKind: "name",
        personDisplayName: "Jordi",
        personIdentityProvider: "email",
        personIdentityType: "email",
        personIdentityValue: "jordi@doccy.com.au",
        personPublicId: "person_123e4567-e89b-12d3-a456-426614174000",
        rationale: "Jordi is explicitly named.",
        targetType: "person",
      },
      {
        anchorOccurrence: 1,
        anchorText: "Archer",
        confidenceBasisPoints: 6600,
        extractionMethod: "ai",
        label: "Archer",
        localEntityKey: "person_2",
        mentionKind: "name",
        personDisplayName: null,
        personIdentityProvider: null,
        personIdentityType: null,
        personIdentityValue: null,
        personPublicId: null,
        rationale: "Archer is explicitly named.",
        targetType: "person",
      },
    ]);

    await expect(
      listSignalEntityLinksForSignal(db, {
        clerkOrgId: "org_test",
        signalId,
      })
    ).resolves.toEqual([
      {
        anchorOccurrence: 1,
        anchorText: "Jordi",
        confidence: 0.73,
        extractionMethod: "ai",
        label: "Jordi",
        localEntityKey: "person_1",
        mentionKind: "name",
        rationale: "Jordi is explicitly named.",
        resolvedPerson: {
          displayName: "Jordi",
          id: "person_123e4567-e89b-12d3-a456-426614174000",
          identityProvider: "email",
          identityType: "email",
          identityValue: "jordi@doccy.com.au",
        },
        targetType: "person",
      },
      {
        anchorOccurrence: 1,
        anchorText: "Archer",
        confidence: 0.66,
        extractionMethod: "ai",
        label: "Archer",
        localEntityKey: "person_2",
        mentionKind: "name",
        rationale: "Archer is explicitly named.",
        resolvedPerson: null,
        targetType: "person",
      },
    ]);

    expect(spies.leftJoin).toHaveBeenCalledTimes(1);
    expect(spies.orderBy).toHaveBeenCalledTimes(1);
  });
});
