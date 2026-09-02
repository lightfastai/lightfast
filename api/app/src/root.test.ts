import { describe, expect, it } from "vitest";

import { createApiContext } from "./context";
import { appRouter } from "./root";

describe("API foundation", () => {
  it("exposes deterministic health through the root router", async () => {
    const context = createApiContext({
      now: () => new Date("2026-09-02T00:00:00.000Z"),
      requestId: "request_test",
    });

    await expect(appRouter.health.check(context)).resolves.toEqual({
      requestId: "request_test",
      status: "ok",
      timestamp: "2026-09-02T00:00:00.000Z",
      version: "0.1.0",
    });
  });
});
