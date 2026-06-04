import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyMock = vi.fn();
const getActiveOrgBindingMock = vi.fn();
const getCurrentOrgConnectorConnectionMock = vi.fn();

vi.mock("@vendor/unkey/server", () => ({
  getUnkeyClient: () => ({
    keys: { verifyKey: verifyMock },
  }),
}));

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@db/app", () => ({
  createSignal: vi.fn(),
  getActiveOrgBinding: getActiveOrgBindingMock,
  getCurrentOrgConnectorConnection: getCurrentOrgConnectorConnectionMock,
  getSignalByPublicId: vi.fn(),
  markSignalFailed: vi.fn(),
}));

const { orpcRouter } = await import("../router");

const validKey = `lf_${"a".repeat(40)}`;

beforeEach(() => {
  verifyMock.mockReset();
  getActiveOrgBindingMock.mockReset();
  getCurrentOrgConnectorConnectionMock.mockReset();
  getCurrentOrgConnectorConnectionMock.mockResolvedValue({
    status: "active",
  });
  getActiveOrgBindingMock.mockResolvedValue({
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
  verifyMock.mockResolvedValue({
    data: {
      code: "VALID",
      identity: { externalId: "org_test", id: "identity_test" },
      keyId: "key_test",
      meta: { createdByUserId: "user_test" },
      valid: true,
    },
    meta: { requestId: "req_test" },
  });
});

describe("orpcRouter.system.health", () => {
  it("returns ok payload through the full middleware stack", async () => {
    const result = await call(orpcRouter.system.health, undefined, {
      context: {
        headers: new Headers({ authorization: `Bearer ${validKey}` }),
        requestId: "test-req",
      },
    });

    expect(result).toMatchObject({
      status: "ok",
      version: expect.any(String),
      timestamp: expect.any(String),
    });
  });
});
