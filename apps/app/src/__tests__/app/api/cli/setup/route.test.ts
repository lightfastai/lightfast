import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyBearerJwtMock = vi.fn();
vi.mock("~/app/(auth-api)/_server/verify-bearer-jwt", () => ({
  verifyBearerJwt: verifyBearerJwtMock,
}));

vi.mock("@db/app/client", () => ({ db: {} }));

const getOrganizationMembershipListMock = vi.fn();
const apiKeysCreateMock = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: () =>
    Promise.resolve({
      users: {
        getOrganizationMembershipList: getOrganizationMembershipListMock,
      },
      apiKeys: { create: apiKeysCreateMock },
    }),
}));

const { POST } = await import("~/app/api/cli/setup/route");

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/cli/setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function membership(org: { id: string; slug: string | null; name: string }) {
  return { organization: org };
}

beforeEach(() => {
  verifyBearerJwtMock.mockReset();
  getOrganizationMembershipListMock.mockReset();
  apiKeysCreateMock.mockReset();
});

describe("POST /api/cli/setup", () => {
  it("returns 401 when the Bearer JWT is missing or invalid", async () => {
    verifyBearerJwtMock.mockResolvedValue(null);

    const res = await POST(makeReq({ orgId: "org_1" }));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("returns 403 not_a_member when the user is not in the org", async () => {
    verifyBearerJwtMock.mockResolvedValue({ userId: "user_1" });
    getOrganizationMembershipListMock.mockResolvedValue({ data: [] });

    const res = await POST(makeReq({ orgId: "org_1" }));

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "not_a_member" });
  });

  it("mints an org API key for any member org", async () => {
    verifyBearerJwtMock.mockResolvedValue({ userId: "user_1" });
    getOrganizationMembershipListMock.mockResolvedValue({
      data: [membership({ id: "org_1", slug: "acme", name: "Acme" })],
    });
    apiKeysCreateMock.mockResolvedValue({ secret: "ak_secret_value" });

    const res = await POST(makeReq({ orgId: "org_1" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      apiKey: "ak_secret_value",
      orgId: "org_1",
      orgSlug: "acme",
      orgName: "Acme",
    });
    expect(apiKeysCreateMock).toHaveBeenCalledWith({
      name: "CLI (auto-generated)",
      subject: "org_1",
      createdBy: "user_1",
    });
  });
});
