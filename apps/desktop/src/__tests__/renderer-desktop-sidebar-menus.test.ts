import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readOptional(pathname: string) {
  const file = new URL(pathname, import.meta.url);
  if (!existsSync(file)) {
    return "";
  }

  return readFileSync(file, "utf8");
}

const desktopShell = readFileSync(
  new URL("../renderer/src/react/desktop-shell.tsx", import.meta.url),
  "utf8"
);
const appSidebar = readFileSync(
  new URL("../renderer/src/react/components/app-sidebar.tsx", import.meta.url),
  "utf8"
);
const teamMenu = readOptional("../renderer/src/react/components/team-menu.tsx");
const userMenu = readFileSync(
  new URL("../renderer/src/react/components/user-menu.tsx", import.meta.url),
  "utf8"
);
const ipc = readFileSync(new URL("../shared/ipc.ts", import.meta.url), "utf8");
const preloadBridge = readFileSync(
  new URL("../preload/build-bridge.ts", import.meta.url),
  "utf8"
);
const mainIndex = readFileSync(
  new URL("../main/index.ts", import.meta.url),
  "utf8"
);
const appUrl = readFileSync(
  new URL("../main/app-url.ts", import.meta.url),
  "utf8"
);
const storybookStories = new URL(
  "../../../storybook/stories/",
  import.meta.url
);

describe("desktop sidebar menus", () => {
  it("replaces the Lightfast logo with a single active team menu", () => {
    expect(desktopShell).toContain('from "./components/app-sidebar";');
    expect(appSidebar).toContain('import { TeamMenu } from "./team-menu";');
    expect(appSidebar).toContain("<TeamMenu />");
    expect(appSidebar).not.toContain("LightfastMark");
    expect(appSidebar).not.toContain('viewBox="0 0 129.334 129.334"');

    expect(teamMenu).toContain("@repo/ui-v2/components/ui/avatar");
    expect(teamMenu).toContain("@repo/ui-v2/components/ui/dropdown-menu");
    expect(teamMenu).toContain("@repo/ui-v2/components/ui/sidebar");
    expect(teamMenu).toContain("render={");
    expect(teamMenu).toContain("<SidebarMenuButton");
    expect(teamMenu).toContain(
      'className="cursor-default rounded-md [-webkit-app-region:no-drag]"'
    );
    expect(teamMenu).not.toContain('shape="square"');
    expect(teamMenu).toContain('size="lg"');
    expect(teamMenu).toContain('className="z-100 w-56"');
    expect(teamMenu).toContain("organizationName");
    expect(teamMenu).toContain("Team Settings");
    expect(teamMenu).toContain('"/account/settings/general"');
    expect(teamMenu).not.toContain("function getInitials");
    expect(teamMenu).not.toContain("fallbackTeamSettingsPath");
    expect(teamMenu).not.toContain("teamSettingsPath");
    expect(teamMenu).not.toContain("@repo/ui/components/ui");
    expect(teamMenu).not.toContain("asChild");
    expect(teamMenu).not.toContain("@repo/ui-v2/components/ui/button");
    expect(teamMenu).not.toContain('variant="square"');
    expect(teamMenu).not.toContain("size={");
    expect(teamMenu).not.toContain("rounded-full");
    expect(teamMenu).not.toContain("bg-");
    expect(teamMenu).not.toContain("text-");
    expect(teamMenu).not.toContain("listUserOrganizations");
    expect(teamMenu).not.toContain("Create Team");
  });

  it("uses the app-style user menu in the sidebar bottom-left trigger", () => {
    expect(appSidebar).toContain('import { UserMenu } from "./user-menu";');
    expect(appSidebar).toContain("<UserMenu />");
    expect(userMenu).toContain("@repo/ui-v2/components/ui/avatar");
    expect(userMenu).toContain("@repo/ui-v2/components/ui/dropdown-menu");
    expect(userMenu).toContain("@repo/ui-v2/components/ui/sidebar");
    expect(userMenu).toContain("render={");
    expect(userMenu).toContain("<SidebarMenuButton");
    expect(userMenu).toContain(
      'className="cursor-default rounded-md [-webkit-app-region:no-drag]"'
    );
    expect(userMenu).not.toContain('shape="square"');
    expect(userMenu).toContain('size="lg"');
    expect(userMenu).toContain('className="z-100 w-56"');
    expect(userMenu).toContain("AvatarFallback");
    expect(userMenu).toContain(
      'const primaryIdentity = auth.userUsername ?? "User";'
    );
    expect(userMenu).toContain('const initials = auth.userInitials ?? "U";');
    expect(userMenu).not.toContain("identityLines");
    expect(userMenu).not.toContain("getInitials");
    expect(userMenu).not.toContain("query.data");
    expect(userMenu).not.toContain("viewer.account.get");
    expect(userMenu).not.toContain("useQuery");
    expect(userMenu).not.toContain("useTRPC");
    expect(userMenu).toContain("Settings");
    expect(userMenu).toContain('openWindow("settings")');
    expect(userMenu).not.toContain("Account Settings");
    expect(userMenu).toContain("Help");
    expect(userMenu).toContain("DropdownMenuSub");
    expect(userMenu).toContain("DropdownMenuSubTrigger");
    expect(userMenu).toContain("DropdownMenuSubContent");
    expect(userMenu).toContain("Help Docs");
    expect(userMenu).toContain("Contact Support");
    expect(userMenu).toContain("Send Feedback");
    expect(userMenu).toContain("Sign out");
    expect(userMenu).toContain(
      "https://lightfast.ai/docs/get-started/overview"
    );
    expect(userMenu).toContain("mailto:support@lightfast.ai");
    expect(userMenu).not.toContain("openAppPath");
    expect(userMenu).not.toContain('"/account/settings/general"');
    expect(userMenu).not.toContain("menuIconClass");
    expect(userMenu).not.toContain("ACCOUNT_SETTINGS_PATH");
    expect(userMenu).not.toContain("HELP_DOCS_URL");
    expect(userMenu).not.toContain("SUPPORT_MAILTO_URL");
    expect(userMenu).not.toContain("FEEDBACK_MAILTO_URL");
    expect(userMenu).not.toContain("@repo/ui/components/ui");
    expect(userMenu).not.toContain("@repo/ui-v2/components/ui/button");
    expect(userMenu).not.toContain("asChild");
    expect(userMenu).not.toContain('variant="square"');
    expect(userMenu).not.toContain("size={");
    expect(userMenu).not.toContain('variant="destructive"');
    expect(userMenu).not.toContain("[&_svg]:text-destructive");
    expect(userMenu).not.toContain("rounded-full");
  });

  it("opens desktop settings and web app paths from menu items", () => {
    expect(ipc).toContain('openWindow: channel("open-window")');
    expect(ipc).toContain("openWindow: (kind: WindowKind) => Promise<void>;");
    expect(preloadBridge).toContain("openWindow: (kind) =>");
    expect(preloadBridge).toContain("IpcChannels.openWindow");
    expect(userMenu).toContain('openWindow("settings")');
    expect(ipc).toContain('openAppPath: channel("open-app-path")');
    expect(ipc).toContain("openAppPath: (path: string) => Promise<void>;");
    expect(preloadBridge).toContain("openAppPath: (path) =>");
    expect(preloadBridge).toContain("IpcChannels.openAppPath");
    expect(teamMenu).toContain("openAppPath");
    expect(mainIndex).toContain("IpcChannels.openAppPath");
    expect(appUrl).toContain("openAppPath(path: string)");
  });

  it("keeps Storybook scoped to ui-v2 package components", () => {
    expect(readdirSync(storybookStories).sort()).toEqual(
      expect.arrayContaining([
        "button.stories.tsx",
        "dropdown-menu.stories.tsx",
        "input.stories.tsx",
        "sheet.stories.tsx",
        "sidebar.stories.tsx",
        "skeleton.stories.tsx",
      ])
    );
  });
});
