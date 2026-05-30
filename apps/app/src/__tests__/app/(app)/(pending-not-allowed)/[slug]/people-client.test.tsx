import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useInfiniteQueryMock = vi.fn();
const infiniteQueryOptionsMock = vi.fn((input: unknown) => ({
  input,
  queryKey: ["org", "workspace", "people", "list", input],
}));
const getQueryOptionsMock = vi.fn();

const queryStates: Record<string, string | null> = {
  provider: "",
  type: "",
  person: null,
};
const setProvider = vi.fn();
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

vi.mock("nuqs", () => ({
  parseAsString: { withDefault: () => "parser" },
  useQueryState: (key: string) => {
    const setters: Record<string, (value: string | null) => void> = {
      provider: setProvider,
      type: setType,
      person: setPerson,
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
  metadata: {},
  normalizedIdentityValue: "jeevanp",
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
  queryStates.provider = "";
  queryStates.type = "";
  queryStates.person = null;
  setProvider.mockClear();
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
});
