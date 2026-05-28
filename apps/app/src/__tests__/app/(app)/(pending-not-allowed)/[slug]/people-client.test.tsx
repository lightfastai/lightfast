import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listQueryOptionsMock = vi.fn();
const useSuspenseQueryMock = vi.fn();
let queryState = "";
const setQueryMock = vi.fn((value: string) => {
  queryState = value;
});

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      workspace: {
        people: {
          list: {
            queryOptions: listQueryOptionsMock,
          },
        },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useSuspenseQuery: useSuspenseQueryMock,
}));

vi.mock("nuqs", () => ({
  parseAsString: {
    withDefault: () => "mock-parser",
  },
  useQueryState: () => [queryState, setQueryMock],
}));

const peopleRows = [
  {
    clerkOrgId: "org_test",
    createdAt: new Date("2026-05-27T01:00:00.000Z"),
    displayName: "Jeevan Pillay",
    firstSeenSignalId: "signal_first",
    id: 1,
    identityKey: "identity_key",
    identityProvider: "x",
    identityType: "handle",
    identityValue: "@jeevanp",
    lastSeenSignalId: "signal_last",
    metadata: {},
    normalizedIdentityValue: "jeevanp",
    publicId: "person_123e4567-e89b-12d3-a456-426614174000",
    seenCount: 3,
    updatedAt: new Date("2026-05-27T01:01:00.000Z"),
  },
];

beforeEach(() => {
  queryState = "";
  setQueryMock.mockClear();
  listQueryOptionsMock.mockReset();
  listQueryOptionsMock.mockImplementation((input: unknown) => ({
    input,
    queryKey: ["org", "workspace", "people", "list", input],
  }));
  useSuspenseQueryMock.mockReset();
  useSuspenseQueryMock.mockReturnValue({
    data: { items: peopleRows, nextCursor: null },
  });
});

const { PeopleClient } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-client"
);

describe("PeopleClient", () => {
  it("renders people directory rows", () => {
    render(<PeopleClient />);

    expect(screen.getByRole("heading", { name: "People" })).toBeInTheDocument();
    expect(screen.getByText("Jeevan Pillay")).toBeInTheDocument();
    expect(screen.getByText("@jeevanp")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("passes URL search to the server-backed query and renders no-results", () => {
    queryState = "missing";
    useSuspenseQueryMock.mockReturnValue({
      data: { items: [], nextCursor: null },
    });

    render(<PeopleClient />);

    expect(listQueryOptionsMock).toHaveBeenLastCalledWith({
      limit: 50,
      search: "missing",
    });
    expect(screen.getByText("No people found")).toBeInTheDocument();
  });

  it("renders an empty state", () => {
    useSuspenseQueryMock.mockReturnValue({
      data: { items: [], nextCursor: null },
    });

    render(<PeopleClient />);

    expect(screen.getByText("No people yet")).toBeInTheDocument();
  });
});
