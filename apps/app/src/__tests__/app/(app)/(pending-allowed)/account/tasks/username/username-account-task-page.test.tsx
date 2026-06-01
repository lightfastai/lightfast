import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prefetchMock = vi.fn();
const serverAccountGetQueryOptionsMock = vi.fn(() => ({
  queryKey: [["viewer", "account", "get"]],
}));
const clientAccountGetQueryOptionsMock = vi.fn(() => ({
  queryKey: [["viewer", "account", "get"]],
}));
const createUsernameMutationOptionsMock = vi.fn((options: unknown) => options);
const mutateMock = vi.fn();
const replaceMock = vi.fn();

vi.mock("~/trpc/server", () => ({
  HydrateClient: ({ children }: { children?: ReactNode }) => <>{children}</>,
  prefetch: prefetchMock,
  trpc: {
    viewer: {
      account: {
        get: { queryOptions: serverAccountGetQueryOptionsMock },
      },
    },
  },
}));

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    viewer: {
      account: {
        createUsername: {
          mutationOptions: createUsernameMutationOptionsMock,
        },
        get: {
          queryOptions: clientAccountGetQueryOptionsMock,
        },
      },
    },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: (options: {
    onSuccess?: (data: ReturnType<typeof profile>) => void;
  }) => ({
    isPending: false,
    mutate: (input: { username: string }) => {
      mutateMock(input);
      options.onSuccess?.(profile({ username: input.username }));
    },
  }),
  useQueryClient: () => ({
    setQueryData: vi.fn(),
  }),
  useSuspenseQuery: () => ({
    data: profile({ username: null }),
  }),
}));

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
    username: null,
    ...overrides,
  };
}

const { default: UsernameAccountTaskPage } = await import(
  "~/app/(app)/(pending-allowed)/account/tasks/username/page"
);

beforeEach(() => {
  prefetchMock.mockClear();
  serverAccountGetQueryOptionsMock.mockClear();
  clientAccountGetQueryOptionsMock.mockClear();
  createUsernameMutationOptionsMock.mockClear();
  mutateMock.mockReset();
  replaceMock.mockReset();
});

describe("/account/tasks/username", () => {
  it("creates a username and returns to the requested account flow", async () => {
    render(
      await UsernameAccountTaskPage({
        searchParams: Promise.resolve({
          return_to: "/account/teams/new?from=signup",
        }),
      })
    );

    expect(
      screen.getByRole("heading", { name: "Choose your username" })
    ).toBeInTheDocument();

    const usernameInput = screen.getByLabelText("Username");
    fireEvent.change(usernameInput, { target: { value: "Ada-Dev" } });
    expect(usernameInput).toHaveValue("ada-dev");

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(prefetchMock).toHaveBeenCalledWith({
        queryKey: [["viewer", "account", "get"]],
      });
      expect(createUsernameMutationOptionsMock).toHaveBeenCalledWith({
        meta: { suppressErrorToast: true },
        onError: expect.any(Function),
        onSuccess: expect.any(Function),
      });
      expect(mutateMock).toHaveBeenCalledWith({
        idempotencyKey: expect.any(String),
        username: "ada-dev",
      });
      expect(replaceMock).toHaveBeenCalledWith("/account/teams/new?from=signup");
    });
  });

  it("falls back to team creation when return_to is not an app path", async () => {
    render(
      await UsernameAccountTaskPage({
        searchParams: Promise.resolve({
          return_to: "https://evil.example/account/teams/new",
        }),
      })
    );

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "ada-dev" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/account/teams/new");
    });
  });
});
