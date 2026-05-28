import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listQueryOptionsMock = vi.fn();
const useSuspenseQueryMock = vi.fn();
const queryOptions = {
  queryKey: ["org", "workspace", "signals", "list", { limit: 50 }],
};
let queryState = "";
let statusState = "all";
const setQueryMock = vi.fn((value: string) => {
  queryState = value;
});
const setStatusMock = vi.fn((value: string) => {
  statusState = value;
});

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      workspace: {
        signals: {
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
  parseAsStringLiteral: () => ({
    withDefault: () => "mock-status-parser",
  }),
  useQueryState: (key: string) =>
    key === "status"
      ? [statusState, setStatusMock]
      : [queryState, setQueryMock],
}));

const signalRows = [
  {
    classification: {
      schemaVersion: "signal.classification.v1",
      confidence: 0.91,
      disposition: "actionable",
      kind: "follow_up",
      nextAction: "Reply",
      priority: "high",
      rationale: "Customer asked for a migration update.",
      summary: "Customer asked for a migration update.",
      title: "Follow up on migration",
    },
    createdAt: new Date("2026-05-27T01:00:00.000Z"),
    clerkOrgId: "org_test",
    createdByApiKeyId: "key_test",
    createdByUserId: "user_test",
    errorCode: null,
    errorMessage: null,
    id: 7,
    input: "Customer asked for migration help",
    publicId: "signal_123e4567-e89b-12d3-a456-426614174000",
    status: "classified",
    updatedAt: new Date("2026-05-27T01:01:00.000Z"),
  },
  {
    classification: null,
    createdAt: new Date("2026-05-27T02:00:00.000Z"),
    clerkOrgId: "org_test",
    createdByApiKeyId: "key_test",
    createdByUserId: "user_test",
    errorCode: "CLASSIFICATION_PROVIDER_ERROR",
    errorMessage: "Gateway failed",
    id: 8,
    input: "Investigate failed provider call",
    publicId: "signal_223e4567-e89b-12d3-a456-426614174000",
    status: "failed",
    updatedAt: new Date("2026-05-27T02:01:00.000Z"),
  },
];

beforeEach(() => {
  queryState = "";
  statusState = "all";
  setQueryMock.mockClear();
  setStatusMock.mockClear();
  listQueryOptionsMock.mockReset();
  listQueryOptionsMock.mockImplementation((input: unknown) => ({
    ...queryOptions,
    input,
  }));
  useSuspenseQueryMock.mockReset();
  useSuspenseQueryMock.mockReturnValue({
    data: { items: signalRows, nextCursor: null },
  });
});

const { SignalsClient } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-client"
);

describe("SignalsClient", () => {
  it("renders classified and failed signal rows", () => {
    render(<SignalsClient />);

    expect(
      screen.getByRole("heading", { name: "Signals" })
    ).toBeInTheDocument();
    expect(screen.getByText("Follow up on migration")).toBeInTheDocument();
    expect(
      screen.getByText("Customer asked for a migration update.")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/CLASSIFICATION_PROVIDER_ERROR/)
    ).toBeInTheDocument();
  });

  it("updates URL status state from the status tab", () => {
    render(<SignalsClient />);

    fireEvent.click(screen.getByRole("button", { name: "Failed" }));

    expect(setStatusMock).toHaveBeenCalledWith("failed");
  });

  it("passes URL search and status to the server-backed query", () => {
    queryState = "migration";
    statusState = "failed";

    render(<SignalsClient />);

    expect(listQueryOptionsMock).toHaveBeenLastCalledWith({
      limit: 50,
      search: "migration",
      status: "failed",
    });
  });

  it("renders an empty state", () => {
    useSuspenseQueryMock.mockReturnValue({
      data: { items: [], nextCursor: null },
    });

    render(<SignalsClient />);

    expect(screen.getByText("No signals yet")).toBeInTheDocument();
  });
});
