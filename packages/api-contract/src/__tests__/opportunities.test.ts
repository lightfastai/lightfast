import { describe, expect, it } from "vitest";

import {
  createOpportunityInput,
  opportunityClassificationSchema,
  opportunityIdSchema,
} from "../schemas/opportunities";

describe("opportunity schemas", () => {
  it("trims and accepts non-empty opportunity input", () => {
    expect(
      createOpportunityInput.parse({ input: "  Run the PR test plan  " })
    ).toEqual({ input: "Run the PR test plan" });
  });

  it("rejects empty opportunity input", () => {
    expect(() => createOpportunityInput.parse({ input: "   " })).toThrow();
  });

  it("rejects opportunity input over 4000 characters", () => {
    expect(() =>
      createOpportunityInput.parse({ input: "a".repeat(4001) })
    ).toThrow();
  });

  it("accepts generated opportunity ids", () => {
    expect(
      opportunityIdSchema.parse("opp_123e4567-e89b-12d3-a456-426614174000")
    ).toBe("opp_123e4567-e89b-12d3-a456-426614174000");
  });

  it("validates opportunity classification v1", () => {
    expect(
      opportunityClassificationSchema.parse({
        schemaVersion: "opportunity.classification.v1",
        disposition: "actionable",
        title: "Finish Safari testing",
        summary: "The user has a PR test-plan item left to complete.",
        kind: "review",
        nextAction: "Run the mobile Safari test-plan pass.",
        priority: "high",
        rationale: "The input describes an unfinished validation step.",
        confidence: 0.9,
      })
    ).toMatchObject({
      schemaVersion: "opportunity.classification.v1",
      kind: "review",
    });
  });
});
