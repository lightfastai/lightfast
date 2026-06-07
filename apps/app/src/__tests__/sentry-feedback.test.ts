import { beforeEach, describe, expect, it, vi } from "vitest";

const captureFeedbackMock = vi.hoisted(() => vi.fn(() => "feedback_event"));
const flushMock = vi.hoisted(() => vi.fn(() => Promise.resolve(true)));

vi.mock("@sentry/nextjs", () => ({
  captureFeedback: captureFeedbackMock,
  flush: flushMock,
}));

const { submitSentryFeedback } = await import("../sentry-feedback");

beforeEach(() => {
  captureFeedbackMock.mockClear();
  flushMock.mockClear();
  flushMock.mockResolvedValue(true);
});

describe("submitSentryFeedback", () => {
  it("sends trimmed native feedback through Sentry captureFeedback", async () => {
    await expect(
      submitSentryFeedback({
        email: "  ada@example.com  ",
        message: "  Something broke on signals.  ",
        name: "  Ada Lovelace  ",
      })
    ).resolves.toBe("feedback_event");

    expect(captureFeedbackMock).toHaveBeenCalledWith(
      {
        email: "ada@example.com",
        message: "Something broke on signals.",
        name: "Ada Lovelace",
        source: "custom-app-feedback",
        tags: {
          feedback_source: "app-sidebar",
        },
        url: expect.any(String),
      },
      { includeReplay: true }
    );
    expect(flushMock).toHaveBeenCalledWith(5000);
  });

  it("omits optional contact fields when they are blank", async () => {
    await submitSentryFeedback({
      email: " ",
      message: "Only the message matters.",
      name: "",
    });

    expect(captureFeedbackMock).toHaveBeenCalledWith(
      expect.not.objectContaining({
        email: expect.anything(),
        name: expect.anything(),
      }),
      { includeReplay: true }
    );
    expect(flushMock).toHaveBeenCalledWith(5000);
  });

  it("throws when Sentry does not flush feedback before the timeout", async () => {
    flushMock.mockResolvedValue(false);

    await expect(
      submitSentryFeedback({
        message: "This should report a send failure.",
      })
    ).rejects.toThrow("Unable to send feedback");
  });
});
