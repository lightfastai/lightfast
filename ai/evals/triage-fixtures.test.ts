import { describe, expect, it } from "vitest";

import {
  loadTriageGithubIssueEvalCases,
  loadTriageGithubIssueSimilarityEvalCases,
} from "./triage-fixtures";

describe("triage GitHub Issue eval fixtures", () => {
  it("loads fixture cases with expected triage decisions", () => {
    const cases = loadTriageGithubIssueEvalCases();

    expect(cases.length).toBeGreaterThanOrEqual(30);
    expect(cases.map((testCase) => testCase.expected.triageDecision)).toEqual(
      expect.arrayContaining([
        "dismiss",
        "needs_context",
        "link_existing",
        "promote_opportunity",
        "create_task",
      ])
    );
  });

  it("includes candidate context for at least one duplicate/linking case", () => {
    const cases = loadTriageGithubIssueEvalCases();

    const linkingCases = cases.filter(
      (testCase) => testCase.expected.triageDecision === "link_existing"
    );

    expect(linkingCases.length).toBeGreaterThanOrEqual(5);
    expect(
      linkingCases.every((testCase) => testCase.input.candidates.length > 0)
    ).toBe(true);
    expect(linkingCases.every((testCase) => testCase.metadata.source)).toBe(
      true
    );
  });

  it("covers dogfood source item categories beyond exact implementation tasks", () => {
    const cases = loadTriageGithubIssueEvalCases();
    const intents = cases.map((testCase) => testCase.expected.workIntent);

    expect(intents).toEqual(
      expect.arrayContaining([
        "bug",
        "cleanup",
        "feature",
        "investigation",
        "planning",
        "question",
      ])
    );
  });

  it("derives similarity eval cases from duplicate/linking fixtures", () => {
    const cases = loadTriageGithubIssueSimilarityEvalCases();

    expect(cases.length).toBeGreaterThanOrEqual(5);
    expect(cases.map((testCase) => testCase.expected.relation)).toEqual(
      expect.arrayContaining(["duplicate"])
    );
    expect(
      cases.every(
        (testCase) =>
          testCase.input.candidates.length > 0 &&
          testCase.expected.candidateId ===
            testCase.input.candidates[0]?.candidateId
      )
    ).toBe(true);
  });
});
