export type WorkspaceRouteTo =
  | "/$slug/automations"
  | "/$slug/chat"
  | "/$slug/connectors"
  | "/$slug/decisions"
  | "/$slug/developer-connections"
  | "/$slug/people"
  | "/$slug/settings"
  | "/$slug/signals"
  | "/$slug/skills";

export type WorkspaceNavTitle =
  | "Automations"
  | "Connectors"
  | "Decisions"
  | "Developer Connections"
  | "People"
  | "Settings"
  | "Signals"
  | "Skills";

export interface WorkspaceNavItem {
  href: string;
  title: WorkspaceNavTitle;
  to: WorkspaceRouteTo;
}

export interface WorkspaceNavSection {
  items: WorkspaceNavItem[];
  label?: string;
}

export function getWorkspaceNavSections(slug: string): WorkspaceNavSection[] {
  return [
    {
      items: [
        workspaceItem(slug, "Automations", "/$slug/automations"),
        workspaceItem(slug, "Connectors", "/$slug/connectors"),
        workspaceItem(
          slug,
          "Developer Connections",
          "/$slug/developer-connections"
        ),
        workspaceItem(slug, "Skills", "/$slug/skills"),
        workspaceItem(slug, "Decisions", "/$slug/decisions"),
      ],
    },
    {
      label: "Workspace",
      items: [
        workspaceItem(slug, "Signals", "/$slug/signals"),
        workspaceItem(slug, "People", "/$slug/people"),
      ],
    },
    {
      label: "Manage",
      items: [workspaceItem(slug, "Settings", "/$slug/settings")],
    },
  ];
}

export function isWorkspacePathActive(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function workspaceItem(
  slug: string,
  title: WorkspaceNavTitle,
  to: WorkspaceRouteTo
): WorkspaceNavItem {
  return {
    href: to.replace("$slug", slug),
    title,
    to,
  };
}
