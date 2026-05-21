import { beforeEach, describe, expect, it, vi } from "vitest";

const generateTextMock = vi.fn();
const outputObjectMock = vi.fn();

vi.mock("ai", () => ({
  generateText: generateTextMock,
  Output: {
    object: outputObjectMock,
  },
}));

const {
  OPPORTUNITY_CLASSIFIER_MODEL,
  OPPORTUNITY_CLASSIFIER_SYSTEM_PROMPT,
  classifyOpportunityInput,
} = await import("../opportunities/classifier");

const classification = {
  schemaVersion: "opportunity.classification.v1",
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

describe("classifyOpportunityInput", () => {
  it("uses Kimi K2.6 through AI Gateway with structured output", async () => {
    await expect(
      classifyOpportunityInput("Run the test plan")
    ).resolves.toEqual(classification);

    expect(OPPORTUNITY_CLASSIFIER_MODEL).toBe("moonshotai/kimi-k2.6");
    expect(outputObjectMock).toHaveBeenCalledWith({
      schema: expect.any(Object),
    });
    expect(generateTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "moonshotai/kimi-k2.6",
        output: { type: "object-output" },
        prompt: expect.stringContaining("Run the test plan"),
        system: OPPORTUNITY_CLASSIFIER_SYSTEM_PROMPT,
      })
    );
  });

  it("instructs the model not to browse or invent facts", () => {
    expect(OPPORTUNITY_CLASSIFIER_SYSTEM_PROMPT).toContain("Do not browse");
    expect(OPPORTUNITY_CLASSIFIER_SYSTEM_PROMPT).toContain("Do not invent");
    expect(OPPORTUNITY_CLASSIFIER_SYSTEM_PROMPT).toContain(
      "Preserve uncertainty"
    );
  });
});
