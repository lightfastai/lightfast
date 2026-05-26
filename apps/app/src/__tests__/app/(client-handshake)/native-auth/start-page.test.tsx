import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listOrganizations = vi.fn();
const createAttempt = vi.fn();
const redirectMock = vi.fn();
const headersMock = vi.fn(async () => new Headers());

vi.mock("next/headers", () => ({
  headers: headersMock,
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
  redirect: redirectMock,
}));

vi.mock("~/app/api/native-auth/_server/native-auth-caller", () => ({
  createNativeAuthCaller: vi.fn(async () => ({
    native: {
      auth: {
        createAttempt,
        listOrganizations,
      },
    },
  })),
}));

const Page = (
  await import("~/app/(client-handshake)/native-auth/[client]/start/page")
).default;
const { continueNativeAuth } = await import(
  "~/app/(client-handshake)/native-auth/[client]/start/actions"
);

describe("/native-auth/[client]/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listOrganizations.mockResolvedValue([
      {
        bindingStatus: "bound",
        id: "org_1",
        name: "Acme",
        role: "org:admin",
        slug: "acme",
      },
    ]);
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
  });

  it("redirects to the Clerk authorize URL after choosing an organization", async () => {
    createAttempt.mockResolvedValueOnce({
      authorizationUrl: "https://clerk.example.com/oauth/authorize?x=1",
    });
    const formData = new FormData();
    formData.set("client", "desktop");
    formData.set("organization_id", "org_1");
    formData.set("redirect_uri", "http://127.0.0.1:51010/callback");
    formData.set("state", "nonce_1234567890");
    formData.set("code_challenge", "a".repeat(43));
    formData.set("code_challenge_method", "S256");

    await continueNativeAuth(formData);

    expect(createAttempt).toHaveBeenCalledWith({
      client: "desktop",
      codeChallenge: "a".repeat(43),
      codeChallengeMethod: "S256",
      organizationId: "org_1",
      redirectUri: "http://127.0.0.1:51010/callback",
      stateNonce: "nonce_1234567890",
    });
    expect(redirectMock).toHaveBeenCalledWith(
      "https://clerk.example.com/oauth/authorize?x=1"
    );
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
