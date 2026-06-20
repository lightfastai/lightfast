import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");
const repoRoot = resolve(appRoot, "../..");

describe("signals query helpers", () => {
  it("removes the signal cache module instead of hiding simple query keys", () => {
    const queriesPath = resolve(appRoot, "src/signals/signals-queries.ts");
    const cachePath = resolve(appRoot, "src/signals/signals-cache.ts");
    const modelSource = readFileSync(
      resolve(appRoot, "src/signals/signals-model.ts"),
      "utf8"
    );

    expect(existsSync(queriesPath)).toBe(false);
    expect(existsSync(cachePath)).toBe(false);
    expect(modelSource).toContain('@api/app/tanstack/signals"');
    expect(modelSource).not.toContain('from "./signals-cache"');
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
      expect(source).toContain('"signals", "detail"');
      expect(source).not.toContain("signalQueryKeys");
      expect(source).not.toContain("signals-cache");
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
    expect(source).toContain('queryKey: ["signals"] as const');
    expect(source).not.toContain("signalQueryKeys");
    expect(source).not.toContain("signals-cache");
    expect(source).not.toContain("createSignalMutationOptions");
  });

  it("keeps list query keys local to the workspace data hook", () => {
    const source = readFileSync(
      resolve(appRoot, "src/signals/use-signals-workspace-data.ts"),
      "utf8"
    );

    expect(source).toContain(
      'const workingSetQueryKey = ["signals", "working-set"] as const'
    );
    expect(source).toContain("const processingQueryKey = [");
    expect(source).toContain('"signals",');
    expect(source).toContain('"processing",');
    expect(source).not.toContain("signalQueryKeys");
    expect(source).not.toContain("signals-cache");
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
