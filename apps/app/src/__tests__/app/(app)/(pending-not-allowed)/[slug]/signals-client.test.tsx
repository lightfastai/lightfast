import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getQueryOptionsMock = vi.fn((input: unknown) => ({
  input,
  queryKey: ["org", "workspace", "signals", "get", input],
}));
const listQueryOptionsMock = vi.fn((input: unknown) => ({
  input,
  queryKey: ["org", "workspace", "signals", "list", input],
}));
const workingSetQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "workspace", "signals", "workingSet"],
}));
const orgMembersQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "settings", "orgMembers", "list"],
}));
const prefetchQueryMock = vi.fn();
const useQueryMock = vi.fn();

let dispositionState = "";
let kindState = "";
let peopleState = "all";
let priorityState = "";
let viewState = "list";
let signalState: string | null = null;

const setDispositionMock = vi.fn((value: string) => {
  dispositionState = value;
});
const setKindMock = vi.fn((value: string) => {
  kindState = value;
});
const setPeopleMock = vi.fn((value: string) => {
  peopleState = value;
});
const setPriorityMock = vi.fn((value: string) => {
  priorityState = value;
});
const setViewMock = vi.fn((value: string) => {
  viewState = value;
});
const setSignalMock = vi.fn((value: string | null) => {
  signalState = value;
});

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      settings: {
        orgMembers: { list: { queryOptions: orgMembersQueryOptionsMock } },
      },
      workspace: {
        signals: {
          get: { queryOptions: getQueryOptionsMock },
          list: { queryOptions: listQueryOptionsMock },
          workingSet: { queryOptions: workingSetQueryOptionsMock },
        },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  keepPreviousData: Symbol("keepPreviousData"),
  useQuery: (options: { queryKey: unknown[] }) => useQueryMock(options),
  useQueryClient: () => ({ prefetchQuery: prefetchQueryMock }),
}));

// Render every virtual item so row-presence assertions work in jsdom.
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({
    count,
    getItemKey,
  }: {
    count: number;
    getItemKey: (index: number) => string | number;
  }) => ({
    getTotalSize: () => count * 44,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        key: getItemKey(index),
        start: index * 44,
      })),
    measureElement: () => undefined,
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/lightfast/signals",
}));

const openCreateSignalMock = vi.fn();

vi.mock("~/components/workspace-command-menu", () => ({
  useWorkspaceCommands: () => ({ openCreateSignal: openCreateSignalMock }),
}));

vi.mock("@repo/ui/components/ui/sonner", () => ({
  toast: { success: vi.fn() },
}));

vi.mock("nuqs", () => ({
  parseAsString: { withDefault: () => "mock-string-parser" },
  parseAsStringLiteral: () => ({ withDefault: () => "mock-literal-parser" }),
  useQueryState: (key: string) => {
    if (key === "disposition") return [dispositionState, setDispositionMock];
    if (key === "kind") return [kindState, setKindMock];
    if (key === "people") return [peopleState, setPeopleMock];
    if (key === "priority") return [priorityState, setPriorityMock];
    if (key === "view") return [viewState, setViewMock];
    return [signalState, setSignalMock];
  },
}));

const baseClassification = {
  schemaVersion: "signal.classification.v1",
  confidence: 0.91,
  disposition: "actionable",
  rationale: "n/a",
  summary: "Summary text",
};

const followUpSignal = {
  classification: {
    ...baseClassification,
    kind: "follow_up",
    priority: "high",
    title: "Follow up on migration",
  },
  createdAt: new Date("2026-05-27T01:00:00.000Z"),
  createdByApiKeyId: "key_test",
  createdByUserId: "user_test",
  id: 7,
  publicId: "signal_follow_up",
  status: "classified",
};

const fixSignal = {
  classification: {
    ...baseClassification,
    kind: "fix",
    priority: "urgent",
    title: "Fix stale key fingerprint",
  },
  createdAt: new Date("2026-05-27T01:00:00.000Z"),
  createdByApiKeyId: "key_test",
  createdByUserId: "user_test",
  id: 8,
  publicId: "signal_fix",
  status: "classified",
};

const queuedSignal = {
  classification: null,
  createdAt: new Date("2026-05-27T01:00:00.000Z"),
  createdByApiKeyId: "key_test",
  createdByUserId: "user_test",
  errorCode: null,
  errorMessage: null,
  id: 9,
  input: "Customer asked for rollout timing",
  publicId: "signal_queued",
  status: "queued",
  updatedAt: new Date("2026-05-27T01:00:00.000Z"),
};

let workingSetData: {
  items: unknown[];
  totalCount: number;
  truncated: boolean;
};
let workingSetError = false;

function dispatchQuery(options: { queryKey: unknown[] }) {
  const root = options.queryKey[3];
  if (root === "workingSet") {
    return {
      data: workingSetData,
      isError: workingSetError,
      isFetching: false,
      refetch: vi.fn(),
    };
  }
  if (root === "list") {
    return {
      data: { items: [queuedSignal], nextCursor: null },
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    };
  }
  if (options.queryKey[1] === "settings") {
    return { data: { members: [] }, isError: false, isLoading: false };
  }
  // get
  return { data: undefined, isError: false, isLoading: false };
}

beforeEach(() => {
  dispositionState = "";
  kindState = "";
  peopleState = "all";
  priorityState = "";
  viewState = "list";
  signalState = null;
  workingSetData = {
    items: [followUpSignal, fixSignal],
    totalCount: 2,
    truncated: false,
  };
  workingSetError = false;
  vi.clearAllMocks();
  useQueryMock.mockImplementation(dispatchQuery);
  useSignalsUiStore.setState({ collapsedListGroups: {} });
});

const { SignalsClient } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-client"
);
const { useSignalsUiStore } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-ui-store"
);

describe("SignalsClient", () => {
  it("renders classified rows above the processing section", () => {
    render(<SignalsClient />);

    expect(screen.getByRole("heading", { name: "Signals" })).toBeInTheDocument();
    expect(screen.getByText("Follow up on migration")).toBeInTheDocument();
    expect(screen.getByText("Fix stale key fingerprint")).toBeInTheDocument();
    expect(screen.getByText("Customer asked for rollout timing")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Collapse Classified signals" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Collapse Processing signals" })
    ).toBeInTheDocument();
  });

  it("fetches the working set without any filters in the query input", () => {
    dispositionState = "actionable";
    kindState = "follow_up";

    render(<SignalsClient />);

    expect(workingSetQueryOptionsMock).toHaveBeenCalledTimes(1);
    expect(workingSetQueryOptionsMock).toHaveBeenCalledWith();
    expect(listQueryOptionsMock).toHaveBeenCalledWith({
      limit: 100,
      statuses: ["queued", "processing"],
    });
  });

  it("filters classified rows in memory by kind without refetching", () => {
    kindState = "fix";

    render(<SignalsClient />);

    expect(screen.queryByText("Follow up on migration")).not.toBeInTheDocument();
    expect(screen.getByText("Fix stale key fingerprint")).toBeInTheDocument();
    // Filters never enter the query key: still exactly one workingSet call.
    expect(workingSetQueryOptionsMock).toHaveBeenCalledTimes(1);
  });

  it("renders the truncation banner only when the window is clipped", () => {
    const { rerender } = render(<SignalsClient />);
    expect(
      screen.queryByTestId("signals-truncation-banner")
    ).not.toBeInTheDocument();

    workingSetData = { ...workingSetData, totalCount: 5000, truncated: true };
    rerender(<SignalsClient />);
    expect(screen.getByTestId("signals-truncation-banner")).toBeInTheDocument();
  });

  it("prefetches a signal body on row hover", () => {
    render(<SignalsClient />);

    fireEvent.mouseEnter(
      screen.getByRole("button", { name: /Follow up on migration/i })
    );

    expect(prefetchQueryMock).toHaveBeenCalledTimes(1);
    expect(getQueryOptionsMock).toHaveBeenCalledWith({ publicId: "signal_follow_up" });
  });

  it("selects a signal by setting the url param", () => {
    render(<SignalsClient />);

    fireEvent.click(
      screen.getByRole("button", { name: /Follow up on migration/i })
    );

    expect(setSignalMock).toHaveBeenCalledWith("signal_follow_up");
  });

  it("collapses and expands the classified group", () => {
    render(<SignalsClient />);

    fireEvent.click(
      screen.getByRole("button", { name: "Collapse Classified signals" })
    );
    expect(screen.queryByText("Follow up on migration")).not.toBeInTheDocument();
  });

  it("groups classified board cards by kind", () => {
    viewState = "board";

    render(<SignalsClient />);

    expect(
      screen.getByRole("region", { name: "Follow up board column" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Fix board column" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Processing board column" })
    ).toBeInTheDocument();
  });

  it("shows an empty state when the working set and processing are empty", () => {
    workingSetData = { items: [], totalCount: 0, truncated: false };
    useQueryMock.mockImplementation((options: { queryKey: unknown[] }) => {
      if (options.queryKey[3] === "list") {
        return {
          data: { items: [], nextCursor: null },
          isError: false,
          isFetching: false,
          refetch: vi.fn(),
        };
      }
      return dispatchQuery(options);
    });

    render(<SignalsClient />);

    expect(screen.getByText("No classified signals yet")).toBeInTheDocument();
  });

  it("shows a retry action when the working set errors", () => {
    workingSetError = true;

    render(<SignalsClient />);

    expect(
      screen.getByRole("button", { name: "Retry classified signals" })
    ).toBeInTheDocument();
  });

  it("keeps view state in the url", () => {
    render(<SignalsClient />);

    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Display options" })
    );
    fireEvent.click(screen.getByRole("menuitem", { name: /Board/ }));

    expect(setViewMock).toHaveBeenCalledWith("board");
  });
});
