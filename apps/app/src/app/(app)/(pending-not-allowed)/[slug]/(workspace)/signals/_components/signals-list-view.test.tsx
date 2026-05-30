import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SignalsListView } from "./signals-list-view";
import type { SignalListItem, SignalSection } from "./signals-model";

// Render a fixed 5-item window starting at index 0 regardless of count.
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({
    count,
    getItemKey,
  }: {
    count: number;
    getItemKey: (index: number) => string | number;
  }) => {
    const windowSize = Math.min(count, 5);
    return {
      getTotalSize: () => count * 44,
      getVirtualItems: () =>
        Array.from({ length: windowSize }, (_, index) => ({
          index,
          key: getItemKey(index),
          start: index * 44,
        })),
      measureElement: () => undefined,
    };
  },
}));

vi.mock("./signals-creator-avatar", () => ({
  SignalCreatorAvatar: () => <span data-testid="avatar" />,
}));

function row(id: number): SignalListItem {
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
      title: `Signal ${id}`,
    },
    createdAt: new Date("2026-05-27T01:00:00.000Z"),
    createdByApiKeyId: null,
    createdByUserId: "user_test",
    id,
    publicId: `signal_${id}`,
    status: "classified",
  } as SignalListItem;
}

function section(rows: SignalListItem[]): SignalSection {
  return {
    id: "classified",
    isError: false,
    isFetching: false,
    label: "Classified",
    refetch: vi.fn(),
    rows,
  };
}

describe("SignalsListView virtualization", () => {
  it("renders only the windowed rows and selects on click", () => {
    const rows = Array.from({ length: 50 }, (_, index) => row(index + 1));
    const onSelectSignal = vi.fn();

    render(
      <SignalsListView
        collapsedGroups={{}}
        emptyAction={null}
        hasActiveSearch={false}
        hasAnyRows={true}
        onPrefetchSignal={vi.fn()}
        onSelectSignal={onSelectSignal}
        onToggleGroup={vi.fn()}
        sections={[section(rows)]}
        selectedSignalId={null}
      />
    );

    // The flattened window is [header, row#1..row#4]; deep rows are not in DOM.
    expect(screen.getByText("Signal 1")).toBeInTheDocument();
    expect(screen.queryByText("Signal 40")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Signal 1/i }));
    expect(onSelectSignal).toHaveBeenCalledWith("signal_1");
  });

  it("prefetches on row hover", () => {
    const onPrefetchSignal = vi.fn();
    render(
      <SignalsListView
        collapsedGroups={{}}
        emptyAction={null}
        hasActiveSearch={false}
        hasAnyRows={true}
        onPrefetchSignal={onPrefetchSignal}
        onSelectSignal={vi.fn()}
        onToggleGroup={vi.fn()}
        sections={[section([row(1)])]}
        selectedSignalId={null}
      />
    );

    fireEvent.mouseEnter(screen.getByRole("button", { name: /Signal 1/i }));
    expect(onPrefetchSignal).toHaveBeenCalledWith("signal_1");
  });
});
