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
    const decisionsViewQuerySource = decisionsViewSwitcherSource;

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
    expect(decisionsClientSource).toContain("<DecisionsViewHeader");
    expect(decisionsClientSource).toContain("<DecisionsToolbar");
    expect(decisionsClientSource).toContain("view: null");
    expect(decisionsClientSource.indexOf("<DecisionsViewHeader")).toBeLessThan(
      decisionsClientSource.indexOf("<DecisionsToolbar")
    );
    expect(decisionsToolbarSource).not.toContain("viewsSlot");
    expect(decisionsRouteSource).toContain('"view" in updates');
    expect(decisionsViewSwitcherSource).toContain("ViewSwitcher");
    expect(decisionsViewSwitcherSource).not.toContain("nuqs");
    expect(decisionsViewQuerySource).toContain(
      '@api/app/tanstack/decision-views"'
    );
    expect(decisionsViewQuerySource).not.toContain("useTRPC");
    expect(decisionsViewQuerySource).toContain(
      'enabled: typeof window !== "undefined"'
    );
  });

  it("renders secondary workspace page actions inside their owning pages", () => {
    const shellSource = source("src/workspace/workspace-route-shell.tsx");
    const topbarActionsPath = resolve(
      appRoot,
      "src/workspace/workspace-topbar-actions.tsx"
    );
    const authenticatedTopbarPath = resolve(
      appRoot,
      "src/components/authenticated-topbar.tsx"
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

    expect(existsSync(topbarActionsPath)).toBe(false);
    expect(existsSync(authenticatedTopbarPath)).toBe(false);
    expect(shellSource).not.toContain("AuthenticatedTopbar");
    expect(shellSource).not.toContain("useWorkspaceTopbarAction");
    expect(shellSource).not.toContain("workspaceTopbarAction");
    expect(shellSource).not.toContain("Docs");
    expect(shellSource).not.toContain("API Reference");

    for (const routeSource of [
      skillsRouteSource,
      connectorsRouteSource,
      peopleRouteSource,
      signalsRouteSource,
    ]) {
      expect(routeSource).not.toContain("workspaceTopbarAction");
    }

    expect(skillsClientSource).toContain('data-testid="skills-actions-row"');
    expect(skillsClientSource).toContain("<SkillsActions");
    expect(connectorsClientSource).toContain(
      'data-testid="connectors-actions-row"'
    );
    expect(connectorsClientSource).toContain("<ConnectorOwnerScopeTabs");
    expect(peopleClientSource).toContain("<PeopleViewHeader");
    expect(peopleClientSource).toContain("<PeopleViewSwitcher");
    expect(peopleClientSource).toContain("<PeopleToolbar");
    expect(peopleClientSource.indexOf("<PeopleViewHeader")).toBeLessThan(
      peopleClientSource.indexOf("<PeopleToolbar")
    );
    expect(peopleClientSource).not.toContain("viewsSlot=");
    expect(peopleToolbarSource).not.toContain("viewsSlot");
    expect(signalsClientSource).toContain("<SignalsViewHeader");
    expect(signalsClientSource).toContain("<SignalsViewSwitcher");
    expect(signalsClientSource).toContain("<SignalsToolbar");
    expect(signalsClientSource).toContain("onAddSignal={openCreateSignal}");
    expect(signalsClientSource.indexOf("<SignalsViewHeader")).toBeLessThan(
      signalsClientSource.indexOf("<SignalsToolbar")
    );
    expect(signalsClientSource).not.toContain("viewsSlot=");
    expect(signalsToolbarSource).not.toContain("viewsSlot");
    expect(signalsToolbarSource).not.toContain("onAddSignal");
    expect(signalsToolbarSource).not.toContain("Add Signal");
  });

  it("uses ui-v2 button defaults and Hugeicons for the signals add action", () => {
    const signalsClientSource = source("src/signals/signals-client.tsx");
    const addSignalButtons =
      signalsClientSource.match(
        /<Button\b[\s\S]*?Add Signal[\s\S]*?<\/Button>/g
      ) ?? [];

    expect(signalsClientSource).toContain(
      'from "@repo/ui-v2/components/ui/button"'
    );
    expect(signalsClientSource).toContain('from "@hugeicons/core-free-icons"');
    expect(signalsClientSource).toContain('from "@hugeicons/react"');
    expect(signalsClientSource).toContain("Add01Icon");
    expect(signalsClientSource).toContain("HugeiconsIcon");
    expect(signalsClientSource).not.toContain(
      'from "@repo/ui/components/ui/button"'
    );
    expect(addSignalButtons.length).toBeGreaterThan(0);
    for (const addSignalButton of addSignalButtons) {
      expect(addSignalButton).toContain('size="xs"');
      expect(addSignalButton).toContain('variant="outline"');
      expect(addSignalButton).toContain("HugeiconsIcon");
      expect(addSignalButton).not.toContain("className=");
    }
  });

  it("uses ui-v2 button defaults and Hugeicons for signal filters", () => {
    const signalsToolbarSource = source("src/signals/signals-toolbar.tsx");
    const filterTriggerButton =
      signalsToolbarSource.match(
        /<Button\b[\s\S]*?title="Filters"[\s\S]*?\/>/
      )?.[0] ?? "";
    const filterChipButtons =
      signalsToolbarSource.match(
        /<Button\s+aria-label={`Clear \$\{label\} filter`}[\s\S]*?<\/Button>/g
      ) ?? [];

    expect(signalsToolbarSource).toContain(
      'from "@repo/ui-v2/components/ui/button"'
    );
    expect(signalsToolbarSource).toContain('from "@hugeicons/core-free-icons"');
    expect(signalsToolbarSource).toContain('from "@hugeicons/react"');
    expect(signalsToolbarSource).toContain("HugeiconsIcon");
    for (const iconName of [
      "Cancel01Icon",
      "CheckListIcon",
      "FilterHorizontalIcon",
      "Flag01Icon",
      "Tag01Icon",
      "UserCheck01Icon",
    ]) {
      expect(signalsToolbarSource).toContain(iconName);
    }
    expect(signalsToolbarSource).not.toContain(
      'from "@repo/ui/components/ui/button"'
    );
    expect(signalsToolbarSource).not.toContain('from "lucide-react"');
    expect(filterTriggerButton).toContain('variant="outline"');
    expect(filterTriggerButton).toContain(
      'size={activeFilterCount > 0 ? "xs" : "icon-xs"}'
    );
    expect(filterTriggerButton).not.toContain("className=");
    expect(signalsToolbarSource).not.toContain("<button");
    expect(signalsToolbarSource).not.toContain("</button>");
    expect(filterChipButtons.length).toBeGreaterThan(0);
    for (const filterChipButton of filterChipButtons) {
      expect(filterChipButton).toContain('variant="outline"');
      expect(filterChipButton).toContain('size="xs"');
      expect(filterChipButton).toContain("HugeiconsIcon");
      expect(filterChipButton).not.toContain("className=");
    }
  });

  it("uses ui-v2 button defaults and Hugeicons for people and decision filters", () => {
    const toolbarChecks = [
      {
        icons: [
          "AtSignIcon",
          "Cancel01Icon",
          "FilterHorizontalIcon",
          "Tag01Icon",
        ],
        source: source("src/people/people-toolbar.tsx"),
      },
      {
        icons: [
          "Activity01Icon",
          "BoxesIcon",
          "Cancel01Icon",
          "FilterHorizontalIcon",
        ],
        source: source("src/decisions/decisions-toolbar.tsx"),
      },
    ];

    for (const { icons, source: toolbarSource } of toolbarChecks) {
      const filterTriggerButton =
        toolbarSource.match(
          /<Button\b[\s\S]*?title="Filters"[\s\S]*?\/>/
        )?.[0] ?? "";
      const filterChipButtons =
        toolbarSource.match(
          /<Button\s+aria-label={`Clear \$\{label\} filter`}[\s\S]*?<\/Button>/g
        ) ?? [];

      expect(toolbarSource).toContain(
        'from "@repo/ui-v2/components/ui/button"'
      );
      expect(toolbarSource).toContain('from "@hugeicons/core-free-icons"');
      expect(toolbarSource).toContain('from "@hugeicons/react"');
      expect(toolbarSource).toContain("HugeiconsIcon");
      for (const iconName of icons) {
        expect(toolbarSource).toContain(iconName);
      }
      expect(toolbarSource).not.toContain(
        'from "@repo/ui/components/ui/button"'
      );
      expect(toolbarSource).not.toContain('from "lucide-react"');
      expect(filterTriggerButton).toContain('variant="outline"');
      expect(filterTriggerButton).toContain(
        'size={activeFilterCount > 0 ? "xs" : "icon-xs"}'
      );
      expect(filterTriggerButton).not.toContain("className=");
      expect(toolbarSource).not.toContain("<button");
      expect(toolbarSource).not.toContain("</button>");
      expect(filterChipButtons.length).toBeGreaterThan(0);
      for (const filterChipButton of filterChipButtons) {
        expect(filterChipButton).toContain('variant="outline"');
        expect(filterChipButton).toContain('size="xs"');
        expect(filterChipButton).toContain("HugeiconsIcon");
        expect(filterChipButton).not.toContain("className=");
      }
    }
  });

  it("drops people and decision search controls and query params", () => {
    const decisionsClientSource = source("src/decisions/decisions-client.tsx");
    const decisionsRouteSource = source(
      "src/routes/_authenticated/$slug/decisions.tsx"
    );
    const decisionsSearchSource = source(
      "src/decisions/decisions-search-params.ts"
    );
    const decisionsToolbarSource = source(
      "src/decisions/decisions-toolbar.tsx"
    );
    const peopleClientSource = source("src/people/people-client.tsx");
    const peopleRouteSource = source(
      "src/routes/_authenticated/$slug/people.tsx"
    );
    const peopleSearchSource = source("src/people/people-search-params.ts");
    const peopleToolbarSource = source("src/people/people-toolbar.tsx");
    const peopleQuerySource = source("src/people/people-queries.ts");

    for (const toolbarSource of [peopleToolbarSource, decisionsToolbarSource]) {
      expect(toolbarSource).not.toContain("onQueryChange");
      expect(toolbarSource).not.toContain('role="searchbox"');
      expect(toolbarSource).not.toContain("Search01Icon");
      expect(toolbarSource).not.toContain("InputGroup");
      expect(toolbarSource).not.toContain(
        'from "@repo/ui/components/ui/input"'
      );
      expect(toolbarSource).not.toContain("Search people");
      expect(toolbarSource).not.toContain("Search decisions");
    }

    expect(peopleClientSource).not.toContain("useDeferredValue");
    expect(peopleClientSource).not.toContain("searchText");
    expect(peopleClientSource).not.toContain("peopleQuery: value");
    expect(peopleRouteSource).not.toContain("peopleQuery");
    expect(peopleSearchSource).not.toContain("peopleQuery");
    expect(peopleQuerySource).not.toContain("normalizedSearch");
    expect(peopleQuerySource).not.toContain("search:");

    expect(decisionsClientSource).not.toContain("useDeferredValue");
    expect(decisionsClientSource).not.toContain("searchText");
    expect(decisionsClientSource).not.toContain("q: value");
    expect(decisionsRouteSource).not.toContain('"q" in updates');
    expect(decisionsSearchSource).not.toContain("q?:");
    expect(decisionsSearchSource).not.toContain("q: string");
    expect(decisionsSearchSource).not.toContain("search.q");
    expect(decisionsClientSource).not.toContain("normalizedSearch");
    expect(decisionsClientSource).not.toContain("searchText");
    expect(decisionsClientSource).not.toContain("search: search");
  });

  it("ports former topbar left controls into route-owned page content", () => {
    const authenticatedShellSource = source("src/routes/_authenticated.tsx");
    const routeBoundariesSource = source("src/components/route-boundaries.tsx");
    const workspaceShellSource = source(
      "src/workspace/workspace-route-shell.tsx"
    );
    const accountLeftControlSources = [
      source("src/account/settings/account-settings-layout.tsx"),
      source("src/account/tasks/github-account-complete-client.tsx"),
      source("src/account/tasks/github-account-task-client.tsx"),
      source("src/account/tasks/username-account-task-client.tsx"),
      source("src/account/team-create-client.tsx"),
      source("src/routes/_authenticated/account/mcp.tsx"),
    ];
    const setupLeftControlSources = [
      source("src/org/setup/bind-github-card.tsx"),
      source("src/org/setup/github-bind-complete-client.tsx"),
      source("src/org/setup/lightfast-repo-setup-client.tsx"),
      source("src/org/setup/x-connector-setup-client.tsx"),
      source("src/org/setup/x-connector-setup-complete-client.tsx"),
      source("src/routes/_authenticated/$slug/tasks/index.tsx"),
    ];
    const workspaceLeftControlSources = [
      source("src/automations/automation-create-form.tsx"),
      source("src/automations/automation-detail-client.tsx"),
      source("src/automations/automations-client.tsx"),
      source("src/chat/workspace-assistant-client.tsx"),
      source("src/connectors/connectors-client.tsx"),
      source("src/decisions/decisions-client.tsx"),
      source("src/developer-connections/developer-connections-client.tsx"),
      source("src/people/people-client.tsx"),
      source("src/routes/_authenticated/$slug/settings.tsx"),
      source("src/signals/signals-client.tsx"),
      source("src/skills/skills-client.tsx"),
    ];

    expect(authenticatedShellSource).not.toContain("TeamSwitcherSlot");
    expect(workspaceShellSource).not.toContain("TeamSwitcherSlot");
    expect(workspaceShellSource).not.toContain("SidebarTrigger");
    expect(routeBoundariesSource).toContain("MobileSidebarFallbackTrigger");
    expect(routeBoundariesSource).toContain("SidebarTrigger");
    expect(routeBoundariesSource).toContain("WorkspaceRoutePending");
    expect(routeBoundariesSource).toContain("WorkspaceRouteErrorPanel");
    expect(routeBoundariesSource).toContain("AutomationFormRoutePending");

    for (const pageSource of [
      ...accountLeftControlSources,
      ...setupLeftControlSources,
    ]) {
      expect(pageSource).toContain("TeamSwitcherSlot");
    }

    for (const pageSource of workspaceLeftControlSources) {
      expect(pageSource).toContain("SidebarTrigger");
      expect(pageSource).toContain("md:hidden");
    }
  });

  it("wraps Base UI dropdown submenu labels in menu groups", () => {
    for (const toolbarSource of [
      source("src/decisions/decisions-toolbar.tsx"),
      source("src/people/people-toolbar.tsx"),
      source("src/signals/signals-toolbar.tsx"),
    ]) {
      const groupIndex = toolbarSource.indexOf("<DropdownMenuGroup>");
      const labelIndex = toolbarSource.indexOf("<DropdownMenuLabel");
      const groupEndIndex = toolbarSource.indexOf("</DropdownMenuGroup>");

      expect(toolbarSource).toContain("DropdownMenuGroup");
      expect(groupIndex).toBeGreaterThan(-1);
      expect(labelIndex).toBeGreaterThan(groupIndex);
      expect(groupEndIndex).toBeGreaterThan(labelIndex);
    }
  });

  it("uses ui-v2 button defaults for the shared view switcher", () => {
    const viewSwitcherSource = source("src/components/views/view-switcher.tsx");
    const buttonOpenTags = viewSwitcherSource.match(/<Button\b[^>]*>/g) ?? [];

    expect(viewSwitcherSource).toContain(
      'from "@repo/ui-v2/components/ui/button"'
    );
    expect(viewSwitcherSource).toContain('from "@hugeicons/core-free-icons"');
    expect(viewSwitcherSource).toContain('from "@hugeicons/react"');
    expect(viewSwitcherSource).toContain("HugeiconsIcon");
    expect(viewSwitcherSource).not.toContain(
      'from "@repo/ui/components/ui/button"'
    );
    expect(viewSwitcherSource).not.toContain('from "lucide-react"');
    expect(viewSwitcherSource).not.toContain('from "@repo/ui/lib/utils"');
    expect(viewSwitcherSource).not.toContain("cn(");
    expect(viewSwitcherSource).not.toContain("<button");
    expect(buttonOpenTags.length).toBeGreaterThan(0);
    for (const buttonOpenTag of buttonOpenTags) {
      expect(buttonOpenTag).not.toContain("className=");
    }
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
