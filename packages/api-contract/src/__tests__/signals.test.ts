import { describe, expect, it } from "vitest";

import {
  createSignalInput,
  signalClassificationSchema,
  signalIdSchema,
} from "../schemas/signals";

describe("signal schemas", () => {
  it("trims and accepts non-empty signal input", () => {
    expect(
      createSignalInput.parse({ input: "  Run the PR test plan  " })
    ).toEqual({ input: "Run the PR test plan" });
  });

  it("rejects empty signal input", () => {
    expect(() => createSignalInput.parse({ input: "   " })).toThrow();
  });

  it("rejects signal input over 4000 characters", () => {
    expect(() =>
      createSignalInput.parse({ input: "a".repeat(4001) })
    ).toThrow();
  });

  it("accepts generated signal ids", () => {
    expect(
      signalIdSchema.parse("sig_123e4567-e89b-12d3-a456-426614174000")
    ).toBe("sig_123e4567-e89b-12d3-a456-426614174000");
  });

  it("validates signal classification v1", () => {
    expect(
      signalClassificationSchema.parse({
        schemaVersion: "signal.classification.v1",
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
      schemaVersion: "signal.classification.v1",
      kind: "review",
    });
  });

  it("accepts a signal classification routing hint for people classification", () => {
    expect(
      signalClassificationSchema.parse({
        schemaVersion: "signal.classification.v1",
        disposition: "actionable",
        title: "Talk to Jeevan",
        summary: "The signal mentions an X profile worth engaging.",
        kind: "engage",
        nextAction: "Review the profile and decide whether to reply.",
        priority: "normal",
        rationale: "The input contains a durable social identity.",
        confidence: 0.86,
        routing: {
          classifyPeople: {
            shouldRun: true,
            rationale: "The input includes https://x.com/jeevanp.",
          },
        },
      })
    ).toMatchObject({
      routing: {
        classifyPeople: {
          shouldRun: true,
        },
      },
    });
  });

  it("rejects an empty people routing rationale", () => {
    expect(() =>
      signalClassificationSchema.parse({
        schemaVersion: "signal.classification.v1",
        disposition: "actionable",
        title: "Talk to Jeevan",
        summary: "The signal mentions an X profile worth engaging.",
        kind: "engage",
        nextAction: "Review the profile and decide whether to reply.",
        priority: "normal",
        rationale: "The input contains a durable social identity.",
        confidence: 0.86,
        routing: {
          classifyPeople: {
            shouldRun: true,
            rationale: "   ",
          },
        },
      })
    ).toThrow();
  });
});
