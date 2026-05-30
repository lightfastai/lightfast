import { describe, expect, it } from "vitest";
import {
  adaptProcessingRow,
  compareSignalsByRecency,
  filterClassifiedSignals,
  formatSignalConfidence,
  getSignalSource,
  getSignalSummary,
  getSignalTitle,
  groupSignalsByKind,
  signalMatchesFilters,
  type SignalClassificationFilters,
  type SignalListItem,
  type SignalRow,
} from "./signals-model";

const NO_FILTERS: SignalClassificationFilters = {
  dispositions: [],
  kinds: [],
  peopleRouted: false,
  priorities: [],
};

function classified(overrides: Partial<SignalListItem> = {}): SignalListItem {
  return {
    classification: {
      schemaVersion: "signal.classification.v1",
      confidence: 0.9,
      disposition: "actionable",
      kind: "follow_up",
      priority: "high",
      summary: "Summary text",
      title: "Title text",
    },
    createdAt: new Date("2026-05-27T01:00:00.000Z"),
    createdByApiKeyId: "key_test",
    createdByUserId: "user_test",
    id: 1,
    publicId: "signal_1",
    status: "classified",
    ...overrides,
  } as SignalListItem;
}

describe("formatSignalConfidence", () => {
  it("renders a 0..1 confidence as a rounded percentage", () => {
    expect(formatSignalConfidence(0.912)).toBe("91%");
    expect(formatSignalConfidence(0)).toBe("0%");
    expect(formatSignalConfidence(1)).toBe("100%");
  });
});

describe("getSignalSource", () => {
  it("labels API-key vs user creators", () => {
    expect(getSignalSource(classified({ createdByApiKeyId: "key_1" }))).toEqual({
      isApiKey: true,
      label: "API key",
    });
    expect(getSignalSource(classified({ createdByApiKeyId: null }))).toEqual({
      isApiKey: false,
      label: "User",
    });
  });
});

describe("getSignalTitle / getSignalSummary", () => {
  it("prefers the classification, then inputPreview, then identifier", () => {
    expect(getSignalTitle(classified())).toBe("Title text");
    const processing = classified({
      classification: null,
      id: 9,
      inputPreview: "Raw input",
    });
    expect(getSignalTitle(processing)).toBe("Raw input");
    expect(getSignalSummary(processing)).toBe("Raw input");
    const bare = classified({ classification: null, id: 5, inputPreview: undefined });
    expect(getSignalTitle(bare)).toBe("SIG-5");
    expect(getSignalSummary(bare)).toBe("");
  });
});

describe("signalMatchesFilters", () => {
  it("keeps a row when its classification is in every selected set", () => {
    const row = classified();
    expect(signalMatchesFilters(row, NO_FILTERS)).toBe(true);
    expect(
      signalMatchesFilters(row, { ...NO_FILTERS, kinds: ["follow_up"] })
    ).toBe(true);
    expect(signalMatchesFilters(row, { ...NO_FILTERS, kinds: ["fix"] })).toBe(
      false
    );
    expect(
      signalMatchesFilters(row, { ...NO_FILTERS, priorities: ["high"] })
    ).toBe(true);
    expect(
      signalMatchesFilters(row, { ...NO_FILTERS, dispositions: ["not_actionable"] })
    ).toBe(false);
  });

  it("applies peopleRouted via routing.classifyPeople.shouldRun", () => {
    const routed = classified({
      classification: {
        ...classified().classification!,
        routing: { classifyPeople: { shouldRun: true } },
      },
    });
    expect(signalMatchesFilters(routed, { ...NO_FILTERS, peopleRouted: true })).toBe(
      true
    );
    expect(
      signalMatchesFilters(classified(), { ...NO_FILTERS, peopleRouted: true })
    ).toBe(false);
  });

  it("never matches an unclassified row", () => {
    expect(
      signalMatchesFilters(classified({ classification: null }), NO_FILTERS)
    ).toBe(false);
  });
});

describe("filterClassifiedSignals", () => {
  it("filters then sorts newest-first by createdAt then id, without mutating input", () => {
    const older = classified({
      createdAt: new Date("2026-05-25T00:00:00.000Z"),
      id: 1,
      publicId: "signal_old",
    });
    const newerLowId = classified({
      createdAt: new Date("2026-05-27T00:00:00.000Z"),
      id: 2,
      publicId: "signal_a",
    });
    const newerHighId = classified({
      createdAt: new Date("2026-05-27T00:00:00.000Z"),
      id: 3,
      publicId: "signal_b",
    });
    const input = [older, newerLowId, newerHighId];

    const result = filterClassifiedSignals(input, NO_FILTERS);

    expect(result.map((row) => row.publicId)).toEqual([
      "signal_b",
      "signal_a",
      "signal_old",
    ]);
    expect(input.map((row) => row.publicId)).toEqual([
      "signal_old",
      "signal_a",
      "signal_b",
    ]);
  });
});

describe("groupSignalsByKind", () => {
  it("buckets rows by classification kind, skipping unclassified", () => {
    const grouped = groupSignalsByKind([
      classified({ id: 1, publicId: "a" }),
      classified({
        classification: { ...classified().classification!, kind: "fix" },
        id: 2,
        publicId: "b",
      }),
      classified({ classification: null, id: 3, publicId: "c" }),
    ]);
    expect(grouped.get("follow_up")?.map((r) => r.publicId)).toEqual(["a"]);
    expect(grouped.get("fix")?.map((r) => r.publicId)).toEqual(["b"]);
  });
});

describe("adaptProcessingRow", () => {
  it("maps a full processing row to a SignalListItem with a 200-char preview", () => {
    const full = {
      classification: null,
      createdAt: new Date("2026-05-27T01:00:00.000Z"),
      createdByApiKeyId: null,
      createdByUserId: "user_test",
      errorCode: null,
      errorMessage: null,
      id: 9,
      input: "x".repeat(500),
      publicId: "signal_proc",
      status: "queued",
      updatedAt: new Date("2026-05-27T01:00:00.000Z"),
    } as SignalRow;

    const adapted = adaptProcessingRow(full);

    expect(adapted.classification).toBeNull();
    expect(adapted.inputPreview).toHaveLength(200);
    expect("input" in adapted).toBe(false);
    expect(adapted.publicId).toBe("signal_proc");
  });
});

describe("compareSignalsByRecency", () => {
  it("orders newest createdAt first, breaking ties by higher id", () => {
    const a = classified({ createdAt: new Date(2), id: 1 });
    const b = classified({ createdAt: new Date(1), id: 2 });
    const c = classified({ createdAt: new Date(2), id: 5 });
    expect([b, a, c].sort(compareSignalsByRecency).map((r) => r.id)).toEqual([
      5, 1, 2,
    ]);
  });
});
