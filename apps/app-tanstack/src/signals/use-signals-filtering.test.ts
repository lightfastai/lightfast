// @vitest-environment happy-dom

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type {
  SignalClassificationFilters,
  SignalListItem,
} from "./signals-model";
import { useSignalsFiltering } from "./use-signals-filtering";

const NO_FILTERS: SignalClassificationFilters = {
  dispositions: [],
  kinds: [],
  peopleRouted: false,
  priorities: [],
};

function row(overrides: Partial<SignalListItem>): SignalListItem {
  return {
    classification: {
      schemaVersion: "signal.classification.v2",
      confidence: 0.9,
      disposition: "actionable",
      kind: "follow_up",
      priority: "high",
      routing: {
        review: { required: false, reason: null, rationale: null },
        routes: {
          people: {
            confidence: 0.8,
            rationale: "No people routing is needed.",
            shouldRun: false,
          },
        },
        visibility: {
          rationale: "This is shared customer work.",
          scope: "team",
        },
      },
      summary: "s",
      title: "t",
    },
    createdAt: new Date("2026-05-27T01:00:00.000Z"),
    createdByApiKeyId: null,
    createdByUserId: "user_test",
    id: 1,
    publicId: "p1",
    status: "classified",
    ...overrides,
  } as SignalListItem;
}

describe("useSignalsFiltering", () => {
  it("filters + sorts classified rows and groups them by kind", () => {
    const classifiedRows = [
      row({ id: 1, publicId: "a" }),
      row({
        classification: { ...row({}).classification!, kind: "fix" },
        id: 2,
        publicId: "b",
      }),
    ];
    const processingRows = [
      row({
        classification: null,
        id: 9,
        inputPreview: "raw",
        publicId: "proc",
      }),
    ];

    const { result } = renderHook(() =>
      useSignalsFiltering({
        classifiedRows,
        filters: { ...NO_FILTERS, kinds: ["follow_up"] },
        processingRows,
      })
    );

    expect(result.current.classified.map((r) => r.publicId)).toEqual(["a"]);
    expect(result.current.byKind.get("follow_up")?.length).toBe(1);
    expect(result.current.byKind.get("fix")).toBeUndefined();
    expect(result.current.processing.map((r) => r.publicId)).toEqual(["proc"]);
  });

  it("keeps a stable reference when inputs are unchanged", () => {
    const classifiedRows = [row({ id: 1, publicId: "a" })];
    const processingRows: SignalListItem[] = [];
    const filters = NO_FILTERS;

    const { result, rerender } = renderHook(
      (props: {
        classifiedRows: SignalListItem[];
        filters: SignalClassificationFilters;
        processingRows: SignalListItem[];
      }) => useSignalsFiltering(props),
      { initialProps: { classifiedRows, filters, processingRows } }
    );
    const first = result.current.classified;
    rerender({ classifiedRows, filters, processingRows });
    expect(result.current.classified).toBe(first);
  });
});
