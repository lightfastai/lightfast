import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createSignalMock = vi.fn();
const markSignalFailedMock = vi.fn();
const sendMock = vi.fn();

vi.mock("@db/app", () => ({
  createSignal: createSignalMock,
  markSignalFailed: markSignalFailedMock,
}));

vi.mock("../inngest/client", () => ({
  inngest: { send: sendMock },
}));

const {
  SIGNAL_ENQUEUE_FAILED_ERROR_CODE,
  SignalCreateQueueError,
  createAndQueueSignal,
  isSignalCreateQueueError,
} = await import("../signals/create-signal");

const db = { kind: "mock-db" } as unknown as Database;

beforeEach(() => {
  createSignalMock.mockReset();
  markSignalFailedMock.mockReset();
  sendMock.mockReset();

  createSignalMock.mockResolvedValue({
    publicId: "signal_123e4567-e89b-12d3-a456-426614174000",
    clerkOrgId: "org_test",
    status: "queued",
    visibilityScope: "user",
  });
  markSignalFailedMock.mockResolvedValue(true);
  sendMock.mockResolvedValue(undefined);
});

describe("createAndQueueSignal", () => {
  it("creates a signal and sends the classification event", async () => {
    await expect(
      createAndQueueSignal(db, {
        clerkOrgId: "org_test",
        createdByApiKeyId: null,
        createdByUserId: "user_test",
        input: "Create from app UI",
      })
    ).resolves.toEqual({
      id: "signal_123e4567-e89b-12d3-a456-426614174000",
      status: "queued",
      visibilityScope: "user",
    });

    expect(createSignalMock).toHaveBeenCalledWith(db, {
      clerkOrgId: "org_test",
      createdByApiKeyId: null,
      createdByUserId: "user_test",
      input: "Create from app UI",
    });
    expect(sendMock).toHaveBeenCalledWith({
      name: "app/signal.created",
      data: {
        clerkOrgId: "org_test",
        signalId: "signal_123e4567-e89b-12d3-a456-426614174000",
      },
    });
  });

  it("preserves API key attribution for public API-created signals", async () => {
    await createAndQueueSignal(db, {
      clerkOrgId: "org_test",
      createdByApiKeyId: "key_test",
      createdByUserId: "user_test",
      input: "Create from public API",
    });

    expect(createSignalMock).toHaveBeenCalledWith(db, {
      clerkOrgId: "org_test",
      createdByApiKeyId: "key_test",
      createdByUserId: "user_test",
      input: "Create from public API",
    });
  });

  it("marks the created signal failed and throws a typed error when enqueue fails", async () => {
    sendMock.mockRejectedValueOnce(new Error("inngest unavailable"));

    const error = await createAndQueueSignal(db, {
      clerkOrgId: "org_test",
      createdByApiKeyId: null,
      createdByUserId: "user_test",
      input: "Create from app UI",
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(SignalCreateQueueError);
    expect(isSignalCreateQueueError(error)).toBe(true);
    expect(markSignalFailedMock).toHaveBeenCalledWith(db, {
      clerkOrgId: "org_test",
      errorCode: SIGNAL_ENQUEUE_FAILED_ERROR_CODE,
      errorMessage: "inngest unavailable",
      publicId: "signal_123e4567-e89b-12d3-a456-426614174000",
    });
  });

  it("preserves the queue error when marking the signal failed also fails", async () => {
    const enqueueError = new Error("inngest unavailable");
    sendMock.mockRejectedValueOnce(enqueueError);
    markSignalFailedMock.mockRejectedValueOnce(
      new Error("database unavailable")
    );

    const error = await createAndQueueSignal(db, {
      clerkOrgId: "org_test",
      createdByApiKeyId: null,
      createdByUserId: "user_test",
      input: "Create from app UI",
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(SignalCreateQueueError);
    expect(isSignalCreateQueueError(error)).toBe(true);
    expect(error).toMatchObject({
      cause: enqueueError,
      message: "Failed to queue signal for classification.",
    });
  });
});
