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
    const backButtonPath = resolve(appRoot, "src/components/back-button.tsx");
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

    expect(existsSync(backButtonPath)).toBe(false);
    expect(createFormSource).not.toContain("~/components/back-button");
    expect(detailClientSource).not.toContain("~/components/back-button");
    expect(createFormSource).not.toContain("BackButton");
    expect(detailClientSource).not.toContain("BackButton");
    expect(createFormSource).toContain('to="/$slug/automations"');
    expect(detailClientSource).toContain('to="/$slug/automations"');
    expect(createFormSource).toContain("ChevronLeft");
    expect(detailClientSource).toContain("ChevronLeft");
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

  it("renders secondary workspace page actions in the authenticated topbar slot", () => {
    const shellSource = source("src/workspace/workspace-route-shell.tsx");
    const topbarActionsSource = expectSource(
      "src/workspace/workspace-topbar-actions.tsx"
    );
    const skillsRouteSource = source(
      "src/routes/_authenticated/$slug/skills.tsx"
    );
    const connectorsRouteSource = source(
      "src/routes/_authenticated/$slug/connectors.tsx"
    );
    const peopleRouteSource = source(
      "src/routes/_authenticated/$slug/people.tsx"
    );
    const signalsRouteSource = source(
      "src/routes/_authenticated/$slug/signals.tsx"
    );
    const skillsClientSource = source("src/skills/skills-client.tsx");
    const connectorsClientSource = source(
      "src/connectors/connectors-client.tsx"
    );
    const peopleClientSource = source("src/people/people-client.tsx");
    const peopleToolbarSource = source("src/people/people-toolbar.tsx");
    const signalsClientSource = source("src/signals/signals-client.tsx");
    const signalsToolbarSource = source("src/signals/signals-toolbar.tsx");

    expect(shellSource).toContain("useWorkspaceTopbarAction");
    expect(shellSource).toContain("actions={workspaceTopbarAction}");
    expect(topbarActionsSource).toContain("useMatches");
    expect(topbarActionsSource).toContain("workspaceTopbarAction");
    expect(topbarActionsSource).toContain("ConnectorsTopbarActions");
    expect(topbarActionsSource).toContain("PeopleTopbarActions");
    expect(topbarActionsSource).toContain("SkillsTopbarActions");
    expect(topbarActionsSource).toContain("SignalsTopbarActions");
    expect(topbarActionsSource).toContain(
      'getRouteApi("/_authenticated/$slug/connectors")'
    );
    expect(topbarActionsSource).toContain(
      'getRouteApi("/_authenticated/$slug/people")'
    );
    expect(topbarActionsSource).toContain(
      'getRouteApi("/_authenticated/$slug/skills")'
    );
    expect(topbarActionsSource).toContain(
      'getRouteApi("/_authenticated/$slug/signals")'
    );
    expect(topbarActionsSource).toContain("ConnectorOwnerScopeTabs");
    expect(topbarActionsSource).toContain("PeopleViewSwitcher");
    expect(topbarActionsSource).toContain("SkillsActions");
    expect(topbarActionsSource).toContain("SignalsViewSwitcher");

    expect(skillsRouteSource).toContain(
      'staticData: { workspaceTopbarAction: "skills" }'
    );
    expect(connectorsRouteSource).toContain(
      'staticData: { workspaceTopbarAction: "connectors" }'
    );
    expect(peopleRouteSource).toContain(
      'staticData: { workspaceTopbarAction: "people" }'
    );
    expect(signalsRouteSource).toContain(
      'staticData: { workspaceTopbarAction: "signals" }'
    );

    expect(skillsClientSource).not.toContain(
      'data-testid="skills-actions-row"'
    );
    expect(skillsClientSource).not.toContain("<SkillsActions");
    expect(connectorsClientSource).not.toContain(
      'data-testid="connectors-actions-row"'
    );
    expect(connectorsClientSource).not.toContain("<ConnectorOwnerScopeTabs");
    expect(peopleClientSource).not.toContain("<PeopleViewSwitcher");
    expect(peopleClientSource).not.toContain("viewsSlot=");
    expect(peopleToolbarSource).not.toContain("viewsSlot");
    expect(signalsClientSource).not.toContain("<SignalsViewSwitcher");
    expect(signalsClientSource).not.toContain("viewsSlot=");
    expect(signalsToolbarSource).not.toContain("viewsSlot");
  });

  it("lets automation child routes own document titles", () => {
    const layoutRouteSource = source(
      "src/routes/_authenticated/$slug/automations.tsx"
    );
    const indexRouteSource = source(
      "src/routes/_authenticated/$slug/automations/index.tsx"
    );
    const newRouteSource = source(
      "src/routes/_authenticated/$slug/automations/new.tsx"
    );
    const detailRouteSource = source(
      "src/routes/_authenticated/$slug/automations/$automation.tsx"
    );

    expect(layoutRouteSource).toContain("component: Outlet");
    expect(layoutRouteSource).not.toContain("head:");
    expect(indexRouteSource).toContain("Automations -");
    expect(newRouteSource).toContain("New automation -");
    expect(detailRouteSource).toContain("Automation -");
  });
});
