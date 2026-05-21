import { beforeEach, describe, expect, it, vi } from "vitest";

const generateTextMock = vi.fn();
const outputObjectMock = vi.fn();

vi.mock("ai", () => ({
  generateText: generateTextMock,
  Output: {
    object: outputObjectMock,
  },
}));

vi.mock("@db/app/client", () => ({
  db: {},
}));

vi.mock("../inngest/client", () => ({
  inngest: {
    createFunction: vi.fn(() => ({ id: "classify-signal" })),
  },
}));

const {
  SIGNAL_CLASSIFIER_MODEL,
  SIGNAL_CLASSIFIER_SYSTEM_PROMPT,
  buildSignalClassificationRequest,
  classifySignalInput,
} = await import("../inngest/workflow/classify-signal");

const classification = {
  schemaVersion: "signal.classification.v1",
  disposition: "actionable",
  title: "Run the test plan",
  summary: "The user needs to finish a validation task.",
  kind: "review",
  nextAction: "Run the PR test plan.",
  priority: "high",
  rationale: "The input describes unfinished validation work.",
  confidence: 0.95,
};

beforeEach(() => {
  generateTextMock.mockReset();
  outputObjectMock.mockReset();
  outputObjectMock.mockReturnValue({ type: "object-output" });
  generateTextMock.mockResolvedValue({ output: classification });
});

describe("classifySignalInput", () => {
  it("uses Kimi K2.6 through AI Gateway with structured output", async () => {
    const request = buildSignalClassificationRequest("Run the test plan");

    expect(request).toEqual({
      model: SIGNAL_CLASSIFIER_MODEL,
      prompt: expect.stringContaining("Run the test plan"),
      system: SIGNAL_CLASSIFIER_SYSTEM_PROMPT,
    });

    await expect(classifySignalInput(request)).resolves.toEqual(
      classification
    );

    expect(SIGNAL_CLASSIFIER_MODEL).toBe("moonshotai/kimi-k2.6");
    expect(outputObjectMock).toHaveBeenCalledWith({
      schema: expect.any(Object),
    });
    expect(generateTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "moonshotai/kimi-k2.6",
        output: { type: "object-output" },
        prompt: expect.stringContaining("Run the test plan"),
        system: SIGNAL_CLASSIFIER_SYSTEM_PROMPT,
      })
    );
  });

  it("instructs the model not to browse or invent facts", () => {
    expect(SIGNAL_CLASSIFIER_SYSTEM_PROMPT).toContain("Do not browse");
    expect(SIGNAL_CLASSIFIER_SYSTEM_PROMPT).toContain("Do not invent");
    expect(SIGNAL_CLASSIFIER_SYSTEM_PROMPT).toContain(
      "Preserve uncertainty"
    );
  });
});
