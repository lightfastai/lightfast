import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(import.meta.dirname, "..");

describe("workspace signals tRPC router", () => {
  it("does not expose migrated signal data or views over tRPC", () => {
    const rootSource = readFileSync(resolve(apiRoot, "root.ts"), "utf8");

    expect(rootSource).not.toContain("workspaceSignalsRouter");
    expect(rootSource).not.toContain("signals: workspaceSignalsRouter");
    expect(
      existsSync(
        resolve(apiRoot, "router/(pending-not-allowed)/workspace-signals.ts")
      )
    ).toBe(false);
    expect(
      existsSync(
        resolve(
          apiRoot,
          "router/(pending-not-allowed)/workspace-signal-views.ts"
        )
      )
    ).toBe(false);

    const tanstackSource = readFileSync(
      resolve(apiRoot, "adapters/tanstack/signals.ts"),
      "utf8"
    );

    expect(tanstackSource).toContain("listProcessingSignals");
    expect(tanstackSource).toContain("listWorkingSetSignals");
    expect(tanstackSource).toContain("getSignal");
    expect(tanstackSource).toContain("createSignal");
  });
});
