import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

function expectSource(path: string) {
  expect(existsSync(resolve(appRoot, path)), `${path} should exist`).toBe(true);
  return source(path);
}

describe("workspace page-owned actions", () => {
  it("replaces the Next @actions slot with colocated TanStack page actions", () => {
    const backButtonSource = expectSource("src/components/back-button.tsx");
    const createFormSource = source(
      "src/automations/automation-create-form.tsx"
    );
    const detailClientSource = source(
      "src/automations/automation-detail-client.tsx"
    );
    const detailRouteSource = source(
      "src/routes/_authenticated/$slug/automations/$automation.tsx"
    );
    const decisionsClientSource = source("src/decisions/decisions-client.tsx");
    const decisionsToolbarSource = source(
      "src/decisions/decisions-toolbar.tsx"
    );
    const decisionsRouteSource = source(
      "src/routes/_authenticated/$slug/decisions.tsx"
    );
    const decisionsViewSwitcherSource = expectSource(
      "src/decisions/decisions-view-switcher.tsx"
    );
    const decisionsViewQuerySource = expectSource(
      "src/decisions/use-decision-views-query.ts"
    );

    expect(backButtonSource).toContain("@tanstack/react-router");
    expect(backButtonSource).toContain("ChevronLeft");
    expect(createFormSource).toContain("BackButton");
    expect(detailClientSource).toContain("BackButton");
    expect(detailRouteSource).toContain("slug={slug}");

    expect(decisionsClientSource).toContain("DecisionsViewSwitcher");
    expect(decisionsClientSource).toContain("view: null");
    expect(decisionsToolbarSource).toContain("viewsSlot");
    expect(decisionsRouteSource).toContain('"view" in updates');
    expect(decisionsViewSwitcherSource).toContain("ViewSwitcher");
    expect(decisionsViewSwitcherSource).not.toContain("nuqs");
    expect(decisionsViewQuerySource).toContain(
      "decisions.views.list.queryOptions"
    );
    expect(decisionsViewQuerySource).toContain(
      'enabled: typeof window !== "undefined"'
    );
  });
});
