import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

const migratedFiles = [
  "src/signals/signals-client.tsx",
  "src/signals/use-classified-signals-query.ts",
  "src/signals/use-signal-views-query.ts",
  "src/signals/signal-detail-sheet.tsx",
  "src/signals/signal-create-dialog.tsx",
] as const;

describe("migrated signal UI data access", () => {
  it("does not use tRPC for migrated signal rows, detail, or create", () => {
    for (const file of migratedFiles) {
      const source = readFileSync(resolve(appRoot, file), "utf8");
      expect(source, file).not.toContain("trpc.org.workspace.signals");
    }
  });

  it("removes tRPC hooks from fully migrated signal read components", () => {
    for (const file of [
      "src/signals/signals-client.tsx",
      "src/signals/use-classified-signals-query.ts",
      "src/signals/signal-detail-sheet.tsx",
    ] as const) {
      const source = readFileSync(resolve(appRoot, file), "utf8");
      expect(source, file).not.toContain("useTRPC");
    }
  });

  it("uses TanStack server functions for signal views", () => {
    const source = readFileSync(
      resolve(appRoot, "src/signals/use-signal-views-query.ts"),
      "utf8"
    );
    expect(source).toContain('@api/app/tanstack/signal-views"');
    expect(source).not.toContain("useTRPC");
    expect(source).not.toContain("trpc.org.workspace.signals.views");
  });
});
