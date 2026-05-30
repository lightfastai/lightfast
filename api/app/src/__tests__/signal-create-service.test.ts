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
  createAndQueueSignal,
  isSignalCreateQueueError,
  SignalCreateQueueError,
  SIGNAL_ENQUEUE_FAILED_ERROR_CODE,
} = await import("../signals/create-signal");

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
  it("creates a user-visible queued signal and sends an Inngest event", async () => {
    await expect(
      createAndQueueSignal({ kind: "mock-db" } as never, {
        clerkOrgId: "org_test",
        createdByApiKeyId: "key_test",
        createdByUserId: "user_test",
        input: "Classify this signal",
      })
    ).resolves.toEqual({
      id: "signal_123e4567-e89b-12d3-a456-426614174000",
      status: "queued",
      visibilityScope: "user",
    });

    expect(createSignalMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      createdByApiKeyId: "key_test",
      createdByUserId: "user_test",
      input: "Classify this signal",
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

  it("marks the signal failed and throws a typed error when enqueue fails", async () => {
    const cause = new Error("inngest unavailable");
    sendMock.mockRejectedValueOnce(cause);

    const promise = createAndQueueSignal({ kind: "mock-db" } as never, {
      clerkOrgId: "org_test",
      createdByApiKeyId: "key_test",
      createdByUserId: "user_test",
      input: "Classify this signal",
    });

    await expect(promise).rejects.toBeInstanceOf(SignalCreateQueueError);
    await expect(promise).rejects.toMatchObject({
      message: "Failed to queue signal for classification.",
      cause,
    });
    await expect(promise).rejects.toSatisfy(isSignalCreateQueueError);

    expect(markSignalFailedMock).toHaveBeenCalledWith(expect.anything(), {
      publicId: "signal_123e4567-e89b-12d3-a456-426614174000",
      clerkOrgId: "org_test",
      errorCode: SIGNAL_ENQUEUE_FAILED_ERROR_CODE,
      errorMessage: "inngest unavailable",
    });
  });

  it("preserves the typed queue error when marking the signal failed also fails", async () => {
    const enqueueError = new Error("inngest unavailable");
    sendMock.mockRejectedValueOnce(enqueueError);
    markSignalFailedMock.mockRejectedValueOnce(
      new Error("database unavailable")
    );

    let thrown: unknown;
    try {
      await createAndQueueSignal({ kind: "mock-db" } as never, {
        clerkOrgId: "org_test",
        createdByApiKeyId: "key_test",
        createdByUserId: "user_test",
        input: "Classify this signal",
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(SignalCreateQueueError);
    expect(isSignalCreateQueueError(thrown)).toBe(true);
    expect(thrown).toMatchObject({
      message: "Failed to queue signal for classification.",
      cause: enqueueError,
    });
  });
});
