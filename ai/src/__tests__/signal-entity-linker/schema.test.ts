import { describe, expect, it } from "vitest";

import {
  SIGNAL_ENTITY_LINKS_SCHEMA_VERSION,
  signalEntityLinkCandidateModelSchema,
  signalEntityLinkCandidateSchema,
  signalEntityLinkingModelSchema,
  signalEntityLinkingSchema,
} from "../../signal-entity-linker";

describe("signal entity linker schemas", () => {
  it("accepts an AI-extracted person name candidate", () => {
    expect(
      signalEntityLinkCandidateSchema.parse({
        targetType: "person",
        localEntityKey: "person_1",
        label: "Jordi Torras",
        mentionKind: "name",
        anchorText: "Jordi Torras",
        anchorOccurrence: 1,
        extractionMethod: "ai",
        rationale: "The text names Jordi as the person being discussed.",
        confidence: 0.74,
      })
    ).toEqual({
      targetType: "person",
      localEntityKey: "person_1",
      label: "Jordi Torras",
      mentionKind: "name",
      anchorText: "Jordi Torras",
      anchorOccurrence: 1,
      extractionMethod: "ai",
      rationale: "The text names Jordi as the person being discussed.",
      confidence: 0.74,
    });
  });

  it("accepts deterministic email candidates and resolves the schema version", () => {
    expect(
      signalEntityLinkingSchema.parse({
        schemaVersion: SIGNAL_ENTITY_LINKS_SCHEMA_VERSION,
        candidates: [
          {
            targetType: "person",
            localEntityKey: "person_2",
            label: "jordi@example.com",
            mentionKind: "email",
            anchorText: "jordi@example.com",
            anchorOccurrence: 1,
            extractionMethod: "deterministic",
            rationale: "The email address identifies a person entity.",
            confidence: 1,
          },
        ],
      })
    ).toEqual({
      schemaVersion: "signal.entity-links.v1",
      candidates: [
        {
          targetType: "person",
          localEntityKey: "person_2",
          label: "jordi@example.com",
          mentionKind: "email",
          anchorText: "jordi@example.com",
          anchorOccurrence: 1,
          extractionMethod: "deterministic",
          rationale: "The email address identifies a person entity.",
          confidence: 1,
        },
      ],
    });
  });

  it("accepts model-facing candidates without extractionMethod or schemaVersion", () => {
    expect(
      signalEntityLinkCandidateModelSchema.parse({
        targetType: "person",
        localEntityKey: "person_3",
        label: "@jordi",
        mentionKind: "handle",
        anchorText: "@jordi",
        anchorOccurrence: 2,
        rationale: "The handle appears near the person mention.",
        confidence: 0.82,
      })
    ).toEqual({
      targetType: "person",
      localEntityKey: "person_3",
      label: "@jordi",
      mentionKind: "handle",
      anchorText: "@jordi",
      anchorOccurrence: 2,
      rationale: "The handle appears near the person mention.",
      confidence: 0.82,
    });

    expect(
      signalEntityLinkingModelSchema.parse({
        candidates: [
          {
            targetType: "person",
            localEntityKey: "person_4",
            label: "https://linkedin.com/in/jordi",
            mentionKind: "profile_url",
            anchorText: "https://linkedin.com/in/jordi",
            anchorOccurrence: 1,
            rationale: "The profile URL identifies a person.",
            confidence: 0.88,
          },
        ],
      })
    ).toEqual({
      candidates: [
        {
          targetType: "person",
          localEntityKey: "person_4",
          label: "https://linkedin.com/in/jordi",
          mentionKind: "profile_url",
          anchorText: "https://linkedin.com/in/jordi",
          anchorOccurrence: 1,
          rationale: "The profile URL identifies a person.",
          confidence: 0.88,
        },
      ],
    });
  });

  it("rejects unsupported target types and invalid local entity keys", () => {
    const validCandidate = {
      targetType: "person",
      localEntityKey: "person_1",
      label: "Jordi Torras",
      mentionKind: "name",
      anchorText: "Jordi Torras",
      anchorOccurrence: 1,
      extractionMethod: "ai",
      rationale: "The text names Jordi as the person being discussed.",
      confidence: 0.74,
    };

    expect(() =>
      signalEntityLinkCandidateSchema.parse({
        ...validCandidate,
        targetType: "project",
      })
    ).toThrow();

    expect(() =>
      signalEntityLinkCandidateSchema.parse({
        ...validCandidate,
        localEntityKey: "jordi",
      })
    ).toThrow();
  });
});
