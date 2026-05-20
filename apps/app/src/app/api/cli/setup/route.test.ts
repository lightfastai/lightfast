import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyBearerJwtMock = vi.fn();
vi.mock("~/app/(auth-api)/_server/verify-bearer-jwt", () => ({
  verifyBearerJwt: verifyBearerJwtMock,
}));

const isOrgBoundMock = vi.fn();
vi.mock("@db/app", () => ({ isOrgBound: isOrgBoundMock }));
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

const { POST } = await import("./route");

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
  isOrgBoundMock.mockReset();
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
    expect(isOrgBoundMock).not.toHaveBeenCalled();
  });

  it("returns 403 org_setup_required for an unbound org — no key minted", async () => {
    verifyBearerJwtMock.mockResolvedValue({ userId: "user_1" });
    getOrganizationMembershipListMock.mockResolvedValue({
      data: [membership({ id: "org_1", slug: "acme", name: "Acme" })],
    });
    isOrgBoundMock.mockResolvedValue(false);

    const res = await POST(makeReq({ orgId: "org_1" }));

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "org_setup_required",
      repair: { id: "bind-source-control", href: "/acme/tasks/bind" },
    });
    expect(apiKeysCreateMock).not.toHaveBeenCalled();
  });

  it("omits the repair href when the org has no slug", async () => {
    verifyBearerJwtMock.mockResolvedValue({ userId: "user_1" });
    getOrganizationMembershipListMock.mockResolvedValue({
      data: [membership({ id: "org_1", slug: null, name: "Acme" })],
    });
    isOrgBoundMock.mockResolvedValue(false);

    const res = await POST(makeReq({ orgId: "org_1" }));

    expect(await res.json()).toEqual({
      error: "org_setup_required",
      repair: { id: "bind-source-control" },
    });
  });

  it("mints an org API key for a bound org", async () => {
    verifyBearerJwtMock.mockResolvedValue({ userId: "user_1" });
    getOrganizationMembershipListMock.mockResolvedValue({
      data: [membership({ id: "org_1", slug: "acme", name: "Acme" })],
    });
    isOrgBoundMock.mockResolvedValue(true);
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
