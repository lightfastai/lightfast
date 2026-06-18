import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

const migratedFiles = [
  "src/signals/signals-client.tsx",
  "src/signals/use-classified-signals-query.ts",
  "src/signals/signals-view-switcher.tsx",
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
    const hookPath = resolve(appRoot, "src/signals/use-signal-views-query.ts");
    const source = readFileSync(
      resolve(appRoot, "src/signals/signals-view-switcher.tsx"),
      "utf8"
    );

    expect(existsSync(hookPath)).toBe(false);
    expect(source).toContain('@api/app/tanstack/signal-views"');
    expect(source).not.toContain("useTRPC");
    expect(source).not.toContain("trpc.org.workspace.signals.views");
    expect(source).not.toContain("./use-signal-views-query");
  });

  it("uses ui-v2 sheet primitives for signal details", () => {
    const detailSheetSource = readFileSync(
      resolve(appRoot, "src/signals/signal-detail-sheet.tsx"),
      "utf8"
    );
    const detailContentSource = readFileSync(
      resolve(appRoot, "src/signals/signal-detail-content.tsx"),
      "utf8"
    );
    const buttonOpenTags =
      `${detailSheetSource}\n${detailContentSource}`.match(
        /<Button\b[^>]*>/g
      ) ?? [];

    expect(detailSheetSource).toContain(
      'from "@repo/ui-v2/components/ui/button"'
    );
    expect(detailSheetSource).toContain(
      'from "@repo/ui-v2/components/ui/sheet"'
    );
    expect(detailContentSource).toContain(
      'from "@repo/ui-v2/components/ui/badge"'
    );
    expect(detailContentSource).toContain(
      'from "@repo/ui-v2/components/ui/button"'
    );

    for (const source of [detailSheetSource, detailContentSource]) {
      expect(source).not.toContain('from "@repo/ui/components/ui/button"');
      expect(source).not.toContain('from "@repo/ui/components/ui/badge"');
      expect(source).not.toContain('from "@repo/ui/components/ui/sheet"');
      expect(source).not.toContain('from "lucide-react"');
    }

    expect(detailSheetSource).not.toContain("SheetClose asChild");
    expect(detailSheetSource).not.toMatch(/<SheetContent\b[^>]*className=/);
    expect(detailSheetSource).not.toContain("const query = useQuery");
    expect(detailSheetSource).not.toContain("function handleCopyLink");
    expect(detailSheetSource).toContain("onCopyLink={copySignalLink}");
    expect(buttonOpenTags.length).toBeGreaterThan(0);
    for (const buttonOpenTag of buttonOpenTags) {
      expect(buttonOpenTag).not.toContain("className=");
    }
  });
});
