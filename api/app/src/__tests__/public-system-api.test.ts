import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActiveOrgBinding: vi.fn(),
  getCurrentOrgConnectorConnection: vi.fn(),
  verifyKey: vi.fn(),
}));

vi.mock("@vendor/unkey/server", () => ({
  getUnkeyClient: () => ({
    keys: { verifyKey: mocks.verifyKey },
  }),
}));

vi.mock("@db/app/client", () => ({ db: { kind: "mock-db" } }));
vi.mock("@db/app", () => ({
  getActiveOrgBinding: mocks.getActiveOrgBinding,
  getCurrentOrgConnectorConnection: mocks.getCurrentOrgConnectorConnection,
}));

const { handlePublicApiOptionsRequest, handleSystemHealthPublicApiRequest } =
  await import("../adapters/public/system");

const validKey = `lf_${"a".repeat(40)}`;

function verifyResult(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    data: {
      code: "VALID",
      identity: { externalId: "org_test", id: "identity_test" },
      keyId: "key_test",
      meta: { createdByUserId: "user_test" },
      permissions: ["api.signals.read", "api.signals.write"],
      valid: true,
      ...overrides,
    },
    meta: { requestId: "req_test" },
  };
}

function publicApiRequest(input: { token?: string } = {}) {
  const headers = new Headers();
  if (input.token) {
    headers.set("authorization", `Bearer ${input.token}`);
  }

  return new Request("https://lightfast.test/api/v1/system/health", {
    headers,
    method: "GET",
  });
}

async function responseJson(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();

  mocks.verifyKey.mockResolvedValue(verifyResult());
  mocks.getCurrentOrgConnectorConnection.mockResolvedValue({
    status: "active",
  });
  mocks.getActiveOrgBinding.mockResolvedValue({
    metadata: {
      lightfastRepository: {
        fullName: "acme/.lightfast",
        id: "987",
        installationId: "1001",
        name: ".lightfast",
        verifiedAt: "2026-05-30T10:00:00.000Z",
      },
    },
    provider: "github",
    providerAccountLogin: "acme",
    providerInstallationId: "1001",
  });
});

describe("public system API adapter", () => {
  it("answers CORS preflight without touching auth", () => {
    const response = handlePublicApiOptionsRequest();

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(mocks.verifyKey).not.toHaveBeenCalled();
  });

  it("rejects health requests without an API key", async () => {
    const response = await handleSystemHealthPublicApiRequest(
      publicApiRequest()
    );

    expect(response.status).toBe(401);
    await expect(responseJson(response)).resolves.toMatchObject({
      error: "auth_required",
    });
  });

  it("returns health for a valid org API key", async () => {
    const response = await handleSystemHealthPublicApiRequest(
      publicApiRequest({ token: validKey })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");

    const body = await responseJson(response);
    expect(body).toMatchObject({
      status: "ok",
      version: expect.any(String),
      timestamp: expect.any(String),
    });
    expect(Date.parse(String(body.timestamp))).not.toBeNaN();
  });

  it("does not require completed org setup for connectivity checks", async () => {
    mocks.getActiveOrgBinding.mockResolvedValueOnce(undefined);

    const response = await handleSystemHealthPublicApiRequest(
      publicApiRequest({ token: validKey })
    );

    expect(response.status).toBe(200);
    await expect(responseJson(response)).resolves.toMatchObject({
      status: "ok",
    });
  });
});
