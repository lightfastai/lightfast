import { describe, expect, it } from "vitest";

import {
  buildTriageActionRecommendationRequest,
  buildTriageSimilarityRequest,
  buildTriageSourceItemClassificationRequest,
} from "../../triage";

const githubIssue = {
  provider: "github" as const,
  sourceType: "issue" as const,
  externalId: "lightfastai/lightfast#42",
  externalUrl: "https://github.com/lightfastai/lightfast/issues/42",
  title: "Avoid duplicating deferred CodeRabbit work",
  body: "We deferred this in a prior PR and created an issue. A later PR suggested the same fix again.",
  state: "open",
  labels: ["triage", "dogfood"],
  metadata: {
    repository: "lightfastai/lightfast",
    number: 42,
  },
};

describe("triage request builders", () => {
  it("builds a source item classification request from a GitHub issue", () => {
    const request = buildTriageSourceItemClassificationRequest({
      clerkOrgId: "org_123",
      deploymentEnvironment: "development",
      sourceItem: githubIssue,
      triageRunId: "triage_run_1",
    });

    expect(request.system).toContain("Lightfast triage classifier");
    expect(request.prompt).toContain("GitHub");
    expect(request.prompt).toContain(
      "Avoid duplicating deferred CodeRabbit work"
    );
    expect(request.inputLength).toBeGreaterThan(githubIssue.title.length);
  });

  it("builds a similarity request with bounded candidate context", () => {
    const request = buildTriageSimilarityRequest({
      clerkOrgId: "org_123",
      deploymentEnvironment: "development",
      sourceItem: githubIssue,
      candidates: [
        {
          candidateId: "github-issue-17",
          title: "Track deferred CodeRabbit auth boundary fix",
          summary: "Prior issue for the same repeated review feedback.",
          sourceProvider: "github",
          sourceType: "issue",
        },
      ],
      triageRunId: "triage_run_1",
    });

    expect(request.system).toContain("Lightfast triage similarity ranker");
    expect(request.prompt).toContain("github-issue-17");
    expect(request.prompt).toContain(
      "Track deferred CodeRabbit auth boundary fix"
    );
  });

  it("builds an action recommendation request with available destinations", () => {
    const request = buildTriageActionRecommendationRequest({
      clerkOrgId: "org_123",
      deploymentEnvironment: "development",
      sourceItem: githubIssue,
      classification: {
        schemaVersion: "triage.source-item-classification.v1",
        sourceSignal: {
          isUseful: true,
          rationale: "The issue describes duplicated work.",
        },
        title: "Avoid duplicate deferred work",
        summary: "The same fix has appeared in more than one review path.",
        workIntent: "planning",
        priority: "high",
        triageDecision: "link_existing",
        rationale: "Linking existing work avoids duplicate implementation.",
        confidence: 0.85,
      },
      similarity: {
        schemaVersion: "triage.similarity-rank.v1",
        candidates: [
          {
            candidateId: "github-issue-17",
            relation: "duplicate",
            rationale: "Same fix request.",
            confidence: 0.9,
          },
        ],
      },
      availableDestinations: ["github"],
      triageRunId: "triage_run_1",
    });

    expect(request.system).toContain("Lightfast triage action recommender");
    expect(request.prompt).toContain("availableDestinations");
    expect(request.prompt).toContain("link_existing");
  });
});
