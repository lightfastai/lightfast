import type { Database, Person } from "@db/app";
import { describe, expect, it, vi } from "vitest";

import { createPersonIdentityKey } from "../utils/people-identities";
import {
  markFormerTeamMembersMissingFromSync,
  syncOrgTeamMemberPeople,
} from "../utils/people-team-members";

function makePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: 1,
    publicId: "person_123e4567-e89b-12d3-a456-426614174000",
    clerkOrgId: "org_test",
    displayName: "Ada Lovelace",
    identityProvider: "email",
    identityType: "email",
    identityValue: "ada@example.com",
    normalizedIdentityValue: "ada@example.com",
    identityKey: createPersonIdentityKey({
      identityProvider: "email",
      identityType: "email",
      normalizedIdentityValue: "ada@example.com",
    }),
    firstSeenSignalId: null,
    lastSeenSignalId: null,
    seenCount: 1,
    metadata: {},
    personSource: "team_member",
    memberStatus: "active",
    clerkUserId: "user_ada",
    memberRole: "org:member",
    memberSyncedAt: new Date("2026-06-06T00:00:00.000Z"),
    createdAt: new Date("2026-06-06T00:00:00.000Z"),
    updatedAt: new Date("2026-06-06T00:00:00.000Z"),
    ...overrides,
  };
}

function makeSyncDb(selectRows: Person[][], updateRowsAffected = 1) {
  const selectQueue = [...selectRows];
  const spies = {
    duplicateSet: vi.fn(),
    insertValues: vi.fn(),
    selectLimit: vi.fn(() => Promise.resolve(selectQueue.shift() ?? [])),
    updateSet: vi.fn(),
    updateWhere: vi.fn(async () => ({ rowsAffected: updateRowsAffected })),
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
          limit: spies.selectLimit,
        }),
      }),
    }),
    update: () => ({
      set: (set: unknown) => {
        spies.updateSet(set);
        return { where: spies.updateWhere };
      },
    }),
  };
  return { db: db as unknown as Database, spies };
}

describe("syncOrgTeamMemberPeople", () => {
  it("upserts accepted members as active email-backed people", async () => {
    const syncedAt = new Date("2026-06-06T01:00:00.000Z");
    const row = makePerson({ memberSyncedAt: syncedAt });
    const { db, spies } = makeSyncDb([[row]]);

    await expect(
      syncOrgTeamMemberPeople(db, {
        clerkOrgId: "org_test",
        members: [
          {
            clerkUserId: "user_ada",
            displayName: "Ada Lovelace",
            emailAddress: "Ada@Example.com",
            role: "org:member",
          },
        ],
        syncedAt,
      })
    ).resolves.toMatchObject({
      activeIdentityKeys: [row.identityKey],
      membersSeen: 1,
      membersSkippedNoEmail: 0,
      membersUpserted: 1,
    });

    expect(spies.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        clerkOrgId: "org_test",
        displayName: "Ada Lovelace",
        identityProvider: "email",
        identityType: "email",
        identityValue: "Ada@Example.com",
        normalizedIdentityValue: "ada@example.com",
        memberStatus: "active",
        personSource: "team_member",
        clerkUserId: "user_ada",
        memberRole: "org:member",
        memberSyncedAt: syncedAt,
      })
    );
  });

  it("promotes existing signal email rows without touching signal provenance", async () => {
    const syncedAt = new Date("2026-06-06T01:00:00.000Z");
    const signalRow = makePerson({
      firstSeenSignalId: "signal_first",
      lastSeenSignalId: "signal_latest",
      personSource: "mixed",
      seenCount: 7,
    });
    const { db, spies } = makeSyncDb([[signalRow]]);

    await expect(
      syncOrgTeamMemberPeople(db, {
        clerkOrgId: "org_test",
        members: [
          {
            clerkUserId: "user_ada",
            displayName: "Ada Lovelace",
            emailAddress: "ada@example.com",
            role: "org:admin",
          },
        ],
        syncedAt,
      })
    ).resolves.toMatchObject({ people: [signalRow] });

    expect(spies.duplicateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        clerkUserId: "user_ada",
        memberRole: "org:admin",
        memberStatus: "active",
        memberSyncedAt: syncedAt,
        personSource: expect.anything(),
      })
    );
    expect(spies.duplicateSet).toHaveBeenCalledWith(
      expect.not.objectContaining({
        firstSeenSignalId: expect.anything(),
        lastSeenSignalId: expect.anything(),
        seenCount: expect.anything(),
      })
    );
  });

  it("counts duplicate accepted emails as seen but upserts them once", async () => {
    const row = makePerson();
    const { db, spies } = makeSyncDb([[row]]);

    await expect(
      syncOrgTeamMemberPeople(db, {
        clerkOrgId: "org_test",
        members: [
          {
            clerkUserId: "user_ada",
            displayName: "Ada Lovelace",
            emailAddress: "Ada@Example.com",
            role: "org:member",
          },
          {
            clerkUserId: "user_ada_duplicate",
            displayName: "Ada Duplicate",
            emailAddress: " ada@example.com ",
            role: "org:admin",
          },
        ],
        syncedAt: new Date("2026-06-06T01:00:00.000Z"),
      })
    ).resolves.toMatchObject({
      activeIdentityKeys: [row.identityKey],
      membersSeen: 2,
      membersSkippedNoEmail: 0,
      membersUpserted: 1,
    });

    expect(spies.insertValues).toHaveBeenCalledOnce();
  });

  it("fetches synced people once after upserting unique members", async () => {
    const ada = makePerson();
    const grace = makePerson({
      id: 2,
      publicId: "person_123e4567-e89b-12d3-a456-426614174001",
      displayName: "Grace Hopper",
      identityValue: "grace@example.com",
      normalizedIdentityValue: "grace@example.com",
      identityKey: createPersonIdentityKey({
        identityProvider: "email",
        identityType: "email",
        normalizedIdentityValue: "grace@example.com",
      }),
    });
    const { db, spies } = makeSyncDb([[ada, grace]]);

    await expect(
      syncOrgTeamMemberPeople(db, {
        clerkOrgId: "org_test",
        members: [
          {
            clerkUserId: "user_ada",
            displayName: "Ada Lovelace",
            emailAddress: "ada@example.com",
            role: "org:member",
          },
          {
            clerkUserId: "user_grace",
            displayName: "Grace Hopper",
            emailAddress: "grace@example.com",
            role: "org:admin",
          },
        ],
        syncedAt: new Date("2026-06-06T01:00:00.000Z"),
      })
    ).resolves.toMatchObject({
      membersSeen: 2,
      membersSkippedNoEmail: 0,
      membersUpserted: 2,
      people: [ada, grace],
    });

    expect(spies.insertValues).toHaveBeenCalledTimes(2);
    expect(spies.selectLimit).toHaveBeenCalledOnce();
  });

  it("skips members without usable emails", async () => {
    const { db, spies } = makeSyncDb([]);

    await expect(
      syncOrgTeamMemberPeople(db, {
        clerkOrgId: "org_test",
        members: [
          {
            clerkUserId: "user_missing",
            displayName: "Missing Email",
            emailAddress: "",
            role: "org:member",
          },
        ],
        syncedAt: new Date("2026-06-06T01:00:00.000Z"),
      })
    ).resolves.toMatchObject({
      activeIdentityKeys: [],
      membersSeen: 1,
      membersSkippedNoEmail: 1,
      membersUpserted: 0,
    });

    expect(spies.insertValues).not.toHaveBeenCalled();
  });
});

describe("markFormerTeamMembersMissingFromSync", () => {
  it("marks previously active member rows missing from the active identity set as former", async () => {
    const syncedAt = new Date("2026-06-06T01:00:00.000Z");
    const { db, spies } = makeSyncDb([], 2);

    await expect(
      markFormerTeamMembersMissingFromSync(db, {
        activeIdentityKeys: ["active_key"],
        clerkOrgId: "org_test",
        syncedAt,
      })
    ).resolves.toBe(2);

    expect(spies.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        memberStatus: "former",
        memberSyncedAt: syncedAt,
      })
    );
    expect(spies.updateWhere).toHaveBeenCalledOnce();
  });

  it("marks all active team-member rows former when active identity keys are empty", async () => {
    const syncedAt = new Date("2026-06-06T01:00:00.000Z");
    const { db, spies } = makeSyncDb([], 5);

    await expect(
      markFormerTeamMembersMissingFromSync(db, {
        activeIdentityKeys: [],
        clerkOrgId: "org_test",
        syncedAt,
      })
    ).resolves.toBe(5);

    expect(spies.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        memberStatus: "former",
        memberSyncedAt: syncedAt,
      })
    );
    expect(spies.updateWhere).toHaveBeenCalledOnce();
  });
});
