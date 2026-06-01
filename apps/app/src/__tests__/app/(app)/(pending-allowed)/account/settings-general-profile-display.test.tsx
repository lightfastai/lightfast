import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const accountGetQueryOptionsMock = vi.fn(() => ({
  queryKey: ["viewer", "account", "get"],
}));
const githubAccountStatusQueryOptionsMock = vi.fn(() => ({
  queryKey: ["viewer", "githubAccount", "status"],
}));
const updateNameMutationOptionsMock = vi.fn((options: unknown) => options);
const createUsernameMutationOptionsMock = vi.fn((options: unknown) => options);
const useSuspenseQueryMock = vi.fn();
const mutationInputs: unknown[] = [];

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
    mutate: vi.fn((input: unknown) => {
      mutationInputs.push(input);
    }),
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
  createUsernameMutationOptionsMock.mockClear();
  mutationInputs.length = 0;
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
  it("locks the username field after a username exists", () => {
    mockProfileQuery(profile());

    render(<ProfileDataDisplay />);

    expect(screen.getByLabelText("Name")).toHaveValue("Ada Lovelace");
    expect(screen.getByLabelText("Username")).toHaveValue("ada-dev");
    expect(screen.getByLabelText("Username")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Username created" })
    ).toBeDisabled();
  });

  it("allows users without a username to create one", () => {
    mockProfileQuery(profile({ username: null }));

    render(<ProfileDataDisplay />);

    const usernameInput = screen.getByLabelText("Username");
    expect(usernameInput).toBeEnabled();
    fireEvent.change(usernameInput, { target: { value: "Ada-Dev" } });
    expect(usernameInput).toHaveValue("ada-dev");
    expect(
      screen.getByRole("button", { name: "Create username" })
    ).toBeEnabled();
  });

  it("does not enable username creation for invalid handles", () => {
    mockProfileQuery(profile({ username: null }));

    render(<ProfileDataDisplay />);

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "settings" },
    });

    expect(
      screen.getByRole("button", { name: "Create username" })
    ).toBeDisabled();
  });

  it("reuses the username idempotency key across retries", () => {
    mockProfileQuery(profile({ username: null }));

    render(<ProfileDataDisplay />);

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "ada-dev" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create username" }));
    fireEvent.click(screen.getByRole("button", { name: "Create username" }));

    expect(mutationInputs).toHaveLength(2);
    expect(mutationInputs[0]).toMatchObject({ username: "ada-dev" });
    expect(mutationInputs[1]).toMatchObject({
      idempotencyKey: expect.any(String),
      username: "ada-dev",
    });
    expect(
      (mutationInputs[1] as { idempotencyKey: string }).idempotencyKey
    ).toBe((mutationInputs[0] as { idempotencyKey: string }).idempotencyKey);
  });
});
