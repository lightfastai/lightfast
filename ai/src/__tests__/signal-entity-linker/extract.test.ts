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
        "Review https://www.linkedin.com/in/JordiExample, https://github.com/jordi, https://x.com/archer, and https://twitter.com/jordi.",
    });

    expect(candidates).toHaveLength(4);
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
          label: "https://github.com/jordi",
          mentionKind: "profile_url",
        }),
        expect.objectContaining({
          targetType: "person",
          localEntityKey: "person_3",
          label: "https://x.com/archer",
          mentionKind: "profile_url",
        }),
        expect.objectContaining({
          targetType: "person",
          localEntityKey: "person_4",
          label: "https://twitter.com/jordi",
          mentionKind: "profile_url",
        }),
      ])
    );
  });

  it("strips trailing bracket and parenthesis punctuation from profile URLs", () => {
    const candidates = extractDeterministicSignalEntityLinks({
      input: "Review [https://github.com/jordi] and (https://x.com/archer).",
    });

    expect(candidates).toEqual([
      expect.objectContaining({
        label: "https://github.com/jordi",
        anchorText: "https://github.com/jordi",
      }),
      expect.objectContaining({
        label: "https://x.com/archer",
        anchorText: "https://x.com/archer",
      }),
    ]);
  });

  it("extracts provider-obvious handles without treating emails as handles", () => {
    const candidates = extractDeterministicSignalEntityLinks({
      input: "DM @jordi but do not split jordi@doccy.com.au.",
    });

    expect(candidates).toHaveLength(2);
    expect(
      candidates.filter((candidate) => candidate.mentionKind === "email")
    ).toEqual([
      expect.objectContaining({
        label: "jordi@doccy.com.au",
        anchorText: "jordi@doccy.com.au",
      }),
    ]);
    expect(
      candidates.filter((candidate) => candidate.mentionKind === "handle")
    ).toEqual([
      expect.objectContaining({
        label: "@jordi",
        anchorText: "@jordi",
      }),
    ]);
  });

  it("caps deterministic candidates at ten by input position", () => {
    const input = Array.from(
      { length: 12 },
      (_, index) => `person${index + 1}@doccy.com`
    ).join(" ");

    const candidates = extractDeterministicSignalEntityLinks({ input });

    expect(candidates).toHaveLength(10);
    expect(candidates.map((candidate) => candidate.localEntityKey)).toEqual([
      "person_1",
      "person_2",
      "person_3",
      "person_4",
      "person_5",
      "person_6",
      "person_7",
      "person_8",
      "person_9",
      "person_10",
    ]);
    expect(candidates.at(-1)).toEqual(
      expect.objectContaining({
        label: "person10@doccy.com",
        anchorText: "person10@doccy.com",
      })
    );
  });

  it("rejects repository, reserved social routes, and handles inside unsupported URLs", () => {
    expect(
      extractDeterministicSignalEntityLinks({
        input:
          "Skip https://github.com/org/repo, https://x.com/i/status/123, https://x.com/explore, https://twitter.com/search, https://twitter.com/settings, and https://example.com/@jordi.",
      })
    ).toEqual([]);
  });

  it("keeps deterministic candidates first, filters invalid anchors, and dedupes", () => {
    const input = "Email Jordi at jordi@doccy.com.au.";
    const deterministicCandidates = extractDeterministicSignalEntityLinks({
      input,
    });
    const jordiCandidate: SignalEntityLinkCandidate = {
      targetType: "person",
      localEntityKey: "person_1",
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
    ).toEqual([
      deterministicCandidates[0],
      {
        ...jordiCandidate,
        localEntityKey: "person_2",
      },
    ]);
  });

  it("caps merged candidates at ten", () => {
    const deterministicInput = Array.from(
      { length: 8 },
      (_, index) => `person${index + 1}@doccy.com`
    ).join(" ");
    const aiInput = Array.from(
      { length: 5 },
      (_, index) => `Name${index + 1}`
    ).join(" ");
    const input = `${deterministicInput} ${aiInput}`;
    const deterministicCandidates = extractDeterministicSignalEntityLinks({
      input,
    });
    const aiCandidates: SignalEntityLinkCandidate[] = Array.from(
      { length: 5 },
      (_, index) => ({
        targetType: "person",
        localEntityKey: `person_${index + 9}`,
        label: `Name${index + 1}`,
        mentionKind: "name",
        anchorText: `Name${index + 1}`,
        anchorOccurrence: 1,
        extractionMethod: "ai",
        rationale: "The text names a person.",
        confidence: 0.8,
      })
    );

    const mergedCandidates = mergeSignalEntityLinkCandidates({
      input,
      deterministicCandidates,
      aiCandidates,
    });

    expect(mergedCandidates).toHaveLength(10);
    expect(mergedCandidates.slice(0, 8)).toEqual(deterministicCandidates);
    expect(mergedCandidates.at(-1)).toEqual(aiCandidates[1]);
    expect(
      mergedCandidates.map((candidate) => candidate.localEntityKey)
    ).toEqual([
      "person_1",
      "person_2",
      "person_3",
      "person_4",
      "person_5",
      "person_6",
      "person_7",
      "person_8",
      "person_9",
      "person_10",
    ]);
  });
});
