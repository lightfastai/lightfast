import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");
const repoRoot = resolve(appRoot, "../..");

describe("signals query helpers", () => {
  it("keeps signal keys, result types, and shared detail query options", () => {
    const source = readFileSync(
      resolve(appRoot, "src/signals/signals-queries.ts"),
      "utf8"
    );

    expect(source).toContain('@api/app/tanstack/signals"');
    expect(source).toContain("signalQueryKeys");
    expect(source).toContain("signalDetailQueryOptions");
    expect(source).not.toContain("workingSetSignalsQueryOptions");
    expect(source).not.toContain("processingSignalsQueryOptions");
    expect(source).not.toContain("listWorkingSetSignals,");
    expect(source).not.toContain("listProcessingSignals,");
    expect(source).not.toContain("createSignalMutationOptions");
    expect(source).not.toContain("createSignal,");
    expect(source).not.toContain("useTRPC");
  });

  it("keeps signal creation on a direct api/app server function import", () => {
    const source = readFileSync(
      resolve(appRoot, "src/signals/signal-create-dialog.tsx"),
      "utf8"
    );

    expect(source).toContain('@api/app/tanstack/signals"');
    expect(source).toContain("createSignal");
    expect(source).toContain("type CreateSignalInput");
    expect(source).toContain("signalQueryKeys");
    expect(source).not.toContain("createSignalMutationOptions");
  });

  it("exports explicit signal creation contracts from api/app", () => {
    const source = readFileSync(
      resolve(repoRoot, "api/app/src/adapters/tanstack/signals.ts"),
      "utf8"
    );

    expect(source).toContain("export type CreateSignalInput");
    expect(source).toContain("export type CreateSignalResult");
  });
});
