import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyMock = vi.fn();
const getActiveOrgBindingMock = vi.fn();
const createSignalForActorMock = vi.fn();
const getVisibleSignalByPublicIdMock = vi.fn();

vi.mock("@vendor/unkey/server", () => ({
  getUnkeyClient: () => ({
    keys: { verifyKey: verifyMock },
  }),
}));

vi.mock("@db/app/client", () => ({ db: { kind: "mock-db" } }));
vi.mock("@db/app", () => ({
  getActiveOrgBinding: getActiveOrgBindingMock,
  getVisibleSignalByPublicId: getVisibleSignalByPublicIdMock,
}));

vi.mock("../signals/service", () => ({
  createSignalForActor: createSignalForActorMock,
}));

const { orpcRouter } = await import("../orpc/router");
const { SignalCreateQueueError } = await import("../signals/create-signal");

const validKey = `lf_${"a".repeat(40)}`;

function verifyResult(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    data: {
      code: "VALID",
      identity: { externalId: "org_test", id: "identity_test" },
      keyId: "key_test",
      meta: { createdByUserId: "user_test" },
      valid: true,
      ...overrides,
    },
    meta: { requestId: "req_test" },
  };
}

function context() {
  return {
    headers: new Headers({ authorization: `Bearer ${validKey}` }),
    requestId: "test-req",
  };
}

beforeEach(() => {
  verifyMock.mockReset();
  getActiveOrgBindingMock.mockReset();
  createSignalForActorMock.mockReset();
  getVisibleSignalByPublicIdMock.mockReset();

  verifyMock.mockResolvedValue(verifyResult());
  getActiveOrgBindingMock.mockResolvedValue({
    metadata: {
      lightfastRepository: {
        fullName: "acme/.lightfast",
        id: "987",
        installationId: "1001",
        name: ".lightfast",
        verifiedAt: "2026-05-30T10:00:00.000Z",
      },
    },
    provider: "github",
    providerAccountLogin: "acme",
    providerInstallationId: "1001",
  });
  createSignalForActorMock.mockResolvedValue({
    id: "signal_123e4567-e89b-12d3-a456-426614174000",
    status: "queued",
    visibilityScope: "user",
  });
});

describe("orpcRouter.signals", () => {
  it("creates a queued signal and sends an Inngest event", async () => {
    const result = await call(
      orpcRouter.signals.create,
      { input: "  Reply to this relevant post  " },
      { context: context() }
    );

    expect(result).toEqual({
      id: "signal_123e4567-e89b-12d3-a456-426614174000",
      status: "queued",
      visibilityScope: "user",
    });
    expect(createSignalForActorMock).toHaveBeenCalledWith(expect.anything(), {
      actor: {
        apiKeyId: "key_test",
        kind: "api_key",
        orgId: "org_test",
        userId: "user_test",
      },
      input: "Reply to this relevant post",
    });
  });

  it("translates signal queue failures to an internal error", async () => {
    createSignalForActorMock.mockRejectedValueOnce(
      new SignalCreateQueueError(new Error("inngest unavailable"))
    );

    await expect(
      call(
        orpcRouter.signals.create,
        { input: "Run the test plan" },
        { context: context() }
      )
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: expect.stringContaining("Failed to queue signal"),
    });
  });

  it("requires a bound org API key to create signals", async () => {
    getActiveOrgBindingMock.mockResolvedValueOnce(undefined);

    await expect(
      call(
        orpcRouter.signals.create,
        { input: "Run the test plan" },
        { context: context() }
      )
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(createSignalForActorMock).not.toHaveBeenCalled();
  });

  it("reads a same-org signal by id", async () => {
    getVisibleSignalByPublicIdMock.mockResolvedValueOnce({
      id: 1,
      publicId: "signal_123e4567-e89b-12d3-a456-426614174000",
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
      createdByApiKeyId: "key_test",
      createdByMcpClientId: null,
      createdByMcpGrantId: null,
      input: "Run the test plan",
      status: "classified",
      visibilityScope: "team",
      classification: {
        schemaVersion: "signal.classification.v2",
        disposition: "actionable",
        title: "Run the test plan",
        summary: "The user needs to finish a validation task.",
        kind: "review",
        nextAction: "Run the PR test plan.",
        priority: "high",
        rationale: "The input describes unfinished validation work.",
        confidence: 0.95,
        routing: {
          visibility: {
            scope: "team",
            rationale: "Relevant to the team.",
          },
          review: {
            required: false,
            reason: null,
            rationale: null,
          },
          routes: {
            people: {
              shouldRun: false,
              confidence: 0.8,
              rationale: "No specific person needs routing.",
            },
          },
        },
      },
      errorCode: null,
      errorMessage: null,
      createdAt: new Date("2026-05-21T00:00:00.000Z"),
      updatedAt: new Date("2026-05-21T00:01:00.000Z"),
    });

    const result = await call(
      orpcRouter.signals.get,
      { id: "signal_123e4567-e89b-12d3-a456-426614174000" },
      { context: context() }
    );

    expect(getVisibleSignalByPublicIdMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        clerkOrgId: "org_test",
        createdByUserId: "user_test",
        publicId: "signal_123e4567-e89b-12d3-a456-426614174000",
      }
    );
    expect(result).toMatchObject({
      id: "signal_123e4567-e89b-12d3-a456-426614174000",
      input: "Run the test plan",
      status: "classified",
      visibilityScope: "team",
      classification: { kind: "review" },
      createdAt: "2026-05-21T00:00:00.000Z",
      updatedAt: "2026-05-21T00:01:00.000Z",
    });
  });

  it("returns NOT_FOUND for missing or wrong-org signals", async () => {
    getVisibleSignalByPublicIdMock.mockResolvedValueOnce(undefined);

    await expect(
      call(
        orpcRouter.signals.get,
        { id: "signal_123e4567-e89b-12d3-a456-426614174000" },
        { context: context() }
      )
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
