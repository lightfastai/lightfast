import { SIGNAL_INPUT_MAX_LENGTH } from "@repo/api-contract";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createMutationOptionsMock = vi.fn((options: unknown) => options);
const getQueryOptionsMock = vi.fn(
  (input: unknown, opts: unknown) => ({
    input,
    opts,
    queryKey: ["org", "workspace", "signals", "get", input],
  })
);
const infiniteQueryOptionsMock = vi.fn();
const invalidateQueriesMock = vi.fn();
const mutateMock = vi.fn();
const toastSuccessMock = vi.fn();
const useInfiniteQueryMock = vi.fn();
const useMutationMock = vi.fn();
const useQueryMock = vi.fn(() => ({
  data: undefined,
  isError: false,
  isLoading: false,
}));

let queryState = "";
let dispositionState = "";
let kindState = "";
let peopleState = "";
let priorityState = "";
let viewState = "list";
let signalState: string | null = null;

const setQueryMock = vi.fn((value: string) => {
  queryState = value;
});
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
      workspace: {
        signals: {
          create: {
            mutationOptions: createMutationOptionsMock,
          },
          get: {
            queryOptions: getQueryOptionsMock,
          },
          list: {
            infiniteQueryOptions: infiniteQueryOptionsMock,
          },
        },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: useInfiniteQueryMock,
  useMutation: useMutationMock,
  useQuery: useQueryMock,
  useQueryClient: () => ({
    invalidateQueries: invalidateQueriesMock,
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/lightfast/signals",
}));

vi.mock("@repo/ui/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children?: ReactNode; open?: boolean }) =>
    open ? <div>{children}</div> : null,
  DialogClose: ({ children }: { children?: ReactNode }) => children,
  DialogContent: ({ children }: { children?: ReactNode }) => (
    <div role="dialog">{children}</div>
  ),
  DialogFooter: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children?: ReactNode }) => (
    <p>{children}</p>
  ),
  DialogHeader: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@repo/ui/components/ui/sonner", () => ({
  toast: {
    success: toastSuccessMock,
  },
}));

vi.mock("nuqs", () => ({
  parseAsString: {
    withDefault: () => "mock-string-parser",
  },
  parseAsStringLiteral: () => ({
    withDefault: () => "mock-literal-parser",
  }),
  useQueryState: (key: string) => {
    if (key === "disposition") {
      return [dispositionState, setDispositionMock];
    }
    if (key === "kind") {
      return [kindState, setKindMock];
    }
    if (key === "people") {
      return [peopleState, setPeopleMock];
    }
    if (key === "priority") {
      return [priorityState, setPriorityMock];
    }
    if (key === "view") {
      return [viewState, setViewMock];
    }
    if (key === "signal") {
      return [signalState, setSignalMock];
    }
    return [queryState, setQueryMock];
  },
}));

const baseSignal = {
  createdAt: new Date("2026-05-27T01:00:00.000Z"),
  clerkOrgId: "org_test",
  createdByApiKeyId: "key_test",
  createdByUserId: "user_test",
  errorCode: null,
  errorMessage: null,
  input: "Customer asked for migration help",
  status: "classified",
  updatedAt: new Date("2026-05-27T01:01:00.000Z"),
};

const followUpSignal = {
  ...baseSignal,
  classification: {
    schemaVersion: "signal.classification.v1",
    confidence: 0.91,
    disposition: "actionable",
    kind: "follow_up",
    nextAction: "Reply with the migration plan",
    priority: "high",
    rationale: "Customer asked for a migration update.",
    summary: "Customer asked for a migration update.",
    title: "Follow up on migration",
  },
  id: 7,
  publicId: "signal_follow_up",
};

const fixSignal = {
  ...baseSignal,
  classification: {
    schemaVersion: "signal.classification.v1",
    confidence: 0.95,
    disposition: "actionable",
    kind: "fix",
    nextAction: "Reproduce key rotation and inspect invalidation.",
    priority: "urgent",
    rationale: "Security-related dashboard state should update immediately.",
    summary: "Dashboard may be caching an old API key fingerprint.",
    title: "Fix stale key fingerprint",
  },
  id: 8,
  input: "Customer reported stale key fingerprint after rotation.",
  publicId: "signal_fix",
};

const queuedSignal = {
  ...baseSignal,
  classification: null,
  id: 9,
  input: "Customer asked for rollout timing",
  publicId: "signal_queued",
  status: "queued",
};

function makeInfiniteResult(overrides = {}) {
  return {
    data: {
      pages: [{ items: [followUpSignal, fixSignal], nextCursor: null }],
      pageParams: [null],
    },
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isError: false,
    isFetching: false,
    isFetchingNextPage: false,
    refetch: vi.fn(),
    ...overrides,
  };
}

function makeInfiniteResultForInput(input: {
  status?: string;
  statuses?: string[];
}) {
  if (input.statuses?.includes("queued")) {
    return makeInfiniteResult({
      data: {
        pages: [{ items: [queuedSignal], nextCursor: null }],
        pageParams: [null],
      },
    });
  }

  return makeInfiniteResult();
}

beforeEach(() => {
  sessionStorage.clear();
  queryState = "";
  dispositionState = "";
  kindState = "";
  peopleState = "";
  priorityState = "";
  viewState = "list";
  signalState = null;
  createMutationOptionsMock.mockClear();
  getQueryOptionsMock.mockClear();
  useQueryMock.mockClear();
  invalidateQueriesMock.mockReset();
  mutateMock.mockReset();
  setDispositionMock.mockClear();
  setKindMock.mockClear();
  setPeopleMock.mockClear();
  setPriorityMock.mockClear();
  setQueryMock.mockClear();
  setViewMock.mockClear();
  setSignalMock.mockClear();
  infiniteQueryOptionsMock.mockReset();
  infiniteQueryOptionsMock.mockImplementation(
    (input: unknown, opts: unknown) => ({
      input,
      opts,
      queryKey: ["org", "workspace", "signals", "list", input, "infinite"],
    })
  );
  useInfiniteQueryMock.mockReset();
  useInfiniteQueryMock.mockImplementation((options: { input: unknown }) =>
    makeInfiniteResultForInput(
      options.input as { status?: string; statuses?: string[] }
    )
  );
  toastSuccessMock.mockReset();
  useMutationMock.mockReset();
  useMutationMock.mockImplementation(
    (options: {
      onSuccess?: (data: { id: string; status: "queued" }) => void;
    }) => ({
      isPending: false,
      mutate: (variables: { input: string }) => {
        mutateMock(variables);
        options.onSuccess?.({
          id: "signal_323e4567-e89b-12d3-a456-426614174000",
          status: "queued",
        });
      },
    })
  );
  useSignalsUiStore.setState({
    collapsedListGroups: {},
  });
});

const { SignalsClient } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-client"
);
const { useSignalsUiStore } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-ui-store"
);

describe("SignalsClient", () => {
  it("renders inline create controls without a top-level toolbar create button", () => {
    render(<SignalsClient />);

    expect(
      screen.queryByRole("button", { name: "New signal" })
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Search signals")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add classified signal" })
    ).toBeInTheDocument();
  });

  it("opens and closes the create signal dialog", () => {
    render(<SignalsClient />);

    fireEvent.click(
      screen.getByRole("button", { name: "Add classified signal" })
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Create Signal" })
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Add one raw signal. Lightfast will classify it after submission."
      )
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create signal" })
    ).toBeInTheDocument();
    expect(screen.queryByText("Close")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("blocks blank signal submission", () => {
    render(<SignalsClient />);
    fireEvent.click(
      screen.getByRole("button", { name: "Add classified signal" })
    );

    fireEvent.submit(screen.getByRole("form", { name: "Create signal" }));

    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("caps pasted signal input at the contract limit", () => {
    render(<SignalsClient />);
    fireEvent.click(
      screen.getByRole("button", { name: "Add classified signal" })
    );

    const oversizedInput = "a".repeat(SIGNAL_INPUT_MAX_LENGTH + 250);
    fireEvent.change(screen.getByLabelText("Signal input"), {
      target: { value: oversizedInput },
    });

    expect(screen.getByLabelText("Signal input")).toHaveValue(
      "a".repeat(SIGNAL_INPUT_MAX_LENGTH)
    );
    expect(screen.getByText("Limit reached")).toBeInTheDocument();
  });

  it("keeps the multiline composer constrained inside the dialog", () => {
    render(<SignalsClient />);
    fireEvent.click(
      screen.getByRole("button", { name: "Add classified signal" })
    );

    const input = screen.getByLabelText("Signal input");

    expect(input).toHaveAttribute("maxlength", String(SIGNAL_INPUT_MAX_LENGTH));
    expect(input).toHaveClass("overflow-y-auto");
    expect(input).toHaveClass("break-words");
  });

  it("restores a session draft when the dialog opens", () => {
    sessionStorage.setItem(
      "lightfast:create-signal-draft:/lightfast/signals",
      "Recovered customer note"
    );

    render(<SignalsClient />);
    fireEvent.click(
      screen.getByRole("button", { name: "Add classified signal" })
    );

    expect(screen.getByLabelText("Signal input")).toHaveValue(
      "Recovered customer note"
    );
  });

  it("normalizes pasted line endings without collapsing multiline input", () => {
    render(<SignalsClient />);
    fireEvent.click(
      screen.getByRole("button", { name: "Add classified signal" })
    );

    fireEvent.change(screen.getByLabelText("Signal input"), {
      target: { value: "First line\r\n\r\nSecond line\rThird line" },
    });

    expect(screen.getByLabelText("Signal input")).toHaveValue(
      "First line\n\nSecond line\nThird line"
    );
  });

  it("explains whitespace-only input without submitting", () => {
    render(<SignalsClient />);
    fireEvent.click(
      screen.getByRole("button", { name: "Add classified signal" })
    );

    fireEvent.change(screen.getByLabelText("Signal input"), {
      target: { value: "\n\n   " },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Create signal" }));

    expect(screen.getByText("Add signal text")).toBeInTheDocument();
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("submits with Enter and keeps Shift+Enter as a newline gesture", () => {
    render(<SignalsClient />);
    fireEvent.click(
      screen.getByRole("button", { name: "Add classified signal" })
    );

    fireEvent.change(screen.getByLabelText("Signal input"), {
      target: { value: "Customer needs a response" },
    });
    fireEvent.keyDown(screen.getByLabelText("Signal input"), {
      key: "Enter",
      shiftKey: true,
    });
    expect(mutateMock).not.toHaveBeenCalled();

    fireEvent.keyDown(screen.getByLabelText("Signal input"), {
      key: "Enter",
    });

    expect(mutateMock).toHaveBeenCalledWith({
      input: "Customer needs a response",
    });
  });

  it("locks composer controls while a signal is being created", () => {
    useMutationMock.mockImplementation(() => ({
      isPending: true,
      mutate: mutateMock,
    }));

    render(<SignalsClient />);
    fireEvent.click(
      screen.getByRole("button", { name: "Add classified signal" })
    );

    expect(screen.getByLabelText("Signal input")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Creating" })).toBeDisabled();
  });

  it("submits a valid signal and refreshes processing and classified lists", () => {
    render(<SignalsClient />);
    fireEvent.click(
      screen.getByRole("button", { name: "Add classified signal" })
    );

    fireEvent.change(screen.getByLabelText("Signal input"), {
      target: { value: "  Customer asked for rollout timing  " },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Create signal" }));

    expect(mutateMock).toHaveBeenCalledWith({
      input: "Customer asked for rollout timing",
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: [
        "org",
        "workspace",
        "signals",
        "list",
        {
          dispositions: undefined,
          kinds: undefined,
          limit: 50,
          peopleRouted: undefined,
          priorities: undefined,
          search: undefined,
          status: "classified",
        },
        "infinite",
      ],
      exact: true,
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: [
        "org",
        "workspace",
        "signals",
        "list",
        {
          limit: 50,
          search: undefined,
          statuses: ["queued", "processing"],
        },
        "infinite",
      ],
      exact: true,
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Signal queued", {
      description: "Classification will start shortly.",
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("preserves input when the create mutation does not succeed", () => {
    useMutationMock.mockImplementation(() => ({
      isPending: false,
      mutate: (variables: { input: string }) => {
        mutateMock(variables);
      },
    }));

    render(<SignalsClient />);
    fireEvent.click(
      screen.getByRole("button", { name: "Add classified signal" })
    );

    fireEvent.change(screen.getByLabelText("Signal input"), {
      target: { value: "Keep this input" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Create signal" }));

    expect(screen.getByLabelText("Signal input")).toHaveValue(
      "Keep this input"
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("renders processing signals below the classified signal list", () => {
    render(<SignalsClient />);

    expect(
      screen.getByRole("heading", { name: "Signals" })
    ).toBeInTheDocument();
    const classifiedHeading = screen.getByRole("button", {
      name: "Collapse Classified signals",
    });
    const processingHeading = screen.getByRole("button", {
      name: "Collapse Processing signals",
    });

    expect(classifiedHeading.compareDocumentPosition(processingHeading)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(
      screen.queryByRole("button", { name: "Failed" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("Follow up on migration")).toBeInTheDocument();
    expect(screen.getByText("Fix stale key fingerprint")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /Customer asked for rollout timing/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Queued")).toBeInTheDocument();
  });

  it("queries classified signals with filters and processing signals without classification filters", () => {
    dispositionState = "actionable";
    kindState = "follow_up,fix";
    peopleState = "routed";
    priorityState = "urgent,high";

    render(<SignalsClient />);

    expect(infiniteQueryOptionsMock).toHaveBeenCalledTimes(2);
    expect(infiniteQueryOptionsMock).toHaveBeenCalledWith(
      {
        dispositions: ["actionable"],
        kinds: ["follow_up", "fix"],
        limit: 50,
        peopleRouted: true,
        priorities: ["urgent", "high"],
        search: undefined,
        status: "classified",
      },
      expect.objectContaining({ staleTime: 30_000 })
    );
    expect(infiniteQueryOptionsMock).toHaveBeenCalledWith(
      {
        limit: 50,
        search: undefined,
        statuses: ["queued", "processing"],
      },
      expect.objectContaining({ staleTime: 5000 })
    );
  });

  it("opens a Linear-style nested filter menu", async () => {
    render(<SignalsClient />);

    fireEvent.pointerDown(screen.getByRole("button", { name: "Filters" }));

    expect(
      screen.queryByRole("menuitemcheckbox", { name: "Follow up" })
    ).not.toBeInTheDocument();

    fireEvent.pointerMove(screen.getByRole("menuitem", { name: /Kind/ }), {
      pointerType: "mouse",
    });

    expect(
      await screen.findByRole("menuitemcheckbox", { name: "Follow up" })
    ).toBeInTheDocument();

    fireEvent.pointerMove(screen.getByRole("menuitem", { name: /Priority/ }), {
      pointerType: "mouse",
    });

    expect(
      screen.queryByRole("menuitemcheckbox", { name: "Follow up" })
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole("menuitemcheckbox", { name: "High" })
    ).toBeInTheDocument();
  });

  it("uses hover-open filter submenus when updating classification filters", async () => {
    render(<SignalsClient />);

    fireEvent.pointerDown(screen.getByRole("button", { name: "Filters" }));
    fireEvent.pointerMove(screen.getByRole("menuitem", { name: /Kind/ }), {
      pointerType: "mouse",
    });
    fireEvent.click(
      await screen.findByRole("menuitemcheckbox", { name: "Follow up" })
    );
    fireEvent.pointerMove(screen.getByRole("menuitem", { name: /Priority/ }), {
      pointerType: "mouse",
    });
    fireEvent.click(
      await screen.findByRole("menuitemcheckbox", { name: "High" })
    );

    expect(setKindMock).toHaveBeenCalledWith("follow_up");
    expect(setPriorityMock).toHaveBeenCalledWith("high");
  });

  it("renders toolbar controls with explicit visual affordances", () => {
    render(<SignalsClient />);

    expect(screen.getByTestId("signals-toolbar")).toHaveClass("px-3");

    const filterButton = screen.getByRole("button", { name: "Filters" });
    const displayButton = screen.getByRole("button", {
      name: "Display options",
    });

    expect(filterButton).not.toHaveTextContent("Filters");
    expect(displayButton).not.toHaveTextContent("Display");
    expect(filterButton).toHaveClass("size-6");
    expect(displayButton).toHaveClass("size-6");
    expect(screen.getByTestId("signals-filter-icon")).toBeInTheDocument();
    expect(screen.getByTestId("signals-filter-icon")).toHaveClass("size-3");
    expect(screen.queryByTestId("signals-new-icon")).not.toBeInTheDocument();
    expect(screen.queryByTestId("signals-search-icon")).not.toBeInTheDocument();
    expect(screen.getByTestId("signals-display-icon")).toBeInTheDocument();
    expect(screen.getByTestId("signals-display-icon")).toHaveClass("size-3");
  });

  it("renders section actions as icon-backed controls", () => {
    render(<SignalsClient />);

    expect(
      screen.getAllByTestId("signals-list-section-toggle-icon").length
    ).toBe(2);
    expect(screen.getAllByTestId("signals-list-section-add-icon").length).toBe(
      2
    );
  });

  it("renders retry actions with icons", () => {
    const retryMock = vi.fn();
    useInfiniteQueryMock.mockReturnValue(
      makeInfiniteResult({ isError: true, refetch: retryMock })
    );

    render(<SignalsClient />);

    expect(
      screen.getAllByTestId("signals-list-section-retry-icon").length
    ).toBe(2);
  });

  it("renders active filters as segmented any-of chips", () => {
    kindState = "follow_up,fix";
    peopleState = "routed";
    priorityState = "high";

    render(<SignalsClient />);

    expect(
      screen.getByRole("button", { name: /Kind is any of 2 values/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Priority is any of High/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /People routing is any of Routed/ })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Disposition is any of/ })
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Kind is any of 2 values/ })
    );

    expect(setKindMock).toHaveBeenCalledWith("");
  });

  it("updates classification filter state from the toolbar", async () => {
    render(<SignalsClient />);

    fireEvent.pointerDown(screen.getByRole("button", { name: "Filters" }));
    fireEvent.pointerMove(screen.getByRole("menuitem", { name: /Kind/ }), {
      pointerType: "mouse",
    });
    fireEvent.click(
      await screen.findByRole("menuitemcheckbox", { name: "Follow up" })
    );
    fireEvent.pointerMove(screen.getByRole("menuitem", { name: /Priority/ }), {
      pointerType: "mouse",
    });
    fireEvent.click(
      await screen.findByRole("menuitemcheckbox", { name: "High" })
    );

    expect(setKindMock).toHaveBeenCalledWith("follow_up");
    expect(setPriorityMock).toHaveBeenCalledWith("high");
  });

  it("keeps display view in URL state", () => {
    render(<SignalsClient />);

    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Display options" })
    );
    fireEvent.click(screen.getByRole("menuitem", { name: /Board/ }));

    expect(setViewMock).toHaveBeenCalledWith("board");
  });

  it("collapses and expands the classified signal group", () => {
    render(<SignalsClient />);

    fireEvent.click(
      screen.getByRole("button", { name: "Collapse Classified signals" })
    );

    expect(
      screen.queryByText("Follow up on migration")
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Expand Classified signals" })
    );

    expect(screen.getByText("Follow up on migration")).toBeInTheDocument();
  });

  it("loads more classified signals from the list view", () => {
    const fetchNextPageMock = vi.fn();
    useInfiniteQueryMock.mockReturnValue(
      makeInfiniteResult({
        fetchNextPage: fetchNextPageMock,
        hasNextPage: true,
      })
    );

    render(<SignalsClient />);

    fireEvent.click(
      screen.getByRole("button", { name: "Load more classified signals" })
    );

    expect(fetchNextPageMock).toHaveBeenCalledTimes(1);
  });

  it("shows an inline retry action for the classified query", () => {
    const retryMock = vi.fn();
    useInfiniteQueryMock.mockReturnValue(
      makeInfiniteResult({ isError: true, refetch: retryMock })
    );

    render(<SignalsClient />);

    fireEvent.click(
      screen.getByRole("button", { name: "Retry classified signals" })
    );

    expect(retryMock).toHaveBeenCalledTimes(1);
  });

  it("groups classified board cards by signal kind", () => {
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
    expect(screen.getByText("Follow up on migration")).toBeInTheDocument();
    expect(screen.getByText("Fix stale key fingerprint")).toBeInTheDocument();
    expect(
      screen.getByText("Customer asked for rollout timing")
    ).toBeInTheDocument();
  });

  it("renders an empty state when the classified cache is empty", () => {
    useInfiniteQueryMock.mockReturnValue(
      makeInfiniteResult({
        data: { pages: [{ items: [], nextCursor: null }], pageParams: [null] },
      })
    );

    render(<SignalsClient />);

    expect(screen.getByText("No classified signals yet")).toBeInTheDocument();
  });

  it("sets the signal url param when a signal row is selected", () => {
    render(<SignalsClient />);

    fireEvent.click(
      screen.getByRole("button", { name: /Follow up on migration/i })
    );

    expect(setSignalMock).toHaveBeenCalledWith("signal_follow_up");
  });

  it("opens the detail sheet from an initial signal url param", () => {
    signalState = "signal_follow_up";

    render(<SignalsClient />);

    // Next action only renders in the detail sheet body, never in the list row.
    expect(
      screen.getByText("Reply with the migration plan")
    ).toBeInTheDocument();
  });

  it("clears the signal url param when the detail sheet is closed", () => {
    signalState = "signal_follow_up";

    render(<SignalsClient />);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(setSignalMock).toHaveBeenCalledWith(null);
  });

  it("copies the signal link from the detail sheet", () => {
    signalState = "signal_follow_up";

    render(<SignalsClient />);

    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

    expect(toastSuccessMock).toHaveBeenCalledWith(
      "Link copied",
      expect.objectContaining({ description: expect.any(String) })
    );
  });
});
