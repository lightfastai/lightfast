import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useInfiniteQueryMock = vi.fn();
const infiniteQueryOptionsMock = vi.fn((input: unknown) => ({
  input,
  queryKey: ["org", "workspace", "decisions", "list", input],
}));

const queryStates: Record<string, string | null> = {
  q: "",
  provider: "",
  status: "",
  decision: null,
};
const setQuery = vi.fn((value: string | null) => {
  queryStates.q = value;
});
const setProvider = vi.fn();
const setStatus = vi.fn();
const setDecision = vi.fn();

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      workspace: {
        decisions: {
          list: { infiniteQueryOptions: infiniteQueryOptionsMock },
        },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: () => useInfiniteQueryMock(),
}));

vi.mock("@vendor/lib/time", () => ({
  formatRelativeTimeToNow: () => "just now",
  formatDuration: () => "547ms",
  formatUtcCalendarDate: () => "2 Jun 2026",
}));

// CodeBlock pulls in Shiki (async highlight) — stub it to a <pre> so we can
// still assert the serialized JSON is rendered.
vi.mock("@repo/ui/components/ai-elements/code-block", () => ({
  CodeBlock: ({ code }: { code: string }) => <pre>{code}</pre>,
  CodeBlockActions: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CodeBlockCopyButton: () => <button type="button">copy</button>,
  CodeBlockHeader: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CodeBlockTitle: ({ children }: { children?: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));

vi.mock("@repo/ui/components/ssr-code-block", () => ({
  SSRCodeBlockCopyButton: () => <button type="button">copy</button>,
}));

vi.mock("@vercel/microfrontends/next/client", () => ({
  Link: ({
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("nuqs", () => ({
  parseAsString: {
    withDefault: () => "parser",
  },
  useQueryState: (key: string) => {
    const setters: Record<string, (value: string | null) => void> = {
      q: setQuery,
      provider: setProvider,
      status: setStatus,
      decision: setDecision,
    };
    return [queryStates[key] ?? null, setters[key] ?? vi.fn()];
  },
}));

const baseDecision = {
  id: 1,
  publicId: "provider_routine_call_123",
  clerkOrgId: "org_acme",
  calledByKind: "automation",
  calledById: "run_123",
  calledByUserId: null,
  provider: "linear",
  routineId: "linear__create_issue",
  providerToolName: "create_issue",
  providerConnectionId: 42,
  providerWorkspaceId: "workspace_123",
  providerActorId: "actor_123",
  providerAttempted: true,
  sourceClientId: null,
  sourceRef: "run_123",
  sourceSurface: "automation",
  status: "succeeded",
  inputRedacted: { tool: "create_issue" },
  outputRedacted: null,
  errorCode: null,
  errorMessage: null,
  startedAt: new Date("2026-06-02T03:20:11.419Z"),
  finishedAt: new Date("2026-06-02T03:20:11.966Z"),
  createdAt: new Date("2026-06-02T03:20:11.419Z"),
  updatedAt: new Date("2026-06-02T03:20:11.966Z"),
};

function mockRows(items: unknown[]) {
  useInfiniteQueryMock.mockReturnValue({
    data: { pages: [{ items, nextCursor: null }] },
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isError: false,
    isFetching: false,
    isFetchingNextPage: false,
    isPlaceholderData: false,
    refetch: vi.fn(),
  });
}

beforeEach(() => {
  // Pin "now" well after the fixtures so day-grouping treats them as
  // historical (neither Today nor Yesterday) and uses the mocked
  // formatUtcCalendarDate label deterministically, regardless of run date.
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-01T12:00:00.000Z"));
  queryStates.q = "";
  queryStates.provider = "";
  queryStates.status = "";
  queryStates.decision = null;
  setQuery.mockClear();
  setProvider.mockClear();
  setStatus.mockClear();
  setDecision.mockClear();
  infiniteQueryOptionsMock.mockClear();
  mockRows([baseDecision]);
});

afterEach(() => {
  vi.useRealTimers();
});

const { DecisionsClient } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/decisions/_components/decisions-client"
);

describe("DecisionsClient", () => {
  it("renders a decision row grouped under a day header", () => {
    render(<DecisionsClient />);

    expect(screen.getByText("2 Jun 2026")).toBeInTheDocument();
    expect(screen.getByText("Linear / create_issue")).toBeInTheDocument();
    expect(screen.getByText("Automation run_123")).toBeInTheDocument();
    expect(screen.getByText("Succeeded")).toBeInTheDocument();
    expect(screen.getByText("Automation")).toBeInTheDocument();
  });

  it("toggles the decision URL param when a row is clicked", () => {
    render(<DecisionsClient />);

    // The Radix filter trigger also reports aria-expanded=false, so target the
    // row button unambiguously by its action text.
    fireEvent.click(screen.getByRole("button", { name: /create_issue/i }));

    expect(setDecision).toHaveBeenCalledWith("provider_routine_call_123");
  });

  it("renders the inline detail with the full error message and JSON payload", () => {
    queryStates.decision = "provider_routine_call_failed";
    mockRows([
      {
        ...baseDecision,
        publicId: "provider_routine_call_failed",
        status: "failed",
        inputRedacted: { tool: "create_issue" },
        errorCode: "LINEAR_MCP_FAILED",
        errorMessage: "raw provider error is now shown",
      },
    ]);

    render(<DecisionsClient />);

    expect(
      screen.getByText("provider_routine_call_failed")
    ).toBeInTheDocument();
    expect(screen.getByText("linear__create_issue")).toBeInTheDocument();
    expect(screen.getByText("LINEAR_MCP_FAILED")).toBeInTheDocument();
    expect(
      screen.getByText("raw provider error is now shown")
    ).toBeInTheDocument();
    // JSON inspector renders the serialized input payload.
    expect(screen.getByText(/"tool": "create_issue"/)).toBeInTheDocument();
  });

  it("renders the empty state with no rows and no filters", () => {
    mockRows([]);
    render(<DecisionsClient />);
    expect(screen.getByText("No decisions yet")).toBeInTheDocument();
  });

  it("renders the no-results state when a filter excludes everything", () => {
    queryStates.status = "failed";
    mockRows([]);
    render(<DecisionsClient />);
    expect(screen.getByText("No matching decisions")).toBeInTheDocument();
  });

  it("passes deferred search text into the decisions list query", () => {
    queryStates.q = " create_issue ";

    render(<DecisionsClient />);

    expect(infiniteQueryOptionsMock).toHaveBeenCalledWith(
      {
        limit: 50,
        providers: undefined,
        search: "create_issue",
        statuses: undefined,
      },
      expect.anything()
    );
  });

  it("writes search input changes to the q param", () => {
    render(<DecisionsClient />);

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search decisions" }),
      { target: { value: "linear" } }
    );

    expect(setQuery).toHaveBeenCalledWith("linear");
  });
});
