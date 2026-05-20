import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyMock = vi.fn();
const isOrgBoundMock = vi.fn();

vi.mock("@vendor/clerk/server", () => ({
  clerkClient: () =>
    Promise.resolve({
      apiKeys: { verify: verifyMock },
    }),
}));

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@db/app", () => ({ isOrgBound: isOrgBoundMock }));

const { orpcRouter } = await import("../router");

const validKey = `ak_${"a".repeat(40)}`;

beforeEach(() => {
  verifyMock.mockReset();
  isOrgBoundMock.mockReset();
  isOrgBoundMock.mockResolvedValue(true);
  verifyMock.mockResolvedValue({
    id: "apk_test",
    type: "api_key",
    name: "test",
    subject: "org_test",
    scopes: [],
    claims: null,
    revoked: false,
    revocationReason: null,
    expired: false,
    expiration: null,
    createdBy: "user_test",
    description: null,
    lastUsedAt: null,
    createdAt: 0,
    updatedAt: 0,
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
