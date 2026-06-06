import { describe, expect, it } from "vitest";

import type { SignalEntityLinkCandidate } from "../../signal-entity-linker";
import {
  extractDeterministicSignalEntityLinks,
  mergeSignalEntityLinkCandidates,
} from "../../signal-entity-linker";

describe("signal entity linker extraction", () => {
  it("extracts deterministic email candidates", () => {
    expect(
      extractDeterministicSignalEntityLinks({
        input: "Email Jordi at jordi@doccy.com.au.",
      })
    ).toEqual([
      {
        targetType: "person",
        localEntityKey: "person_1",
        label: "jordi@doccy.com.au",
        mentionKind: "email",
        anchorText: "jordi@doccy.com.au",
        anchorOccurrence: 1,
        extractionMethod: "deterministic",
        rationale: "Email address matched deterministic extractor.",
        confidence: 1,
      },
    ]);
  });

  it("extracts recognized person profile URLs", () => {
    const candidates = extractDeterministicSignalEntityLinks({
      input:
        "Review https://www.linkedin.com/in/JordiExample and https://x.com/archer.",
    });

    expect(candidates).toHaveLength(2);
    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetType: "person",
          localEntityKey: "person_1",
          label: "https://www.linkedin.com/in/JordiExample",
          mentionKind: "profile_url",
        }),
        expect.objectContaining({
          targetType: "person",
          localEntityKey: "person_2",
          label: "https://x.com/archer",
          mentionKind: "profile_url",
        }),
      ])
    );
  });

  it("extracts provider-obvious handles without treating emails as handles", () => {
    const candidates = extractDeterministicSignalEntityLinks({
      input: "DM @jordi but do not split jordi@doccy.com.au.",
    });

    expect(candidates).toHaveLength(2);
    expect(candidates.filter((candidate) => candidate.mentionKind === "email"))
      .toEqual([
        expect.objectContaining({
          label: "jordi@doccy.com.au",
          anchorText: "jordi@doccy.com.au",
        }),
      ]);
    expect(candidates.filter((candidate) => candidate.mentionKind === "handle"))
      .toEqual([
        expect.objectContaining({
          label: "@jordi",
          anchorText: "@jordi",
        }),
      ]);
  });

  it("keeps deterministic candidates first, filters invalid anchors, and dedupes", () => {
    const input = "Email Jordi at jordi@doccy.com.au.";
    const deterministicCandidates = extractDeterministicSignalEntityLinks({
      input,
    });
    const jordiCandidate: SignalEntityLinkCandidate = {
      targetType: "person",
      localEntityKey: "person_2",
      label: "Jordi",
      mentionKind: "name",
      anchorText: "Jordi",
      anchorOccurrence: 1,
      extractionMethod: "ai",
      rationale: "The text names Jordi as a person.",
      confidence: 0.8,
    };
    const ghostCandidate: SignalEntityLinkCandidate = {
      targetType: "person",
      localEntityKey: "person_3",
      label: "Ghost",
      mentionKind: "name",
      anchorText: "Ghost",
      anchorOccurrence: 1,
      extractionMethod: "ai",
      rationale: "The model inferred a person not anchored in the text.",
      confidence: 0.8,
    };

    expect(
      mergeSignalEntityLinkCandidates({
        input,
        deterministicCandidates,
        aiCandidates: [
          jordiCandidate,
          ghostCandidate,
          deterministicCandidates[0],
        ],
      })
    ).toEqual([deterministicCandidates[0], jordiCandidate]);
  });
});
