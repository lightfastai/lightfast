import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const accountGetQueryOptionsMock = vi.fn(() => ({
  queryKey: ["viewer", "account", "get"],
}));
const githubAccountStatusQueryOptionsMock = vi.fn(() => ({
  queryKey: ["viewer", "githubAccount", "status"],
}));
const updateNameMutationOptionsMock = vi.fn((options: unknown) => options);
const useSuspenseQueryMock = vi.fn();

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    viewer: {
      account: {
        get: {
          queryOptions: accountGetQueryOptionsMock,
        },
        updateName: {
          mutationOptions: updateNameMutationOptionsMock,
        },
      },
      githubAccount: {
        status: {
          queryOptions: githubAccountStatusQueryOptionsMock,
        },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: (options: unknown) => ({
    isPending: false,
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    options,
  }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
  }),
  useSuspenseQuery: useSuspenseQueryMock,
}));

vi.mock("@repo/ui/components/ui/sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const { ProfileDataDisplay } = await import(
  "~/app/(app)/(pending-allowed)/account/settings/general/_components/profile-data-display"
);

function profile(overrides: Record<string, unknown> = {}) {
  return {
    createdAt: "2026-06-01T00:00:00.000Z",
    firstName: "Ada",
    fullName: "Ada Lovelace",
    id: "user_123",
    imageUrl: "https://img.example.com/user.png",
    initials: "AL",
    lastName: "Lovelace",
    primaryEmailAddress: "ada@example.com",
    username: "ada-dev",
    ...overrides,
  };
}

beforeEach(() => {
  accountGetQueryOptionsMock.mockClear();
  githubAccountStatusQueryOptionsMock.mockClear();
  updateNameMutationOptionsMock.mockClear();
  useSuspenseQueryMock.mockReset();
});

function mockProfileQuery(data: ReturnType<typeof profile>) {
  useSuspenseQueryMock.mockImplementation((options: { queryKey: unknown }) => {
    const serializedQueryKey = JSON.stringify(options.queryKey);

    if (serializedQueryKey.includes("githubAccount")) {
      return { data: { account: null } };
    }

    return { data };
  });
}

describe("ProfileDataDisplay", () => {
  it("renders the account profile fields", () => {
    mockProfileQuery(profile());

    render(<ProfileDataDisplay />);

    expect(screen.getByLabelText("Display name")).toHaveValue("Ada Lovelace");
    expect(screen.getByLabelText("Username")).toHaveValue("ada-dev");
    expect(screen.getByLabelText("Email")).toHaveValue("ada@example.com");
  });

  it("renders the username as a locked field with no editing action", () => {
    mockProfileQuery(profile());

    render(<ProfileDataDisplay />);

    expect(screen.getByLabelText("Username")).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Create username" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Username created" })
    ).not.toBeInTheDocument();
  });

  it("shows an empty username field when none is set", () => {
    mockProfileQuery(profile({ username: null }));

    render(<ProfileDataDisplay />);

    expect(screen.getByLabelText("Username")).toHaveValue("");
    expect(screen.getByLabelText("Username")).toBeDisabled();
  });
});
