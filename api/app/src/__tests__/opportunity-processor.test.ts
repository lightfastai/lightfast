import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getOpportunityByIdMock = vi.fn();
const markOpportunityProcessingMock = vi.fn();
const markOpportunityClassifiedMock = vi.fn();
const markOpportunityFailedMock = vi.fn();
const classifyOpportunityInputMock = vi.fn();

vi.mock("@db/app", () => ({
  getOpportunityById: getOpportunityByIdMock,
  markOpportunityClassified: markOpportunityClassifiedMock,
  markOpportunityFailed: markOpportunityFailedMock,
  markOpportunityProcessing: markOpportunityProcessingMock,
}));

vi.mock("../opportunities/classifier", () => ({
  classifyOpportunityInput: classifyOpportunityInputMock,
}));

const { processOpportunityClassification } = await import(
  "../opportunities/processor"
);

const db = { kind: "mock-db" } as unknown as Database;
const opportunity = {
  id: "opp_123e4567-e89b-12d3-a456-426614174000",
  clerkOrgId: "org_test",
  input: "Run the PR test plan",
  status: "queued",
};
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
  getOpportunityByIdMock.mockReset();
  markOpportunityProcessingMock.mockReset();
  markOpportunityClassifiedMock.mockReset();
  markOpportunityFailedMock.mockReset();
  classifyOpportunityInputMock.mockReset();

  getOpportunityByIdMock.mockResolvedValue(opportunity);
  classifyOpportunityInputMock.mockResolvedValue(classification);
});

describe("processOpportunityClassification", () => {
  it("transitions a queued opportunity through processing to classified", async () => {
    await expect(
      processOpportunityClassification({
        db,
        clerkOrgId: "org_test",
        opportunityId: "opp_123e4567-e89b-12d3-a456-426614174000",
      })
    ).resolves.toEqual({ status: "classified" });

    expect(markOpportunityProcessingMock).toHaveBeenCalledWith(db, {
      clerkOrgId: "org_test",
      id: "opp_123e4567-e89b-12d3-a456-426614174000",
    });
    expect(classifyOpportunityInputMock).toHaveBeenCalledWith(
      "Run the PR test plan"
    );
    expect(markOpportunityClassifiedMock).toHaveBeenCalledWith(db, {
      classification,
      clerkOrgId: "org_test",
      id: "opp_123e4567-e89b-12d3-a456-426614174000",
    });
    expect(
      markOpportunityProcessingMock.mock.invocationCallOrder[0]!
    ).toBeLessThan(markOpportunityClassifiedMock.mock.invocationCallOrder[0]!);
  });

  it("marks the opportunity failed when classification fails", async () => {
    classifyOpportunityInputMock.mockRejectedValueOnce(
      new Error("model unavailable")
    );

    await expect(
      processOpportunityClassification({
        db,
        clerkOrgId: "org_test",
        opportunityId: "opp_123e4567-e89b-12d3-a456-426614174000",
      })
    ).resolves.toEqual({ status: "failed" });

    expect(markOpportunityFailedMock).toHaveBeenCalledWith(db, {
      clerkOrgId: "org_test",
      errorCode: "CLASSIFICATION_FAILED",
      errorMessage: "model unavailable",
      id: "opp_123e4567-e89b-12d3-a456-426614174000",
    });
  });
});
