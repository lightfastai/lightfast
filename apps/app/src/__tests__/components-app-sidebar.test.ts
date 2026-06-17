import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");
const repoRoot = resolve(appRoot, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

function repoSource(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

describe("workspace sidebar", () => {
  it("keeps workspace navigation inline in app-sidebar", () => {
    const sidebarSource = source("src/components/app-sidebar.tsx");
    const sidebarModelPath = resolve(
      appRoot,
      "src/components/app-sidebar-model.ts"
    );

    expect(existsSync(sidebarModelPath)).toBe(false);
    expect(sidebarSource).not.toContain("app-sidebar-model");
    expect(sidebarSource).toContain(
      "const navSections: WorkspaceNavSection[] = ["
    );
    expect(sidebarSource).toContain('label: "Workspace"');
    expect(sidebarSource).toContain('title: "Automations"');
    expect(sidebarSource).toContain('title: "Decisions"');
    expect(sidebarSource).toContain('title: "Skills"');
    expect(sidebarSource).toContain('title: "Signals"');
    expect(sidebarSource).toContain('title: "People"');
    expect(sidebarSource).toContain('label: "Manage"');
    expect(sidebarSource).toContain('title: "Connectors"');
    expect(sidebarSource).toContain('title: "Developer Connections"');
    expect(sidebarSource).toContain('title: "Settings"');
    expect(sidebarSource).toContain("pathname === item.href");
    expect(sidebarSource).toContain(
      ["pathname.startsWith(`", "$", "{item.href}/`)"].join("")
    );
  });

  it("lets workspace routes own their shell while account routes use the basic shell", () => {
    const authenticatedRouteSource = source("src/routes/_authenticated.tsx");
    const authenticatedLayoutModelPath = resolve(
      appRoot,
      "src/components/authenticated-layout-model.ts"
    );

    expect(existsSync(authenticatedLayoutModelPath)).toBe(false);
    expect(authenticatedRouteSource).not.toContain(
      "authenticated-layout-model"
    );
    expect(authenticatedRouteSource).toContain(
      'const BASIC_SHELL_PREFIXES = ["/account", "/accounts"] as const'
    );
    expect(authenticatedRouteSource).toContain(
      ["pathname === prefix || pathname.startsWith(`", "$", "{prefix}/`)"].join(
        ""
      )
    );
    expect(authenticatedRouteSource).toContain("if (!usesBasicShell)");
  });

  it("uses Hugeicons for app-sidebar glyphs", () => {
    const sidebarSource = source("src/components/app-sidebar.tsx");

    expect(sidebarSource).toContain('from "@hugeicons/core-free-icons"');
    expect(sidebarSource).toContain('from "@hugeicons/react"');
    expect(sidebarSource).not.toContain('from "lucide-react"');
    expect(sidebarSource).toContain("HugeiconsIcon");
    expect(sidebarSource).toContain("navIcons");
  });

  it("renders recent chats as a standalone medium dropdown above workspace groups", () => {
    const sidebarSource = source("src/components/app-sidebar.tsx");
    const recentChatsMenuSource = source(
      "src/components/recent-chats-menu.tsx"
    );
    const dropdownMenuSource = repoSource(
      "packages/ui-v2/src/components/ui/dropdown-menu.tsx"
    );
    const scrollEdgeCueSource = repoSource(
      "packages/ui-v2/src/components/ui/scroll-edge-cue.tsx"
    );
    const recentsIndex = sidebarSource.indexOf("<RecentChatsMenu");
    const navSectionsIndex = sidebarSource.indexOf("{navSections.map");
    const menuGroupIndex = recentChatsMenuSource.indexOf("<DropdownMenuGroup>");
    const labelIndex = recentChatsMenuSource.indexOf("<DropdownMenuLabel");
    const menuGroupEndIndex = recentChatsMenuSource.indexOf(
      "</DropdownMenuGroup>"
    );

    expect(recentsIndex).toBeGreaterThan(-1);
    expect(navSectionsIndex).toBeGreaterThan(-1);
    expect(recentsIndex).toBeLessThan(navSectionsIndex);
    expect(sidebarSource).toContain(
      'import { RecentChatsMenu } from "./recent-chats-menu";'
    );
    expect(sidebarSource).toContain("function RecentChatsMenuTrigger");
    expect(sidebarSource).toContain('aria-label="Open recents"');
    expect(sidebarSource).toContain(">Recents</span>");
    expect(sidebarSource).toContain("trigger={<RecentChatsMenuTrigger />}");
    expect(sidebarSource).toContain("function RecentChatsMenuTrigger()");
    expect(sidebarSource).not.toContain("isRecentChatsActive");
    expect(sidebarSource).not.toContain("recentChatConversationPrefix");
    expect(sidebarSource).not.toContain(
      ["pathname === `/", "$", "{orgSlug}/chat`"].join("")
    );
    expect(sidebarSource).not.toContain("function RecentsDropdown");
    expect(recentChatsMenuSource).toContain("export function RecentChatsMenu");
    expect(recentChatsMenuSource).toContain("trigger: ReactNode");
    expect(recentChatsMenuSource).toContain("{trigger}");
    expect(recentChatsMenuSource).toContain(
      "onConversationSelect?: () => void"
    );
    expect(recentChatsMenuSource).not.toContain(
      'from "@repo/ui/components/ui/sidebar"'
    );
    expect(recentChatsMenuSource).not.toContain("SidebarMenu");
    expect(recentChatsMenuSource).not.toContain("SidebarMenuButton");
    expect(recentChatsMenuSource).not.toContain("SidebarMenuItem");
    expect(recentChatsMenuSource).not.toContain("useSidebar");
    expect(recentChatsMenuSource).toContain(
      '<DropdownMenuContent align="start" side="right" size="md">'
    );
    expect(recentChatsMenuSource).toContain("DropdownMenuGroup");
    expect(recentChatsMenuSource).not.toContain("DropdownMenuItemText");
    expect(menuGroupIndex).toBeGreaterThan(-1);
    expect(labelIndex).toBeGreaterThan(menuGroupIndex);
    expect(labelIndex).toBeLessThan(menuGroupEndIndex);
    expect(recentChatsMenuSource).toContain("DropdownMenuLabel");
    expect(recentChatsMenuSource).toContain(">Recent Chats</span>");
    expect(recentChatsMenuSource).not.toContain("DropdownMenuSeparator");
    expect(recentChatsMenuSource).not.toMatch(/(?:^|[\s"])p-0(?:[\s"]|$)/);
    expect(recentChatsMenuSource).not.toContain(
      'className="flex h-7 items-center gap-2 px-2"'
    );
    expect(recentChatsMenuSource).toContain("useState(false)");
    expect(recentChatsMenuSource).toContain("aria-expanded={expanded}");
    expect(recentChatsMenuSource).toContain('"Collapse recent chats"');
    expect(recentChatsMenuSource).toContain('"Expand recent chats"');
    expect(recentChatsMenuSource).toContain("ExpandIcon");
    expect(recentChatsMenuSource).toContain("CollapseIcon");
    expect(recentChatsMenuSource).toContain(
      "icon={expanded ? CollapseIcon : ExpandIcon}"
    );
    expect(recentChatsMenuSource).not.toContain("ArrowDown01Icon");
    expect(recentChatsMenuSource).not.toContain("ArrowUp01Icon");
    expect(recentChatsMenuSource).toContain("setExpanded((value) => !value)");
    expect(recentChatsMenuSource).toContain(
      'from "@repo/ui/components/ui/scroll-area"'
    );
    expect(recentChatsMenuSource).toContain("<ScrollArea");
    expect(recentChatsMenuSource).toContain(
      'from "@repo/ui-v2/components/ui/scroll-edge-cue"'
    );
    expect(recentChatsMenuSource).toContain("<ScrollEdgeCues>");
    expect(recentChatsMenuSource).not.toContain("function useScrollEdges");
    expect(recentChatsMenuSource).not.toContain("function ScrollEdgeCue");
    expect(recentChatsMenuSource).not.toContain("ChevronUpIcon");
    expect(recentChatsMenuSource).not.toContain("ChevronDownIcon");
    expect(scrollEdgeCueSource).toContain("export function ScrollEdgeCues");
    expect(scrollEdgeCueSource).toContain("function useScrollEdges");
    expect(scrollEdgeCueSource).toContain("function ScrollEdgeCue");
    expect(scrollEdgeCueSource).toContain("ChevronUpIcon");
    expect(scrollEdgeCueSource).toContain("ChevronDownIcon");
    expect(scrollEdgeCueSource).toContain("bg-gradient-to-b from-popover");
    expect(scrollEdgeCueSource).toContain("bg-gradient-to-t from-popover");
    expect(scrollEdgeCueSource).toContain('[data-slot="scroll-area-viewport"]');
    expect(recentChatsMenuSource).toContain('expanded ? "h-80" : "h-40"');
    expect(dropdownMenuSource).not.toContain("function DropdownMenuItemText");
    expect(dropdownMenuSource).not.toContain("truncate?: boolean");
    expect(recentChatsMenuSource).toContain(
      '"grid w-full min-w-0 max-w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)] overflow-hidden"'
    );
    expect(recentChatsMenuSource).toContain(
      'className="block min-w-0 truncate"'
    );
    expect(sidebarSource).not.toContain("<ChatHistory");
    expect(sidebarSource).not.toContain("function ChatHistory");
    expect(sidebarSource).not.toContain('label="Chats"');
    expect(sidebarSource).not.toContain('aria-label="Chats"');
  });
});
