import type {
  Database,
  EntityAccount,
  EntityAccountEvidenceTrail,
  EntityPerson,
  EntityPersonAccountAffiliation,
  EntityPersonEvidenceTrail,
} from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ExecutionContext } from "../domain";
import {
  getEntityAccountCommand,
  getEntityPersonCommand,
  ingestSimulatedEntityGraphCommand,
  listEntityAccountsCommand,
  listEntityPeopleCommand,
  retrySignalEnrichmentCommand,
} from "../domain/entity-graph";

const activeCtx: ExecutionContext = {
  actor: {
    kind: "clerkUser",
    orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
    orgId: "org_test",
    source: "web",
    userId: "user_test",
  },
  request: { id: "req_test", source: "tanstack" },
};

const pendingCtx: ExecutionContext = {
  actor: {
    kind: "clerkUser",
    source: "web",
    userId: "user_test",
  },
  request: { id: "req_test", source: "tanstack" },
};

const personRow: EntityPerson = {
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
  createdAt: new Date("2026-06-06T00:00:00.000Z"),
  updatedAt: new Date("2026-06-06T00:01:00.000Z"),
};

const accountRow: EntityAccount = {
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
  createdAt: new Date("2026-06-06T00:00:00.000Z"),
  updatedAt: new Date("2026-06-06T00:01:00.000Z"),
};

const affiliationRow: EntityPersonAccountAffiliation = {
  id: 41,
  publicId: "aff_123e4567-e89b-12d3-a456-426614174000",
  canonicalKey:
    "affiliation:person:github:handle:avachen|x:handle:ava_ai:account:domain:acme.com:current",
  clerkOrgId: "org_test",
  personId: personRow.id,
  accountId: accountRow.id,
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
  createdAt: new Date("2026-06-06T00:00:00.000Z"),
  updatedAt: new Date("2026-06-06T00:01:00.000Z"),
};

const personEvidenceTrail: EntityPersonEvidenceTrail = {
  person: personRow,
  candidateGroup: undefined,
  candidateVersions: [],
};

const accountEvidenceTrail: EntityAccountEvidenceTrail = {
  account: accountRow,
  candidateGroup: undefined,
  candidateVersions: [],
};

function createDeps() {
  return {
    db: {} as Database,
    getEntityAccountByPublicId: vi.fn().mockResolvedValue(accountRow),
    getEntityAccountEvidenceTrail: vi
      .fn()
      .mockResolvedValue(accountEvidenceTrail),
    getEntityPersonByPublicId: vi.fn().mockResolvedValue(personRow),
    getEntityPersonEvidenceTrail: vi
      .fn()
      .mockResolvedValue(personEvidenceTrail),
    isProduction: vi.fn().mockReturnValue(false),
    listEntityAccounts: vi.fn().mockResolvedValue([accountRow]),
    listEntityPeople: vi.fn().mockResolvedValue([personRow]),
    listEntityPersonAccountAffiliations: vi
      .fn()
      .mockResolvedValue([affiliationRow]),
    now: vi.fn().mockReturnValue(new Date("2026-06-06T00:00:00.000Z")),
    sendInngestEvent: vi.fn().mockResolvedValue({ ids: ["evt_test"] }),
    simulatedScenarios: [
      {
        id: "test-scenario",
        observations: [
          {
            provider: "github",
            profile: {
              id: "gh_ava",
              login: "avachen",
              name: "Ava Chen",
            },
          },
        ],
      },
    ],
  };
}

let deps: ReturnType<typeof createDeps>;

beforeEach(() => {
  deps = createDeps();
});

describe("entity graph domain commands", () => {
  it("lists canonical people and accounts for the bound actor org", async () => {
    await expect(
      listEntityPeopleCommand.run({
        ctx: activeCtx,
        deps,
        input: { limit: 25, status: "likely" },
      })
    ).resolves.toEqual([personRow]);

    await expect(
      listEntityAccountsCommand.run({
        ctx: activeCtx,
        deps,
        input: { limit: 10 },
      })
    ).resolves.toEqual([accountRow]);

    expect(deps.listEntityPeople).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      limit: 25,
      status: "likely",
    });
    expect(deps.listEntityAccounts).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      limit: 10,
      status: undefined,
    });
  });

  it("returns person details with affiliations and evidence trail", async () => {
    await expect(
      getEntityPersonCommand.run({
        ctx: activeCtx,
        deps,
        input: { publicId: personRow.publicId },
      })
    ).resolves.toEqual({
      affiliations: [affiliationRow],
      evidenceTrail: personEvidenceTrail,
      person: personRow,
    });

    expect(deps.getEntityPersonByPublicId).toHaveBeenCalledWith(
      expect.anything(),
      {
        clerkOrgId: "org_test",
        publicId: personRow.publicId,
      }
    );
    expect(deps.listEntityPersonAccountAffiliations).toHaveBeenCalledWith(
      expect.anything(),
      {
        clerkOrgId: "org_test",
        limit: 100,
        personId: personRow.id,
      }
    );
  });

  it("returns account details with evidence trail", async () => {
    await expect(
      getEntityAccountCommand.run({
        ctx: activeCtx,
        deps,
        input: { publicId: accountRow.publicId },
      })
    ).resolves.toEqual({
      account: accountRow,
      evidenceTrail: accountEvidenceTrail,
    });

    expect(deps.getEntityAccountEvidenceTrail).toHaveBeenCalledWith(
      expect.anything(),
      {
        canonicalKey: accountRow.canonicalKey,
        clerkOrgId: "org_test",
      }
    );
  });

  it("rejects missing detail rows and pending actors with domain errors", async () => {
    deps.getEntityPersonByPublicId.mockResolvedValueOnce(undefined);

    await expect(
      getEntityPersonCommand.run({
        ctx: activeCtx,
        deps,
        input: { publicId: "person_missing" },
      })
    ).rejects.toMatchObject({
      code: "ENTITY_PERSON_NOT_FOUND",
      kind: "not_found",
    });

    await expect(
      listEntityPeopleCommand.run({
        ctx: pendingCtx,
        deps,
        input: {},
      })
    ).rejects.toMatchObject({
      code: "ORG_REQUIRED",
      kind: "authz",
    });
  });

  it("queues dev-only simulated ingestion through an explicit event sender", async () => {
    await expect(
      ingestSimulatedEntityGraphCommand.run({
        ctx: activeCtx,
        deps,
        input: {},
      })
    ).resolves.toEqual({
      ingestionId: "simulated-1780704000000",
      observations: 1,
      status: "queued",
    });

    expect(deps.sendInngestEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "entity-graph-simulated-org_test-simulated-1780704000000",
        name: "app/connector.profile.observed",
        data: expect.objectContaining({
          clerkOrgId: "org_test",
          observations: [
            {
              provider: "github",
              profile: {
                id: "gh_ava",
                login: "avachen",
                name: "Ava Chen",
              },
            },
          ],
          resolverVersion: "local-simulated-v1",
        }),
      })
    );
  });

  it("queues dev-only signal enrichment retries through an explicit event sender", async () => {
    const signalId = "signal_123e4567-e89b-12d3-a456-426614174000";

    await expect(
      retrySignalEnrichmentCommand.run({
        ctx: activeCtx,
        deps,
        input: { signalId },
      })
    ).resolves.toEqual({
      signalId,
      status: "queued",
    });

    expect(deps.sendInngestEvent).toHaveBeenCalledWith({
      id: `signal-entity-enrichment-manual-org_test-${signalId}`,
      name: "app/signal.entity-enrichment.requested",
      data: {
        clerkOrgId: "org_test",
        reason: "manual_retry",
        signalId,
      },
    });
  });

  it("rejects dev-only commands in production before enqueueing events", async () => {
    deps.isProduction.mockReturnValue(true);

    await expect(
      ingestSimulatedEntityGraphCommand.run({
        ctx: activeCtx,
        deps,
        input: {},
      })
    ).rejects.toMatchObject({
      code: "DEV_ONLY_COMMAND",
      kind: "authz",
    });

    expect(deps.sendInngestEvent).not.toHaveBeenCalled();
  });
});
