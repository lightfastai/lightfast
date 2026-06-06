import { beforeEach, describe, expect, it, vi } from "vitest";

const captureFeedbackMock = vi.hoisted(() => vi.fn(() => "feedback_event"));

vi.mock("@sentry/nextjs", () => ({
  captureFeedback: captureFeedbackMock,
}));

const { submitSentryFeedback } = await import("../sentry-feedback");

beforeEach(() => {
  captureFeedbackMock.mockClear();
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
  });
});
