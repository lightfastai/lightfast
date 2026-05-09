import { describe, expect, it } from "vitest";
import { systemRouter } from "../router/system/health";
import { createCallerFactory } from "../trpc";

const createCaller = createCallerFactory(systemRouter);

describe("system.health", () => {
  it("returns ok under service auth with caller passed through", async () => {
    const caller = createCaller({
      auth: { type: "service", caller: "app" },
      headers: new Headers(),
    });
    const result = await caller.health();
    expect(result.status).toBe("ok");
    expect(result.caller).toBe("app");
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("throws UNAUTHORIZED under unauthenticated context", async () => {
    const caller = createCaller({
      auth: { type: "unauthenticated" },
      headers: new Headers(),
    });
    await expect(caller.health()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("throws UNAUTHORIZED under internal context (HTTP-only procedure)", async () => {
    const caller = createCaller({
      auth: { type: "internal", source: "test" },
      headers: new Headers(),
    });
    await expect(caller.health()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
