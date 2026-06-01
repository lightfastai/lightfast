import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getMcpConsentViewModelMock = vi.fn();
const issueMcpAuthorizationCodeMock = vi.fn();
const redirectMock = vi.fn((url: string) => {
  throw new Error(`redirect:${url}`);
});

vi.mock("~/app/(app)/(oauth)/oauth/authorize/model", () => ({
  getMcpConsentViewModel: getMcpConsentViewModelMock,
}));

vi.mock("@api/app", () => ({
  issueMcpAuthorizationCode: issueMcpAuthorizationCodeMock,
}));

vi.mock("@db/app/client", () => ({
  db: { kind: "mock-db" },
}));

vi.mock("@vendor/clerk/server", () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      userId: "user_test",
    })
  ),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
  redirect: redirectMock,
}));

vi.mock("~/env", () => ({
  env: {
    NEXT_PUBLIC_APP_URL: "https://app.lightfast.localhost",
    SERVICE_JWT_SECRET: "test-service-jwt-secret-at-least-32-chars",
  },
}));

const Page = (await import("~/app/(app)/(oauth)/oauth/authorize/page")).default;
const { approveMcpAuthorizationAction } = await import(
  "~/app/(app)/(oauth)/oauth/authorize/actions"
);

function consentModel(overrides: Record<string, unknown> = {}) {
  return {
    client: {
      id: "mcp_client_test",
      name: "Lightfield",
      redirectUri: "https://backend.lightfield.app/connections/callback/MCP",
      verified: false,
    },
    organizations: [{ id: "org_1", name: "Acme", slug: "acme" }],
    permissions: [
      {
        description: "Create new signals and read their status.",
        kind: "write",
        label: "Create signals",
        scope: "mcp:signals:write",
      },
    ],
    request: {
      clientId: "mcp_client_test",
      codeChallenge: "challenge_test",
      codeChallengeMethod: "S256",
      redirectUri: "https://backend.lightfield.app/connections/callback/MCP",
      resource: "https://mcp.lightfast.localhost/mcp",
      scope: "mcp:signals:write",
      state: "state_test",
    },
    user: {
      email: "dev@example.com",
      id: "user_test",
      name: "Jeevan",
    },
    ...overrides,
  };
}

beforeEach(() => {
  getMcpConsentViewModelMock.mockReset();
  issueMcpAuthorizationCodeMock.mockReset();
  redirectMock.mockClear();
  getMcpConsentViewModelMock.mockResolvedValue(consentModel());
  issueMcpAuthorizationCodeMock.mockResolvedValue({
    code: "mcp_code_secret",
  });
});

describe("/oauth/authorize MCP consent", () => {
  it("renders client name, signed-in user, organization, redirect uri, and permissions", async () => {
    render(
      await Page({
        searchParams: Promise.resolve({
          client_id: "mcp_client_test",
          code_challenge: "challenge_test",
          code_challenge_method: "S256",
          redirect_uri:
            "https://backend.lightfield.app/connections/callback/MCP",
          resource: "https://mcp.lightfast.localhost/mcp",
          scope: "mcp:signals:write",
          state: "state_test",
        }),
      })
    );

    expect(
      screen.getByRole("heading", { name: "Lightfield is requesting access" })
    ).toBeInTheDocument();
    expect(screen.getAllByText("dev@example.com").length).toBeGreaterThan(0);
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(
      screen.getByText(
        "https://backend.lightfield.app/connections/callback/MCP"
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Create signals")).toBeInTheDocument();
  });

  it("renders an organization selector when multiple organizations are eligible", async () => {
    getMcpConsentViewModelMock.mockResolvedValueOnce(
      consentModel({
        organizations: [
          { id: "org_1", name: "Acme", slug: "acme" },
          { id: "org_2", name: "Beta", slug: "beta" },
        ],
      })
    );

    render(await Page({ searchParams: Promise.resolve({}) }));

    expect(screen.getByLabelText("Organization")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Acme" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Beta" })).toBeInTheDocument();
  });

  it("opens a details sheet with raw scopes and client id", async () => {
    render(await Page({ searchParams: Promise.resolve({}) }));

    fireEvent.click(screen.getByRole("button", { name: "Details" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("mcp_client_test")).toBeInTheDocument();
    expect(screen.getByText("mcp:signals:write")).toBeInTheDocument();
  });

  it("renders unverified and write warnings on the main screen", async () => {
    render(await Page({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("Unverified client")).toBeInTheDocument();
    expect(screen.getByText("Can write to your workspace")).toBeInTheDocument();
  });

  it("posts approve through a server action", async () => {
    const formData = new FormData();
    formData.set("clientId", "mcp_client_test");
    formData.set("codeChallenge", "challenge_test");
    formData.set("codeChallengeMethod", "S256");
    formData.set("organizationId", "org_1");
    formData.set(
      "redirectUri",
      "https://backend.lightfield.app/connections/callback/MCP"
    );
    formData.set("resource", "https://mcp.lightfast.localhost/mcp");
    formData.set("scope", "mcp:signals:write");
    formData.set("state", "state_test");

    await expect(approveMcpAuthorizationAction(formData)).rejects.toThrow(
      "redirect:https://backend.lightfield.app/connections/callback/MCP?code=mcp_code_secret&state=state_test"
    );

    expect(issueMcpAuthorizationCodeMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        clientId: "mcp_client_test",
        clerkOrgId: "org_1",
        clerkUserId: "user_test",
      })
    );
  });
});
