import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";

import { openBrowser } from "../auth/browser";

describe("openBrowser", () => {
  it("attaches an error handler to spawned browser processes", () => {
    const child = Object.assign(new EventEmitter(), {
      unref: vi.fn(),
    });
    const spawn = vi.fn(() => child);

    openBrowser("https://app.lightfast.test", spawn as never);

    expect(child.listenerCount("error")).toBe(1);
    expect(() => child.emit("error", new Error("spawn failed"))).not.toThrow();
  });
});
