import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const limitMock = vi.fn();
const whereMock = vi.fn(() => ({ limit: limitMock }));
const fromMock = vi.fn(() => ({ where: whereMock }));
const selectMock = vi.fn(() => ({ from: fromMock }));

const updateWhereMock = vi.fn(() => Promise.resolve());
const updateSetMock = vi.fn(() => ({ where: updateWhereMock }));
const updateMock = vi.fn(() => ({ set: updateSetMock }));

vi.mock("@db/app/client", () => ({
  db: {
    select: () => selectMock(),
    update: () => updateMock(),
  },
}));

const { orpcRouter } = await import("../router");

const validKey = `sk-lf-${"a".repeat(43)}`;

beforeEach(() => {
  limitMock.mockReset();
  // Default: API key resolves successfully.
  limitMock.mockResolvedValue([
    {
      id: 1,
      publicId: "akey_test",
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
      expiresAt: null,
    },
  ]);
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
