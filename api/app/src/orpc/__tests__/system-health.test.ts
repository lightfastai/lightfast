import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyMock = vi.fn();
const isOrgBoundMock = vi.fn();

vi.mock("@vendor/unkey/server", () => ({
  getUnkeyClient: () => ({
    keys: { verifyKey: verifyMock },
  }),
}));

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@db/app", () => ({
  createSignal: vi.fn(),
  getSignalByPublicId: vi.fn(),
  isOrgBound: isOrgBoundMock,
  markSignalFailed: vi.fn(),
}));

const { orpcRouter } = await import("../router");

const validKey = `ak_${"a".repeat(40)}`;

beforeEach(() => {
  verifyMock.mockReset();
  isOrgBoundMock.mockReset();
  isOrgBoundMock.mockResolvedValue(true);
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
