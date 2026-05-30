import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyMock = vi.fn();
const isOrgBoundMock = vi.fn();
const createSignalMock = vi.fn();
const getSignalByPublicIdMock = vi.fn();
const markSignalFailedMock = vi.fn();
const sendMock = vi.fn();

vi.mock("@vendor/unkey/server", () => ({
  getUnkeyClient: () => ({
    keys: { verifyKey: verifyMock },
  }),
}));

vi.mock("@db/app/client", () => ({ db: { kind: "mock-db" } }));
vi.mock("@db/app", () => ({
  createSignal: createSignalMock,
  getSignalByPublicId: getSignalByPublicIdMock,
  isOrgBound: isOrgBoundMock,
  markSignalFailed: markSignalFailedMock,
}));

vi.mock("../inngest/client", () => ({
  inngest: { send: sendMock },
}));

const { orpcRouter } = await import("../orpc/router");

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
  isOrgBoundMock.mockReset();
  createSignalMock.mockReset();
  getSignalByPublicIdMock.mockReset();
  markSignalFailedMock.mockReset();
  sendMock.mockReset();

  verifyMock.mockResolvedValue(verifyResult());
  isOrgBoundMock.mockResolvedValue(true);
  createSignalMock.mockResolvedValue({
    publicId: "signal_123e4567-e89b-12d3-a456-426614174000",
    clerkOrgId: "org_test",
    status: "queued",
  });
  markSignalFailedMock.mockResolvedValue(true);
  sendMock.mockResolvedValue(undefined);
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
    });
    expect(createSignalMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      createdByApiKeyId: "key_test",
      createdByUserId: "user_test",
      input: "Reply to this relevant post",
    });
    expect(sendMock).toHaveBeenCalledWith({
      name: "app/signal.created",
      data: {
        clerkOrgId: "org_test",
        signalId: "signal_123e4567-e89b-12d3-a456-426614174000",
      },
    });
    expect(markSignalFailedMock).not.toHaveBeenCalled();
  });

  it("marks the signal failed when enqueueing the Inngest event fails", async () => {
    sendMock.mockRejectedValueOnce(new Error("inngest unavailable"));

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
    expect(markSignalFailedMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      errorCode: "INNGEST_ENQUEUE_FAILED",
      errorMessage: "inngest unavailable",
      publicId: "signal_123e4567-e89b-12d3-a456-426614174000",
    });
  });

  it("requires a bound org API key to create signals", async () => {
    isOrgBoundMock.mockResolvedValueOnce(false);

    await expect(
      call(
        orpcRouter.signals.create,
        { input: "Run the test plan" },
        { context: context() }
      )
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(createSignalMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("reads a same-org signal by id", async () => {
    getSignalByPublicIdMock.mockResolvedValueOnce({
      id: 1,
      publicId: "signal_123e4567-e89b-12d3-a456-426614174000",
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
      createdByApiKeyId: "key_test",
      input: "Run the test plan",
      status: "classified",
      classification: {
        schemaVersion: "signal.classification.v1",
        disposition: "actionable",
        title: "Run the test plan",
        summary: "The user needs to finish a validation task.",
        kind: "review",
        nextAction: "Run the PR test plan.",
        priority: "high",
        rationale: "The input describes unfinished validation work.",
        confidence: 0.95,
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

    expect(getSignalByPublicIdMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      publicId: "signal_123e4567-e89b-12d3-a456-426614174000",
    });
    expect(result).toMatchObject({
      id: "signal_123e4567-e89b-12d3-a456-426614174000",
      input: "Run the test plan",
      status: "classified",
      classification: { kind: "review" },
      createdAt: "2026-05-21T00:00:00.000Z",
      updatedAt: "2026-05-21T00:01:00.000Z",
    });
  });

  it("returns NOT_FOUND for missing or wrong-org signals", async () => {
    getSignalByPublicIdMock.mockResolvedValueOnce(undefined);

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
