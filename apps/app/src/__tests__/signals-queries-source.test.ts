import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

describe("signals query helpers", () => {
  it("centralizes migrated signal query keys and server function calls", () => {
    const source = readFileSync(
      resolve(appRoot, "src/signals/signals-queries.ts"),
      "utf8"
    );

    expect(source).toContain('@api/app/tanstack/signals"');
    expect(source).toContain("signalQueryKeys");
    expect(source).toContain("workingSetSignalsQueryOptions");
    expect(source).toContain("processingSignalsQueryOptions");
    expect(source).toContain("signalDetailQueryOptions");
    expect(source).toContain("createSignalMutationOptions");
    expect(source).not.toContain("useTRPC");
  });
});
