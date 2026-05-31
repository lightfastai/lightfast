import { z } from "zod";
import { describe, expect, it } from "vitest";

import {
  triageActionRecommendationModelSchema,
  triageActionRecommendationSchema,
  triageSimilarityRankSchema,
  triageSourceItemClassificationSchema,
} from "../../triage/schema";

describe("triage schemas", () => {
  it("parses a source item classification with provisional triage labels", () => {
    const classification = triageSourceItemClassificationSchema.parse({
      schemaVersion: "triage.source-item-classification.v1",
      sourceSignal: {
        isUseful: true,
        rationale: "The issue describes repeated implementation friction.",
      },
      title: "Consolidate duplicate issue triage",
      summary:
        "A GitHub issue points at duplicated work that should be linked before implementation.",
      workIntent: "planning",
      priority: "high",
      triageDecision: "link_existing",
      suggestedOwner: {
        kind: "team",
        name: "Product",
        rationale: "The issue affects roadmap prioritization.",
      },
      rationale: "The issue is actionable but should be linked first.",
      confidence: 0.83,
    });

    expect(classification.triageDecision).toBe("link_existing");
    expect(classification.suggestedOwner?.kind).toBe("team");
  });

  it("parses ranked similarity candidates", () => {
    const rank = triageSimilarityRankSchema.parse({
      schemaVersion: "triage.similarity-rank.v1",
      candidates: [
        {
          candidateId: "github-issue-41",
          relation: "duplicate",
          rationale: "Both issues describe the same stale setup gate bug.",
          confidence: 0.91,
        },
        {
          candidateId: "linear-eng-17",
          relation: "related",
          rationale: "This is nearby planning work but not identical.",
          confidence: 0.62,
        },
      ],
    });

    expect(rank.candidates[0]?.relation).toBe("duplicate");
    expect(rank.candidates[1]?.candidateId).toBe("linear-eng-17");
  });

  it("parses an action recommendation with human approval required", () => {
    const recommendation = triageActionRecommendationSchema.parse({
      schemaVersion: "triage.action-recommendation.v1",
      triageDecision: "create_task",
      rationale: "The source issue describes committed execution work.",
      confidence: 0.78,
      actions: [
        {
          type: "create_task",
          label: "Create a task from this GitHub issue",
          requiresHumanApproval: true,
          rationale: "Day one triage should not write automatically.",
        },
      ],
    });

    expect(recommendation.actions).toHaveLength(1);
    expect(recommendation.actions[0]?.requiresHumanApproval).toBe(true);
  });

  it("keeps the model action payload schema compatible with AI Gateway structured output", () => {
    const jsonSchema = z.toJSONSchema(triageActionRecommendationModelSchema);

    expect(JSON.stringify(jsonSchema)).not.toContain("propertyNames");
    expect(JSON.stringify(jsonSchema)).not.toContain('"format":"uri"');
    expect(
      triageActionRecommendationModelSchema.parse({
        triageDecision: "link_existing",
        rationale: "A high-confidence duplicate exists.",
        confidence: 0.91,
        actions: [
          {
            type: "link_existing",
            label: "Link to the existing GitHub issue",
            requiresHumanApproval: true,
            rationale: "The source item duplicates known work.",
            payload: {
              candidateId: "github-issue-32",
              destination: "github",
              externalId: null,
              externalUrl: null,
              commentBody: null,
            },
          },
        ],
      })
    ).toEqual(
      expect.objectContaining({
        triageDecision: "link_existing",
      })
    );
  });
});
