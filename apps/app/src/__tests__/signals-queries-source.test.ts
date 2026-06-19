import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");
const repoRoot = resolve(appRoot, "../..");

describe("signals query helpers", () => {
  it("keeps signal keys and result types without a query-options abstraction", () => {
    const queriesPath = resolve(appRoot, "src/signals/signals-queries.ts");
    const cacheSource = readFileSync(
      resolve(appRoot, "src/signals/signals-cache.ts"),
      "utf8"
    );

    expect(existsSync(queriesPath)).toBe(false);
    expect(cacheSource).toContain('@api/app/tanstack/signals"');
    expect(cacheSource).toContain("signalQueryKeys");
    expect(cacheSource).toContain("ProcessingSignalsResult");
    expect(cacheSource).toContain("WorkingSetSignalsResult");
    expect(cacheSource).toContain("SignalDetailQueryResult");
    expect(cacheSource).not.toContain("queryOptions");
    expect(cacheSource).not.toContain("signalDetailQueryOptions");
    expect(cacheSource).not.toContain("workingSetSignalsQueryOptions");
    expect(cacheSource).not.toContain("processingSignalsQueryOptions");
    expect(cacheSource).not.toContain("getSignal");
    expect(cacheSource).not.toContain("listWorkingSetSignals");
    expect(cacheSource).not.toContain("listProcessingSignals");
    expect(cacheSource).not.toContain("createSignalMutationOptions");
    expect(cacheSource).not.toContain("createSignal,");
    expect(cacheSource).not.toContain("useTRPC");
  });

  it("keeps detail reads inline at the query call sites", () => {
    const clientSource = readFileSync(
      resolve(appRoot, "src/signals/signals-client.tsx"),
      "utf8"
    );
    const detailSheetSource = readFileSync(
      resolve(appRoot, "src/signals/signal-detail-sheet.tsx"),
      "utf8"
    );
    const peopleDetailSource = readFileSync(
      resolve(appRoot, "src/people/people-detail-content.tsx"),
      "utf8"
    );

    for (const source of [
      clientSource,
      detailSheetSource,
      peopleDetailSource,
    ]) {
      expect(source).toContain('@api/app/tanstack/signals"');
      expect(source).toContain("getSignal");
      expect(source).toContain("signalQueryKeys.detail");
      expect(source).not.toContain("signalDetailQueryOptions");
      expect(source).not.toContain("signals-queries");
    }
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
