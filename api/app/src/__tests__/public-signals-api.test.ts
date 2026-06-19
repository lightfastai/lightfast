import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSignalForActor: vi.fn(),
  getActiveOrgBinding: vi.fn(),
  getCurrentOrgConnectorConnection: vi.fn(),
  getVisibleSignalByPublicId: vi.fn(),
  listSignalEntityLinksForSignal: vi.fn(),
  listSignals: vi.fn(),
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
  getVisibleSignalByPublicId: mocks.getVisibleSignalByPublicId,
  listSignalEntityLinksForSignal: mocks.listSignalEntityLinksForSignal,
  listSignals: mocks.listSignals,
}));

vi.mock("../signals/service", () => ({
  createSignalForActor: mocks.createSignalForActor,
}));

const {
  handleCreateSignalPublicApiRequest,
  handleGetSignalPublicApiRequest,
  handleListSignalsPublicApiRequest,
  handlePublicApiOptionsRequest,
} = await import("../adapters/public/signals");
const { SignalCreateQueueError } = await import("../signals/create-signal");

const validKey = `lf_${"a".repeat(40)}`;
const signalId = "signal_123e4567-e89b-12d3-a456-426614174000";

function verifyResult(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    data: {
      code: "VALID",
      identity: { externalId: "org_test", id: "identity_test" },
      keyId: "key_test",
      meta: { createdByUserId: "user_test" },
      permissions: ["api:signals:read", "api:signals:write"],
      valid: true,
      ...overrides,
    },
    meta: { requestId: "req_test" },
  };
}

function publicApiRequest(input: {
  body?: unknown;
  method?: string;
  token?: string;
  url?: string;
}) {
  const headers = new Headers();
  if (input.token) {
    headers.set("authorization", `Bearer ${input.token}`);
  }
  if (input.body !== undefined) {
    headers.set("content-type", "application/json");
  }

  return new Request(input.url ?? "https://lightfast.test/api/v1/signals", {
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
    headers,
    method: input.method ?? "POST",
  });
}

async function responseJson(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

function decodeCursor(cursor: unknown) {
  expect(typeof cursor).toBe("string");
  return JSON.parse(
    Buffer.from(cursor as string, "base64url").toString("utf8")
  );
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
  mocks.listSignalEntityLinksForSignal.mockResolvedValue([]);
  mocks.listSignals.mockResolvedValue({
    items: [
      {
        classification: null,
        clerkOrgId: "org_test",
        createdAt: new Date("2026-05-21T00:00:00.000Z"),
        createdByApiKeyId: "key_test",
        createdByMcpClientId: null,
        createdByMcpGrantId: null,
        createdByUserId: "user_test",
        errorCode: null,
        errorMessage: null,
        id: 1,
        input: "Run the test plan",
        publicId: signalId,
        status: "classified",
        updatedAt: new Date("2026-05-21T00:01:00.000Z"),
        visibilityScope: "team",
      },
    ],
    nextCursor: {
      createdAt: new Date("2026-05-21T00:00:00.000Z"),
      id: 1,
    },
  });
  mocks.createSignalForActor.mockResolvedValue({
    id: signalId,
    status: "queued",
    visibilityScope: "user",
  });
});

describe("public signal API adapter", () => {
  it("answers CORS preflight without touching auth", () => {
    const response = handlePublicApiOptionsRequest();

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(mocks.verifyKey).not.toHaveBeenCalled();
  });

  it("rejects create requests without an API key", async () => {
    const response = await handleCreateSignalPublicApiRequest(
      publicApiRequest({ body: { input: "hello" } })
    );

    expect(response.status).toBe(401);
    await expect(responseJson(response)).resolves.toMatchObject({
      error: "auth_required",
    });
    expect(mocks.createSignalForActor).not.toHaveBeenCalled();
  });

  it("lists visible signals with API-key auth and an opaque cursor", async () => {
    const response = await handleListSignalsPublicApiRequest(
      publicApiRequest({
        method: "GET",
        token: validKey,
        url: "https://lightfast.test/api/v1/signals?limit=25&status=classified",
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    const body = await responseJson(response);
    expect(body).toMatchObject({
      items: [
        {
          id: signalId,
          input: "Run the test plan",
          status: "classified",
          visibilityScope: "team",
        },
      ],
    });
    expect(decodeCursor(body.nextCursor)).toEqual({
      createdAt: "2026-05-21T00:00:00.000Z",
      id: 1,
    });
    expect(mocks.listSignals).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
      cursor: undefined,
      limit: 25,
      statuses: ["classified"],
    });
  });

  it("rejects signal list requests from write-only API keys", async () => {
    mocks.verifyKey.mockResolvedValueOnce(
      verifyResult({ permissions: ["api:signals:write"] })
    );

    const response = await handleListSignalsPublicApiRequest(
      publicApiRequest({
        method: "GET",
        token: validKey,
        url: "https://lightfast.test/api/v1/signals",
      })
    );

    expect(response.status).toBe(403);
    await expect(responseJson(response)).resolves.toMatchObject({
      error: "forbidden",
    });
    expect(mocks.listSignals).not.toHaveBeenCalled();
  });

  it("creates a queued signal with API-key attribution", async () => {
    const response = await handleCreateSignalPublicApiRequest(
      publicApiRequest({
        body: { input: "  Reply to this relevant post  " },
        token: validKey,
      })
    );

    expect(response.status).toBe(202);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    await expect(responseJson(response)).resolves.toEqual({
      id: signalId,
      status: "queued",
      visibilityScope: "user",
    });
    expect(mocks.createSignalForActor).toHaveBeenCalledWith(expect.anything(), {
      actor: {
        apiKeyId: "key_test",
        kind: "api_key",
        orgId: "org_test",
        userId: "user_test",
      },
      input: "Reply to this relevant post",
    });
  });

  it("rejects signal creation from read-only API keys", async () => {
    mocks.verifyKey.mockResolvedValueOnce(
      verifyResult({ permissions: ["api:signals:read"] })
    );

    const response = await handleCreateSignalPublicApiRequest(
      publicApiRequest({
        body: { input: "Run the test plan" },
        token: validKey,
      })
    );

    expect(response.status).toBe(403);
    await expect(responseJson(response)).resolves.toMatchObject({
      error: "forbidden",
    });
    expect(mocks.createSignalForActor).not.toHaveBeenCalled();
  });

  it("rejects signal creation for unbound organizations", async () => {
    mocks.getActiveOrgBinding.mockResolvedValueOnce(undefined);

    const response = await handleCreateSignalPublicApiRequest(
      publicApiRequest({
        body: { input: "Run the test plan" },
        token: validKey,
      })
    );

    expect(response.status).toBe(403);
    await expect(responseJson(response)).resolves.toMatchObject({
      error: "org_setup_required",
    });
    expect(mocks.createSignalForActor).not.toHaveBeenCalled();
  });

  it("maps signal queue failures to a public internal error", async () => {
    mocks.createSignalForActor.mockRejectedValueOnce(
      new SignalCreateQueueError(new Error("inngest unavailable"))
    );

    const response = await handleCreateSignalPublicApiRequest(
      publicApiRequest({
        body: { input: "Run the test plan" },
        token: validKey,
      })
    );

    expect(response.status).toBe(500);
    await expect(responseJson(response)).resolves.toMatchObject({
      error: "signal_enqueue_failed",
      message: expect.stringContaining("Failed to queue signal"),
    });
  });

  it("reads a visible signal by id", async () => {
    mocks.getVisibleSignalByPublicId.mockResolvedValueOnce({
      classification: null,
      clerkOrgId: "org_test",
      createdAt: new Date("2026-05-21T00:00:00.000Z"),
      createdByApiKeyId: "key_test",
      createdByMcpClientId: null,
      createdByMcpGrantId: null,
      createdByUserId: "user_test",
      errorCode: null,
      errorMessage: null,
      id: 1,
      input: "Run the test plan",
      publicId: signalId,
      status: "classified",
      updatedAt: new Date("2026-05-21T00:01:00.000Z"),
      visibilityScope: "team",
    });

    const response = await handleGetSignalPublicApiRequest(
      publicApiRequest({
        method: "GET",
        token: validKey,
        url: `https://lightfast.test/api/v1/signals/${signalId}`,
      }),
      { id: signalId }
    );

    expect(response.status).toBe(200);
    await expect(responseJson(response)).resolves.toMatchObject({
      entityLinks: [],
      id: signalId,
      input: "Run the test plan",
      status: "classified",
      visibilityScope: "team",
    });
    expect(mocks.getVisibleSignalByPublicId).toHaveBeenCalledWith(
      expect.anything(),
      {
        clerkOrgId: "org_test",
        createdByUserId: "user_test",
        publicId: signalId,
      }
    );
  });

  it("returns not found for missing or wrong-org signals", async () => {
    mocks.getVisibleSignalByPublicId.mockResolvedValueOnce(undefined);

    const response = await handleGetSignalPublicApiRequest(
      publicApiRequest({
        method: "GET",
        token: validKey,
        url: `https://lightfast.test/api/v1/signals/${signalId}`,
      }),
      { id: signalId }
    );

    expect(response.status).toBe(404);
    await expect(responseJson(response)).resolves.toMatchObject({
      error: "not_found",
    });
  });

  it("scopes signal reads to the requesting API key organization", async () => {
    mocks.verifyKey.mockResolvedValueOnce(
      verifyResult({
        identity: { externalId: "org_other", id: "identity_other" },
      })
    );
    mocks.getActiveOrgBinding.mockResolvedValueOnce({
      metadata: {
        lightfastRepository: {
          fullName: "other/.lightfast",
          id: "2002",
          installationId: "2002",
          name: ".lightfast",
          verifiedAt: "2026-05-30T10:00:00.000Z",
        },
      },
      provider: "github",
      providerAccountLogin: "other",
      providerInstallationId: "2002",
    });
    mocks.getVisibleSignalByPublicId.mockResolvedValueOnce(undefined);

    const response = await handleGetSignalPublicApiRequest(
      publicApiRequest({
        method: "GET",
        token: validKey,
        url: `https://lightfast.test/api/v1/signals/${signalId}`,
      }),
      { id: signalId }
    );

    expect(response.status).toBe(404);
    await expect(responseJson(response)).resolves.toMatchObject({
      error: "not_found",
    });
    expect(mocks.getVisibleSignalByPublicId).toHaveBeenCalledWith(
      expect.anything(),
      {
        clerkOrgId: "org_other",
        createdByUserId: "user_test",
        publicId: signalId,
      }
    );
  });
});
