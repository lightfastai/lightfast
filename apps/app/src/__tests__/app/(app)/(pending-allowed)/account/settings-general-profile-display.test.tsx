import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const accountGetQueryOptionsMock = vi.fn(() => ({
  queryKey: ["viewer", "account", "get"],
}));
const updateNameMutationOptionsMock = vi.fn((options: unknown) => options);
const createUsernameMutationOptionsMock = vi.fn((options: unknown) => options);
const useSuspenseQueryMock = vi.fn();

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    viewer: {
      account: {
        createUsername: {
          mutationOptions: createUsernameMutationOptionsMock,
        },
        get: {
          queryOptions: accountGetQueryOptionsMock,
        },
        updateName: {
          mutationOptions: updateNameMutationOptionsMock,
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
  updateNameMutationOptionsMock.mockClear();
  createUsernameMutationOptionsMock.mockClear();
  useSuspenseQueryMock.mockReset();
});

describe("ProfileDataDisplay", () => {
  it("locks the username field after a username exists", () => {
    useSuspenseQueryMock.mockReturnValue({ data: profile() });

    render(<ProfileDataDisplay />);

    expect(screen.getByLabelText("Name")).toHaveValue("Ada Lovelace");
    expect(screen.getByLabelText("Username")).toHaveValue("ada-dev");
    expect(screen.getByLabelText("Username")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Username created" })
    ).toBeDisabled();
  });

  it("allows users without a username to create one", () => {
    useSuspenseQueryMock.mockReturnValue({
      data: profile({ username: null }),
    });

    render(<ProfileDataDisplay />);

    const usernameInput = screen.getByLabelText("Username");
    expect(usernameInput).toBeEnabled();
    fireEvent.change(usernameInput, { target: { value: "Ada-Dev" } });
    expect(usernameInput).toHaveValue("ada-dev");
    expect(screen.getByRole("button", { name: "Create username" })).toBeEnabled();
  });
});
