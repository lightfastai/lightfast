import { describe, expect, it } from "vitest";

import {
  TRIAGE_ACTION_RECOMMENDER_SYSTEM_PROMPT,
  TRIAGE_SIMILARITY_SYSTEM_PROMPT,
  TRIAGE_SOURCE_CLASSIFIER_SYSTEM_PROMPT,
} from "../../triage/prompt";

describe("triage prompts", () => {
  it("defines work intents that are easy to confuse in dogfood planning", () => {
    expect(TRIAGE_SOURCE_CLASSIFIER_SYSTEM_PROMPT).toContain(
      "Work intent rules:"
    );
    expect(TRIAGE_SOURCE_CLASSIFIER_SYSTEM_PROMPT).toContain(
      "planning: architecture, product strategy, primitive design"
    );
    expect(TRIAGE_SOURCE_CLASSIFIER_SYSTEM_PROMPT).toContain(
      "question: vague or exploratory ask"
    );
    expect(TRIAGE_SOURCE_CLASSIFIER_SYSTEM_PROMPT).toContain(
      "documentation: docs, copy, README"
    );
  });

  it("protects opportunity and duplicate decisions from becoming generic tasks", () => {
    expect(TRIAGE_SOURCE_CLASSIFIER_SYSTEM_PROMPT).toContain(
      "Do not collapse strategic product direction into create_task"
    );
    expect(TRIAGE_ACTION_RECOMMENDER_SYSTEM_PROMPT).toContain(
      "If similarity contains a duplicate"
    );
  });

  it("teaches duplicate versus related with dev-lifecycle examples", () => {
    expect(TRIAGE_SIMILARITY_SYSTEM_PROMPT).toContain("Duplicate examples:");
    expect(TRIAGE_SIMILARITY_SYSTEM_PROMPT).toContain(
      "Settings page shows GitHub disconnected after setup complete"
    );
    expect(TRIAGE_SIMILARITY_SYSTEM_PROMPT).toContain(
      "Collect more GitHub issue fixtures for the triage eval"
    );
    expect(TRIAGE_SIMILARITY_SYSTEM_PROMPT).toContain("Related examples:");
    expect(TRIAGE_SIMILARITY_SYSTEM_PROMPT).toContain(
      "same product area but different underlying work"
    );
  });
});
