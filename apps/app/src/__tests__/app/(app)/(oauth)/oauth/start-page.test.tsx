import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createAttemptMutationOptions = vi.fn((options: unknown) => options);
const fetchQuery = vi.fn();
const listOrganizationsQueryOptions = vi.fn(() => ({
  queryKey: ["native", "auth", "listOrganizations"],
}));
const mutateMock = vi.fn();
const useMutationMock = vi.fn();

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    native: {
      auth: {
        createAttempt: {
          mutationOptions: createAttemptMutationOptions,
        },
      },
    },
  }),
}));

vi.mock("~/trpc/server", () => ({
  getQueryClient: () => ({ fetchQuery }),
  trpc: {
    native: {
      auth: {
        listOrganizations: {
          queryOptions: listOrganizationsQueryOptions,
        },
      },
    },
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: useMutationMock,
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

const Page = (await import("~/app/(app)/(oauth)/oauth/[client]/start/page"))
  .default;

describe("/oauth/[client]/start", () => {
  let assignSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    assignSpy = vi.spyOn(window.location, "assign").mockImplementation(() => {
      // Avoid navigating the test environment.
    });
    fetchQuery.mockReset();
    mutateMock.mockReset();
    createAttemptMutationOptions.mockClear();
    listOrganizationsQueryOptions.mockClear();
    useMutationMock.mockReset();
    fetchQuery.mockResolvedValue([
      {
        bindingStatus: "bound",
        id: "org_1",
        name: "Acme",
        role: "org:admin",
        slug: "acme",
      },
    ]);
    useMutationMock.mockImplementation(
      (options?: {
        onSuccess?: (result: { authorizationUrl: string }) => void;
      }) => ({
        isPending: false,
        mutate: (input: unknown) => {
          mutateMock(input);
          options?.onSuccess?.({
            authorizationUrl: "https://clerk.example.com/oauth/authorize?x=1",
          });
        },
      })
    );
  });

  afterEach(() => {
    assignSpy.mockRestore();
  });

  it("renders organizations returned by native auth tRPC", async () => {
    render(
      await Page({
        params: Promise.resolve({ client: "cli" }),
        searchParams: Promise.resolve({
          code_challenge: "a".repeat(43),
          code_challenge_method: "S256",
          redirect_uri: "http://127.0.0.1:51010/callback",
          state: "nonce_1234567890",
        }),
      })
    );

    expect(
      screen.getByRole("heading", { name: "Choose a Lightfast organization" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Acme/ })).toBeInTheDocument();
    expect(listOrganizationsQueryOptions).toHaveBeenCalledOnce();
    expect(fetchQuery).toHaveBeenCalledWith({
      queryKey: ["native", "auth", "listOrganizations"],
    });
  });

  it("uses the normal app tRPC mutation and navigates to Clerk after choosing an organization", async () => {
    render(
      await Page({
        params: Promise.resolve({ client: "desktop" }),
        searchParams: Promise.resolve({
          code_challenge: "a".repeat(43),
          code_challenge_method: "S256",
          redirect_uri: "http://127.0.0.1:51010/callback",
          state: "nonce_1234567890",
        }),
      })
    );

    fireEvent.click(screen.getByRole("button", { name: /Acme/ }));

    await waitFor(() => {
      expect(createAttemptMutationOptions).toHaveBeenCalledOnce();
      expect(mutateMock).toHaveBeenCalledWith({
        client: "desktop",
        codeChallenge: "a".repeat(43),
        codeChallengeMethod: "S256",
        organizationId: "org_1",
        redirectUri: "http://127.0.0.1:51010/callback",
        stateNonce: "nonce_1234567890",
      });
      expect(assignSpy).toHaveBeenCalledWith(
        "https://clerk.example.com/oauth/authorize?x=1"
      );
    });
  });

  it("rejects invalid loopback redirect URIs", async () => {
    await expect(
      Page({
        params: Promise.resolve({ client: "cli" }),
        searchParams: Promise.resolve({
          code_challenge: "a".repeat(43),
          code_challenge_method: "S256",
          redirect_uri: "https://app.example.com/callback",
          state: "nonce_1234567890",
        }),
      })
    ).rejects.toThrow("not-found");
  });
});
