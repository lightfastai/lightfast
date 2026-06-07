import type {
  Database,
  EntityAccount,
  EntityAccountEvidenceTrail,
  EntityPerson,
  EntityPersonAccountAffiliation,
  EntityPersonEvidenceTrail,
} from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthIdentity } from "../auth/identity";

const getEntityAccountByPublicIdMock = vi.fn();
const getEntityAccountEvidenceTrailMock = vi.fn();
const getEntityPersonByPublicIdMock = vi.fn();
const getEntityPersonEvidenceTrailMock = vi.fn();
const listEntityAccountsMock = vi.fn();
const listEntityPeopleMock = vi.fn();
const listEntityPersonAccountAffiliationsMock = vi.fn();
const sendMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@db/app", () => ({
  getEntityAccountByPublicId: getEntityAccountByPublicIdMock,
  getEntityAccountEvidenceTrail: getEntityAccountEvidenceTrailMock,
  getEntityPersonByPublicId: getEntityPersonByPublicIdMock,
  getEntityPersonEvidenceTrail: getEntityPersonEvidenceTrailMock,
  listEntityAccounts: listEntityAccountsMock,
  listEntityPeople: listEntityPeopleMock,
  listEntityPersonAccountAffiliations: listEntityPersonAccountAffiliationsMock,
}));
vi.mock("@repo/entity-resolution", () => ({
  SIMULATED_ENTITY_SCENARIOS: [
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
}));
vi.mock("../inngest/client", () => ({
  inngest: { send: sendMock },
}));
vi.mock("@vendor/clerk/env", () => ({
  clerkEnvBase: { CLERK_SECRET_KEY: "sk_test_fake-secret-key-for-tests" },
}));
vi.mock("@vendor/observability/log/next", () => ({
  log: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock("@vendor/observability/trpc", () => ({
  createObservabilityMiddleware:
    () =>
    ({ next }: { next: () => unknown }) =>
      next(),
}));

const { createCallerFactory, createTRPCRouter } = await import("../trpc");
const { workspaceEntityGraphRouter } = await import(
  "../router/(pending-not-allowed)/workspace-entity-graph"
);

const testRouter = createTRPCRouter({
  entityGraph: workspaceEntityGraphRouter,
});
const createCaller = createCallerFactory(testRouter);

type ActiveAuthIdentity = Extract<AuthIdentity, { type: "active" }>;

const activeIdentity: ActiveAuthIdentity = {
  type: "active",
  userId: "user_test",
  orgId: "org_test",
  orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
};

const pendingIdentity: AuthIdentity = {
  type: "pending",
  userId: "user_test",
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

function caller(identity: AuthIdentity = activeIdentity) {
  return createCaller({
    auth: { identity },
    db: {} as Database,
    headers: new Headers(),
  });
}

beforeEach(() => {
  getEntityAccountByPublicIdMock.mockReset();
  getEntityAccountEvidenceTrailMock.mockReset();
  getEntityPersonByPublicIdMock.mockReset();
  getEntityPersonEvidenceTrailMock.mockReset();
  listEntityAccountsMock.mockReset();
  listEntityPeopleMock.mockReset();
  listEntityPersonAccountAffiliationsMock.mockReset();
  sendMock.mockReset();

  getEntityAccountByPublicIdMock.mockResolvedValue(accountRow);
  getEntityAccountEvidenceTrailMock.mockResolvedValue(accountEvidenceTrail);
  getEntityPersonByPublicIdMock.mockResolvedValue(personRow);
  getEntityPersonEvidenceTrailMock.mockResolvedValue(personEvidenceTrail);
  listEntityAccountsMock.mockResolvedValue([accountRow]);
  listEntityPeopleMock.mockResolvedValue([personRow]);
  listEntityPersonAccountAffiliationsMock.mockResolvedValue([affiliationRow]);
  sendMock.mockResolvedValue({ ids: ["evt_test"] });
});

describe("workspaceEntityGraphRouter", () => {
  it("lists canonical people and accounts for the active org", async () => {
    await expect(
      caller().entityGraph.people.list({ limit: 25, status: "likely" })
    ).resolves.toEqual([personRow]);
    await expect(
      caller().entityGraph.accounts.list({ limit: 10 })
    ).resolves.toEqual([accountRow]);

    expect(listEntityPeopleMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      limit: 25,
      status: "likely",
    });
    expect(listEntityAccountsMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      limit: 10,
      status: undefined,
    });
  });

  it("returns person details with affiliations and evidence trail", async () => {
    await expect(
      caller().entityGraph.people.get({ publicId: personRow.publicId })
    ).resolves.toEqual({
      affiliations: [affiliationRow],
      evidenceTrail: personEvidenceTrail,
      person: personRow,
    });

    expect(getEntityPersonByPublicIdMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        clerkOrgId: "org_test",
        publicId: personRow.publicId,
      }
    );
    expect(listEntityPersonAccountAffiliationsMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        clerkOrgId: "org_test",
        limit: 100,
        personId: personRow.id,
      }
    );
    expect(getEntityPersonEvidenceTrailMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        canonicalKey: personRow.canonicalKey,
        clerkOrgId: "org_test",
      }
    );
  });

  it("returns account details with evidence trail", async () => {
    await expect(
      caller().entityGraph.accounts.get({ publicId: accountRow.publicId })
    ).resolves.toEqual({
      account: accountRow,
      evidenceTrail: accountEvidenceTrail,
    });

    expect(getEntityAccountEvidenceTrailMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        canonicalKey: accountRow.canonicalKey,
        clerkOrgId: "org_test",
      }
    );
  });

  it("queues dev-only simulated ingestion through Inngest", async () => {
    await expect(
      caller().entityGraph.dev.ingestSimulated()
    ).resolves.toMatchObject({
      observations: 1,
      status: "queued",
    });

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
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

  it("queues dev-only signal enrichment retries through Inngest", async () => {
    const signalId = "signal_123e4567-e89b-12d3-a456-426614174000";

    await expect(
      caller().entityGraph.dev.retrySignalEnrichment({ signalId })
    ).resolves.toEqual({
      signalId,
      status: "queued",
    });

    expect(sendMock).toHaveBeenCalledWith({
      id: `signal-entity-enrichment-manual-org_test-${signalId}`,
      name: "app/signal.entity-enrichment.requested",
      data: {
        clerkOrgId: "org_test",
        reason: "manual_retry",
        signalId,
      },
    });
  });

  it("rejects missing detail rows and non-active orgs", async () => {
    getEntityPersonByPublicIdMock.mockResolvedValueOnce(undefined);

    await expect(
      caller().entityGraph.people.get({ publicId: "person_missing" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      caller(pendingIdentity).entityGraph.people.list({})
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
