import type { Database } from "@db/app";
import { describe, expect, it, vi } from "vitest";

import type {
  EntityAccount,
  EntityObservation,
  EntityPerson,
  EntityPersonAccountAffiliation,
  EntityResolutionCandidateGroup,
  EntityResolutionCandidateVersion,
  EntitySourceIdentity,
} from "../schema";
import {
  appendEntityObservation,
  appendResolutionCandidateVersionIfChanged,
  getEntityAccountByPublicId,
  getEntityAccountEvidenceTrail,
  getEntityPersonByPublicId,
  getEntityPersonEvidenceTrail,
  ingestEntityObservations,
  listEntityAccounts,
  listEntityPeople,
  listEntityPersonAccountAffiliations,
  persistEntityResolutionBatch,
  upsertEntityAccount,
  upsertEntityPerson,
  upsertPersonAccountAffiliation,
  upsertResolutionCandidateGroup,
  upsertSourceIdentity,
} from "../utils/entity-graph";

const NOW = new Date("2026-06-06T00:00:00.000Z");

describe("entity graph utilities", () => {
  it("upserts source identities by deterministic key", async () => {
    const sourceIdentity = makeSourceIdentity();
    const { db, spies } = makeEntityGraphDb([[sourceIdentity]]);

    await expect(
      upsertSourceIdentity(db, {
        clerkOrgId: "org_test",
        identityKey: "x:handle:ava_ai",
        identityType: "handle",
        identityValue: "@ava_ai",
        normalizedValue: "ava_ai",
        provider: "x",
        status: "likely",
      })
    ).resolves.toEqual(sourceIdentity);

    expect(spies.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        clerkOrgId: "org_test",
        identityKey: "x:handle:ava_ai",
        normalizedValue: "ava_ai",
        provider: "x",
      })
    );
    expect(spies.duplicateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        identityValue: "@ava_ai",
        normalizedValue: "ava_ai",
        status: "likely",
      })
    );
  });

  it("appends observations for changed normalized snapshots", async () => {
    const first = makeObservation({ contentHash: "hash_a", id: 1 });
    const second = makeObservation({ contentHash: "hash_b", id: 2 });
    const { db, spies } = makeEntityGraphDb([[first], [second]]);

    await expect(
      appendEntityObservation(db, {
        clerkOrgId: "org_test",
        contentHash: "hash_a",
        normalizedSnapshot: { login: "avachen" },
        observedAt: NOW,
        provider: "github",
        sourceIdentityId: 1,
      })
    ).resolves.toEqual(first);

    await expect(
      appendEntityObservation(db, {
        clerkOrgId: "org_test",
        contentHash: "hash_b",
        normalizedSnapshot: { login: "avachen", name: "Ava Chen" },
        observedAt: NOW,
        provider: "github",
        sourceIdentityId: 1,
      })
    ).resolves.toEqual(second);

    expect(spies.insertValues).toHaveBeenCalledTimes(2);
    expect(spies.insertValues).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ contentHash: "hash_a" })
    );
    expect(spies.insertValues).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ contentHash: "hash_b" })
    );
  });

  it("creates stable candidate groups by candidate key", async () => {
    const candidateGroup = makeCandidateGroup();
    const { db, spies } = makeEntityGraphDb([[candidateGroup]]);

    await expect(
      upsertResolutionCandidateGroup(db, {
        candidateKey: "person:github:handle:avachen|x:handle:ava_ai",
        candidateType: "person",
        clerkOrgId: "org_test",
        status: "likely",
      })
    ).resolves.toEqual(candidateGroup);

    expect(spies.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateKey: "person:github:handle:avachen|x:handle:ava_ai",
        candidateType: "person",
        clerkOrgId: "org_test",
      })
    );
    expect(spies.duplicateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "likely" })
    );
  });

  it("appends candidate versions only for changed output", async () => {
    const newVersion = makeCandidateVersion({ id: 10, outputHash: "out_new" });
    const existingVersion = makeCandidateVersion({
      id: 9,
      outputHash: "out_existing",
    });
    const changedDb = makeEntityGraphDb([[], [newVersion]]);

    await expect(
      appendResolutionCandidateVersionIfChanged(changedDb.db, {
        candidateGroupId: 3,
        clerkOrgId: "org_test",
        confidence: "0.9200",
        inputHash: "input_a",
        outputHash: "out_new",
        outputJson: { displayName: "Ava Chen" },
        resolverVersion: "local-v1",
        status: "likely",
      })
    ).resolves.toEqual({ appended: true, version: newVersion });

    expect(changedDb.spies.insertValues).toHaveBeenCalledOnce();
    expect(changedDb.spies.updateSet).toHaveBeenCalledWith({
      currentCandidateVersionId: 10,
      status: "likely",
    });

    const unchangedDb = makeEntityGraphDb([[existingVersion]]);

    await expect(
      appendResolutionCandidateVersionIfChanged(unchangedDb.db, {
        candidateGroupId: 3,
        clerkOrgId: "org_test",
        confidence: "0.9200",
        inputHash: "input_a",
        outputHash: "out_existing",
        outputJson: { displayName: "Ava Chen" },
        resolverVersion: "local-v1",
        status: "likely",
      })
    ).resolves.toEqual({ appended: false, version: existingVersion });

    expect(unchangedDb.spies.insertValues).not.toHaveBeenCalled();
    expect(unchangedDb.spies.updateSet).not.toHaveBeenCalled();
  });

  it("upserts canonical people, accounts, and affiliations by canonical keys", async () => {
    const person = makeEntityPerson();
    const account = makeEntityAccount();
    const affiliation = makeEntityAffiliation();
    const { db, spies } = makeEntityGraphDb([
      [person],
      [account],
      [affiliation],
    ]);

    await expect(
      upsertEntityPerson(db, {
        canonicalKey: "person:github:handle:avachen|x:handle:ava_ai",
        clerkOrgId: "org_test",
        confidence: "0.9200",
        displayName: "Ava Chen",
        primarySourceIdentityId: 1,
        status: "likely",
      })
    ).resolves.toEqual(person);

    await expect(
      upsertEntityAccount(db, {
        accountType: "company",
        canonicalKey: "account:domain:acme.com",
        clerkOrgId: "org_test",
        confidence: "0.8600",
        displayName: "Acme",
        primaryDomain: "acme.com",
        status: "likely",
      })
    ).resolves.toEqual(account);

    await expect(
      upsertPersonAccountAffiliation(db, {
        accountId: account.id,
        canonicalKey:
          "affiliation:person:github:handle:avachen|x:handle:ava_ai:account:domain:acme.com:current",
        clerkOrgId: "org_test",
        confidence: "0.7200",
        isPrimary: true,
        personId: person.id,
        relationship: "current",
        status: "likely",
      })
    ).resolves.toEqual(affiliation);

    expect(spies.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        canonicalKey: "person:github:handle:avachen|x:handle:ava_ai",
        displayName: "Ava Chen",
      })
    );
    expect(spies.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        accountType: "company",
        canonicalKey: "account:domain:acme.com",
        normalizedName: "acme",
      })
    );
    expect(spies.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: account.id,
        canonicalKey:
          "affiliation:person:github:handle:avachen|x:handle:ava_ai:account:domain:acme.com:current",
        personId: person.id,
      })
    );
  });

  it("persists resolver batches and canonicalizes only likely or confirmed records", async () => {
    const sourceRows = [
      makeSourceIdentity({ id: 1, identityKey: "x:handle:ava_ai" }),
      makeSourceIdentity({
        id: 2,
        identityKey: "github:handle:avachen",
        provider: "github",
      }),
      makeSourceIdentity({
        id: 3,
        identityKey: "x:handle:agentloop",
        normalizedValue: "agentloop",
      }),
    ];
    const likelyPersonKey = "person:github:handle:avachen|x:handle:ava_ai";
    const possiblePersonKey = "person:x:handle:agentloop";
    const accountKey = "account:domain:acme.com";
    const affiliationKey = `affiliation:${likelyPersonKey}:${accountKey}:current`;
    const candidateRows = [
      makeCandidateGroup({
        id: 11,
        candidateKey: likelyPersonKey,
        candidateType: "person",
      }),
      makeCandidateGroup({
        id: 12,
        candidateKey: possiblePersonKey,
        candidateType: "person",
        status: "possible",
      }),
      makeCandidateGroup({
        id: 13,
        candidateKey: accountKey,
        candidateType: "account",
      }),
      makeCandidateGroup({
        id: 14,
        candidateKey: affiliationKey,
        candidateType: "affiliation",
      }),
    ];
    const versionRows = candidateRows.map((group) =>
      makeCandidateVersion({
        candidateGroupId: group.id,
        id: group.id + 100,
        outputHash: `out_${group.id}`,
        status: group.status,
      })
    );
    const person = makeEntityPerson({
      canonicalKey: likelyPersonKey,
      id: 21,
      primarySourceIdentityId: 2,
    });
    const account = makeEntityAccount({ canonicalKey: accountKey, id: 31 });
    const affiliation = makeEntityAffiliation({
      accountId: account.id,
      canonicalKey: affiliationKey,
      id: 41,
      personId: person.id,
    });
    const { db, spies } = makeEntityGraphDb([
      ...sourceRows.map((row) => [row]),
      ...candidateRows.flatMap((group, index) => [
        [group],
        [],
        [versionRows[index]],
      ]),
      [account],
      [person],
      [affiliation],
    ]);

    await expect(
      persistEntityResolutionBatch(db, {
        batch: {
          sourceIdentities: [
            sourceInput("x:handle:ava_ai", "x", "ava_ai"),
            sourceInput("github:handle:avachen", "github", "avachen"),
            sourceInput("x:handle:agentloop", "x", "agentloop", "possible"),
          ],
          candidateGroups: [
            candidateInput({
              candidateKey: likelyPersonKey,
              candidateType: "person",
              outputHash: "out_11",
              outputJson: {
                displayName: "Ava Chen",
                sourceIdentityKeys: [
                  "github:handle:avachen",
                  "x:handle:ava_ai",
                ],
              },
            }),
            candidateInput({
              candidateKey: possiblePersonKey,
              candidateType: "person",
              outputHash: "out_12",
              outputJson: {
                displayName: "agentloop",
                sourceIdentityKeys: ["x:handle:agentloop"],
              },
              status: "possible",
            }),
            candidateInput({
              candidateKey: accountKey,
              candidateType: "account",
              outputHash: "out_13",
              outputJson: {
                displayName: "Acme",
                domains: ["acme.com"],
              },
            }),
            candidateInput({
              candidateKey: affiliationKey,
              candidateType: "affiliation",
              outputHash: "out_14",
              outputJson: {
                accountCandidateKey: accountKey,
                personCandidateKey: likelyPersonKey,
                relationship: "current",
              },
            }),
          ],
        },
        clerkOrgId: "org_test",
        resolverVersion: "local-v1",
      })
    ).resolves.toEqual({
      canonicalAccounts: 1,
      canonicalAffiliations: 1,
      canonicalPeople: 1,
      candidateGroups: 4,
      candidateVersionsAppended: 4,
      candidateVersionsUnchanged: 0,
      skippedCanonicalCandidates: 1,
      sourceIdentities: 3,
    });

    expect(
      spies.insertValues.mock.calls.filter(
        ([value]) =>
          isRecord(value) &&
          value.canonicalKey === possiblePersonKey &&
          value.displayName === "agentloop"
      )
    ).toHaveLength(0);
  });

  it("replays resolver batches without appending duplicate candidate versions", async () => {
    const source = makeSourceIdentity({ identityKey: "x:handle:ava_ai" });
    const personKey = "person:x:handle:ava_ai";
    const group = makeCandidateGroup({
      candidateKey: personKey,
      candidateType: "person",
    });
    const existingVersion = makeCandidateVersion({
      candidateGroupId: group.id,
      outputHash: "out_existing",
    });
    const person = makeEntityPerson({
      canonicalKey: personKey,
      primarySourceIdentityId: source.id,
    });
    const { db } = makeEntityGraphDb([
      [source],
      [group],
      [existingVersion],
      [person],
    ]);

    await expect(
      persistEntityResolutionBatch(db, {
        batch: {
          sourceIdentities: [sourceInput("x:handle:ava_ai", "x", "ava_ai")],
          candidateGroups: [
            candidateInput({
              candidateKey: personKey,
              candidateType: "person",
              outputHash: "out_existing",
              outputJson: {
                displayName: "Ava Chen",
                sourceIdentityKeys: ["x:handle:ava_ai"],
              },
            }),
          ],
        },
        clerkOrgId: "org_test",
        resolverVersion: "local-v1",
      })
    ).resolves.toEqual({
      canonicalAccounts: 0,
      canonicalAffiliations: 0,
      canonicalPeople: 1,
      candidateGroups: 1,
      candidateVersionsAppended: 0,
      candidateVersionsUnchanged: 1,
      skippedCanonicalCandidates: 0,
      sourceIdentities: 1,
    });
  });

  it("ingests normalized observations through resolver and persistence boundary", async () => {
    const sourceIdentity = makeSourceIdentity({
      id: 1,
      identityKey: "github:handle:solo-builder",
      identityValue: "solo-builder",
      normalizedValue: "solo-builder",
      provider: "github",
      status: "possible",
    });
    const observation = makeObservation({
      contentHash: "observed_hash",
      provider: "github",
      sourceIdentityId: sourceIdentity.id,
    });
    const domainSource = makeSourceIdentity({
      id: 2,
      identityKey: "domain:domain:solo.example",
      identityType: "domain",
      identityValue: "solo.example",
      normalizedValue: "solo.example",
      provider: "domain",
      status: "possible",
    });
    const accountGroup = makeCandidateGroup({
      candidateKey: "account:domain:solo.example",
      candidateType: "account",
      id: 51,
      status: "possible",
    });
    const affiliationGroup = makeCandidateGroup({
      candidateKey:
        "affiliation:person:github:handle:solo-builder:account:domain:solo.example:current",
      candidateType: "affiliation",
      id: 52,
      status: "possible",
    });
    const personGroup = makeCandidateGroup({
      candidateKey: "person:github:handle:solo-builder",
      candidateType: "person",
      id: 53,
      status: "possible",
    });
    const { db, spies } = makeEntityGraphDb([
      [sourceIdentity],
      [observation],
      [domainSource],
      [sourceIdentity],
      [accountGroup],
      [],
      [makeCandidateVersion({ candidateGroupId: accountGroup.id, id: 61 })],
      [affiliationGroup],
      [],
      [makeCandidateVersion({ candidateGroupId: affiliationGroup.id, id: 62 })],
      [personGroup],
      [],
      [makeCandidateVersion({ candidateGroupId: personGroup.id, id: 63 })],
    ]);

    await expect(
      ingestEntityObservations(db, {
        clerkOrgId: "org_test",
        observations: [
          {
            observedAt: "2026-06-06T00:00:00.000Z",
            profile: {
              blog: "https://solo.example",
              id: "gh_solo",
              location: "Melbourne",
              login: "solo-builder",
              name: "Solo Builder",
            },
            provider: "github",
          },
        ],
        resolverVersion: "local-ingest-v1",
      })
    ).resolves.toEqual({
      canonicalAccounts: 0,
      canonicalAffiliations: 0,
      canonicalPeople: 0,
      candidateGroups: 3,
      candidateVersionsAppended: 3,
      candidateVersionsUnchanged: 0,
      observations: 1,
      skippedCanonicalCandidates: 3,
      sourceIdentities: 2,
    });

    expect(spies.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        contentHash: expect.any(String),
        normalizedSnapshot: expect.objectContaining({
          profile: expect.objectContaining({ login: "solo-builder" }),
          provider: "github",
        }),
        provider: "github",
        sourceIdentityId: sourceIdentity.id,
      })
    );
    expect(spies.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateKey: "person:github:handle:solo-builder",
        candidateType: "person",
      })
    );
  });

  it("lists canonical people, accounts, affiliations, and reads candidate trails", async () => {
    const person = makeEntityPerson();
    const account = makeEntityAccount();
    const affiliation = makeEntityAffiliation();
    const personGroup = makeCandidateGroup({
      candidateKey: person.canonicalKey,
      candidateType: "person",
      id: 50,
    });
    const accountGroup = makeCandidateGroup({
      candidateKey: account.canonicalKey,
      candidateType: "account",
      id: 51,
    });
    const personVersion = makeCandidateVersion({
      candidateGroupId: personGroup.id,
      id: 60,
    });
    const accountVersion = makeCandidateVersion({
      candidateGroupId: accountGroup.id,
      id: 61,
    });
    const { db, spies } = makeEntityGraphDb([
      [person],
      [account],
      [affiliation],
      [person],
      [personGroup],
      [personVersion],
      [account],
      [accountGroup],
      [accountVersion],
    ]);

    await expect(
      listEntityPeople(db, { clerkOrgId: "org_test", limit: 10 })
    ).resolves.toEqual([person]);
    await expect(
      listEntityAccounts(db, { clerkOrgId: "org_test", limit: 10 })
    ).resolves.toEqual([account]);
    await expect(
      listEntityPersonAccountAffiliations(db, {
        clerkOrgId: "org_test",
        limit: 10,
        personId: person.id,
      })
    ).resolves.toEqual([affiliation]);
    await expect(
      getEntityPersonEvidenceTrail(db, {
        canonicalKey: person.canonicalKey,
        clerkOrgId: "org_test",
      })
    ).resolves.toEqual({
      candidateGroup: personGroup,
      candidateVersions: [personVersion],
      person,
    });
    await expect(
      getEntityAccountEvidenceTrail(db, {
        canonicalKey: account.canonicalKey,
        clerkOrgId: "org_test",
      })
    ).resolves.toEqual({
      account,
      candidateGroup: accountGroup,
      candidateVersions: [accountVersion],
    });

    expect(spies.limit).toHaveBeenCalledWith(10);
  });

  it("loads canonical people and accounts by org-scoped public ids", async () => {
    const person = makeEntityPerson();
    const account = makeEntityAccount();
    const { db } = makeEntityGraphDb([[person], [account]]);

    await expect(
      getEntityPersonByPublicId(db, {
        clerkOrgId: "org_test",
        publicId: person.publicId,
      })
    ).resolves.toEqual(person);
    await expect(
      getEntityAccountByPublicId(db, {
        clerkOrgId: "org_test",
        publicId: account.publicId,
      })
    ).resolves.toEqual(account);
  });
});

function makeSourceIdentity(
  overrides: Partial<EntitySourceIdentity> = {}
): EntitySourceIdentity {
  return {
    id: 1,
    publicId: "sid_123e4567-e89b-12d3-a456-426614174000",
    clerkOrgId: "org_test",
    provider: "x",
    identityType: "handle",
    identityValue: "@ava_ai",
    normalizedValue: "ava_ai",
    identityKey: "x:handle:ava_ai",
    status: "likely",
    metadata: {},
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeObservation(
  overrides: Partial<EntityObservation> = {}
): EntityObservation {
  return {
    id: 1,
    publicId: "obs_123e4567-e89b-12d3-a456-426614174000",
    clerkOrgId: "org_test",
    sourceIdentityId: 1,
    provider: "github",
    observedAt: NOW,
    contentHash: "hash_a",
    normalizedSnapshot: { login: "avachen" },
    rawSnapshot: null,
    rawExpiresAt: null,
    status: "active",
    supersededByObservationId: null,
    createdAt: NOW,
    updatedAt: NOW,
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
    primarySourceIdentityId: 2,
    confirmedByType: null,
    confirmedById: null,
    confirmationPolicy: null,
    confirmedAt: null,
    metadata: {},
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeEntityAccount(
  overrides: Partial<EntityAccount> = {}
): EntityAccount {
  return {
    id: 31,
    publicId: "acct_123e4567-e89b-12d3-a456-426614174000",
    canonicalKey: "account:domain:acme.com",
    clerkOrgId: "org_test",
    displayName: "Acme",
    normalizedName: "acme",
    accountType: "company",
    primaryDomain: "acme.com",
    status: "likely",
    confidence: "0.8600",
    confirmedByType: null,
    confirmedById: null,
    confirmationPolicy: null,
    confirmedAt: null,
    metadata: {},
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeEntityAffiliation(
  overrides: Partial<EntityPersonAccountAffiliation> = {}
): EntityPersonAccountAffiliation {
  return {
    id: 41,
    publicId: "aff_123e4567-e89b-12d3-a456-426614174000",
    canonicalKey:
      "affiliation:person:github:handle:avachen|x:handle:ava_ai:account:domain:acme.com:current",
    clerkOrgId: "org_test",
    personId: 21,
    accountId: 31,
    relationship: "current",
    isPrimary: true,
    title: null,
    status: "likely",
    confidence: "0.7200",
    confirmedByType: null,
    confirmedById: null,
    confirmationPolicy: null,
    confirmedAt: null,
    startedAt: null,
    endedAt: null,
    metadata: {},
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeCandidateGroup(
  overrides: Partial<EntityResolutionCandidateGroup> = {}
): EntityResolutionCandidateGroup {
  return {
    id: 3,
    publicId: "candgrp_123e4567-e89b-12d3-a456-426614174000",
    clerkOrgId: "org_test",
    candidateType: "person",
    candidateKey: "person:github:handle:avachen|x:handle:ava_ai",
    currentCandidateVersionId: null,
    status: "likely",
    metadata: {},
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeCandidateVersion(
  overrides: Partial<EntityResolutionCandidateVersion> = {}
): EntityResolutionCandidateVersion {
  return {
    id: 10,
    publicId: "candver_123e4567-e89b-12d3-a456-426614174000",
    clerkOrgId: "org_test",
    candidateGroupId: 3,
    resolverVersion: "local-v1",
    inputHash: "input_a",
    outputHash: "out_new",
    status: "likely",
    confidence: "0.9200",
    outputJson: { displayName: "Ava Chen" },
    supersededAt: null,
    metadata: {},
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeEntityGraphDb(selectResults: unknown[][]) {
  const selectQueue = [...selectResults];
  const spies = {
    duplicateSet: vi.fn(),
    insertValues: vi.fn(),
    limit: vi.fn((value: number) =>
      Promise.resolve((selectQueue.shift() ?? []).slice(0, value))
    ),
    orderBy: vi.fn(),
    updateSet: vi.fn(),
    updateWhere: vi.fn(),
    where: vi.fn(),
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
        where: (condition: unknown) => {
          spies.where(condition);
          return {
            limit: spies.limit,
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
    update: () => ({
      set: (set: unknown) => {
        spies.updateSet(set);
        return {
          where: (condition: unknown) => {
            spies.updateWhere(condition);
            return Promise.resolve({ rowsAffected: 1 });
          },
        };
      },
    }),
  };
  return { db: db as unknown as Database, spies };
}

function sourceInput(
  identityKey: string,
  provider: "github" | "x",
  normalizedValue: string,
  status: "likely" | "possible" = "likely"
) {
  return {
    identityKey,
    identityType: "handle" as const,
    identityValue: normalizedValue,
    metadata: {},
    normalizedValue,
    provider,
    status,
  };
}

function candidateInput(input: {
  candidateKey: string;
  candidateType: "account" | "affiliation" | "person";
  outputHash: string;
  outputJson: Record<string, unknown>;
  status?: "likely" | "possible";
}) {
  return {
    candidateKey: input.candidateKey,
    candidateType: input.candidateType,
    confidence: input.status === "possible" ? "0.4800" : "0.9200",
    inputHash: `in_${input.outputHash}`,
    metadata: {},
    outputHash: input.outputHash,
    outputJson: input.outputJson,
    status: input.status ?? "likely",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
