import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useInfiniteQueryMock = vi.fn();
const infiniteQueryOptionsMock = vi.fn((input: unknown) => ({
  input,
  queryKey: ["org", "workspace", "people", "list", input],
}));
const getQueryOptionsMock = vi.fn();

const queryStates: Record<string, string | null> = {
  memberStatus: "",
  peopleQuery: "",
  person: null,
  provider: "",
  source: "",
  type: "",
};
const setQuery = vi.fn((value: string | null) => {
  queryStates.peopleQuery = value;
});
const setProvider = vi.fn();
const setSource = vi.fn();
const setMemberStatus = vi.fn();
const setType = vi.fn();
const setPerson = vi.fn();

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      workspace: {
        people: {
          list: { infiniteQueryOptions: infiniteQueryOptionsMock },
          get: { queryOptions: getQueryOptionsMock },
        },
        signals: {
          get: {
            queryOptions: vi.fn(() => ({ queryKey: ["signals", "get"] })),
          },
        },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: () => useInfiniteQueryMock(),
  useQuery: () => ({ data: undefined, isError: false }),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ slug: "lightfast" }),
}));

// The empty/no-results states render a @vercel/microfrontends <Link>, which
// needs a microfrontends config absent under test. Render a plain anchor.
vi.mock("@vercel/microfrontends/next/client", () => ({
  Link: ({
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("nuqs", () => ({
  parseAsString: { withDefault: () => "parser" },
  useQueryState: (key: string) => {
    const setters: Record<string, (value: string | null) => void> = {
      memberStatus: setMemberStatus,
      peopleQuery: setQuery,
      person: setPerson,
      provider: setProvider,
      source: setSource,
      type: setType,
    };
    return [queryStates[key] ?? null, setters[key] ?? vi.fn()];
  },
}));

const personRow = {
  clerkOrgId: "org_test",
  createdAt: new Date("2026-05-27T01:00:00.000Z"),
  displayName: "Jeevan Pillay",
  firstSeenSignalId: "signal_first",
  id: 1,
  identityKey: "identity_key",
  identityProvider: "x",
  identityType: "handle",
  identityValue: "@jeevanp",
  lastSeenSignalId: "signal_3f9a0000-0000-0000-0000-000000000000",
  clerkUserId: null,
  memberRole: null,
  memberStatus: null,
  memberSyncedAt: null,
  metadata: {},
  normalizedIdentityValue: "jeevanp",
  personSource: "signal",
  publicId: "person_123e4567-e89b-12d3-a456-426614174000",
  seenCount: 3,
  updatedAt: new Date("2026-05-27T01:01:00.000Z"),
};

function mockRows(items: unknown[]) {
  useInfiniteQueryMock.mockReturnValue({
    data: { pages: [{ items, nextCursor: null }] },
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isError: false,
    isFetching: false,
    isFetchingNextPage: false,
    refetch: vi.fn(),
  });
}

beforeEach(() => {
  queryStates.memberStatus = "";
  queryStates.peopleQuery = "";
  queryStates.provider = "";
  queryStates.source = "";
  queryStates.type = "";
  queryStates.person = null;
  setMemberStatus.mockClear();
  setQuery.mockClear();
  setProvider.mockClear();
  setSource.mockClear();
  setType.mockClear();
  setPerson.mockClear();
  infiniteQueryOptionsMock.mockClear();
  mockRows([personRow]);
});

const { PeopleClient } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-client"
);

describe("PeopleClient", () => {
  it("renders people rows with identity and a signal ref", () => {
    render(<PeopleClient />);

    expect(screen.getByText("Jeevan Pillay")).toBeInTheDocument();
    expect(screen.getByText("@jeevanp")).toBeInTheDocument();
    expect(screen.getByText("Handle")).toBeInTheDocument();
    expect(screen.getByText("SIG-3F9A")).toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("renders the empty state when there are no people and no filters", () => {
    mockRows([]);
    render(<PeopleClient />);
    expect(screen.getByText("No people yet")).toBeInTheDocument();
  });

  it("renders the no-results state when filters exclude all people", () => {
    queryStates.provider = "email";
    mockRows([]);
    render(<PeopleClient />);
    expect(screen.getByText("No matching people")).toBeInTheDocument();
  });

  it("passes deferred search text into the people list query", () => {
    queryStates.peopleQuery = " jeevan ";

    render(<PeopleClient />);

    expect(infiniteQueryOptionsMock).toHaveBeenCalledWith(
      {
        limit: 50,
        memberStatuses: undefined,
        providers: undefined,
        search: "jeevan",
        sources: undefined,
        types: undefined,
      },
      expect.anything()
    );
  });

  it("writes search input changes to the people query param", () => {
    render(<PeopleClient />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Search people" }), {
      target: { value: "alice" },
    });

    expect(setQuery).toHaveBeenCalledWith("alice");
  });

  it("renders the no-results state when search excludes all people", () => {
    queryStates.peopleQuery = "missing";
    mockRows([]);

    render(<PeopleClient />);

    expect(screen.getByText("No matching people")).toBeInTheDocument();
  });

  it("passes source and member status filters into the people list query", () => {
    queryStates.source = "team_member,mixed";
    queryStates.memberStatus = "active";

    render(<PeopleClient />);

    expect(infiniteQueryOptionsMock).toHaveBeenCalledWith(
      {
        limit: 50,
        memberStatuses: ["active"],
        providers: undefined,
        search: undefined,
        sources: ["team_member", "mixed"],
        types: undefined,
      },
      expect.anything()
    );
  });

  it("renders team member badges in rows", () => {
    mockRows([
      {
        ...personRow,
        memberStatus: "active",
        personSource: "mixed",
      },
    ]);

    render(<PeopleClient />);

    expect(screen.getByText("Team member")).toBeInTheDocument();
  });

  it("renders former team member badges in rows", () => {
    mockRows([
      {
        ...personRow,
        memberStatus: "former",
        personSource: "team_member",
      },
    ]);

    render(<PeopleClient />);

    expect(screen.getByText("Former team member")).toBeInTheDocument();
  });
});
