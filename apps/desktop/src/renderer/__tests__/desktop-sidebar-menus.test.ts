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
  new URL("../src/react/desktop-shell.tsx", import.meta.url),
  "utf8"
);
const teamMenu = readOptional("../src/react/team-menu.tsx");
const userMenu = readFileSync(
  new URL("../src/react/user-menu.tsx", import.meta.url),
  "utf8"
);
const button = readFileSync(
  new URL(
    "../../../../../packages/ui-v2/src/components/ui/button.tsx",
    import.meta.url
  ),
  "utf8"
);
const ipc = readFileSync(
  new URL("../../shared/ipc.ts", import.meta.url),
  "utf8"
);
const preloadBridge = readFileSync(
  new URL("../../preload/build-bridge.ts", import.meta.url),
  "utf8"
);
const mainIndex = readFileSync(
  new URL("../../main/index.ts", import.meta.url),
  "utf8"
);
const appUrl = readFileSync(
  new URL("../../main/app-url.ts", import.meta.url),
  "utf8"
);
const storybookStories = new URL(
  "../../../../storybook/stories/",
  import.meta.url
);

describe("desktop sidebar menus", () => {
  it("replaces the Lightfast logo with a single active team menu", () => {
    expect(desktopShell).toContain('import { TeamMenu } from "./team-menu";');
    expect(desktopShell).toContain("<TeamMenu />");
    expect(desktopShell).not.toContain("LightfastMark");
    expect(desktopShell).not.toContain('viewBox="0 0 129.334 129.334"');

    expect(teamMenu).toContain("@repo/ui-v2/components/ui/avatar");
    expect(teamMenu).toContain("@repo/ui-v2/components/ui/button");
    expect(teamMenu).toContain("@repo/ui-v2/components/ui/dropdown-menu");
    expect(teamMenu).toContain("render={");
    expect(teamMenu).toContain("<Button");
    expect(teamMenu).toContain('variant="square"');
    expect(teamMenu).toContain("organizationName");
    expect(teamMenu).toContain("Team Settings");
    expect(teamMenu).toContain('"/account/settings/general"');
    expect(teamMenu).not.toContain("function getInitials");
    expect(teamMenu).not.toContain("fallbackTeamSettingsPath");
    expect(teamMenu).not.toContain("teamSettingsPath");
    expect(teamMenu).not.toContain("@repo/ui/components/ui");
    expect(teamMenu).not.toContain("asChild");
    expect(teamMenu).not.toContain("listUserOrganizations");
    expect(teamMenu).not.toContain("Create Team");
  });

  it("uses the app-style user menu in the square bottom-left trigger", () => {
    expect(desktopShell).toContain('import { UserMenu } from "./user-menu";');
    expect(desktopShell).toContain("<UserMenu />");
    expect(button).toContain("square:");
    expect(userMenu).toContain("@repo/ui-v2/components/ui/avatar");
    expect(userMenu).toContain("@repo/ui-v2/components/ui/button");
    expect(userMenu).toContain("@repo/ui-v2/components/ui/dropdown-menu");
    expect(userMenu).toContain("render={");
    expect(userMenu).toContain("<Button");
    expect(userMenu).toContain('variant="square"');
    expect(userMenu).toContain("AvatarFallback");
    expect(userMenu).toContain(
      'const primaryIdentity = auth.userUsername ?? "User";'
    );
    expect(userMenu).toContain(
      "const secondaryIdentity = auth.userEmail ?? null;"
    );
    expect(userMenu).toContain('const initials = auth.userInitials ?? "U";');
    expect(userMenu).not.toContain("identityLines");
    expect(userMenu).not.toContain("getInitials");
    expect(userMenu).not.toContain("query.data");
    expect(userMenu).not.toContain("viewer.account.get");
    expect(userMenu).not.toContain("useQuery");
    expect(userMenu).not.toContain("useTRPC");
    expect(userMenu).toContain("Account Settings");
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
    expect(userMenu).toContain("openAppPath");
    expect(userMenu).toContain('"/account/settings/general"');
    expect(userMenu).toContain("rounded-md");
    expect(userMenu).not.toContain("menuIconClass");
    expect(userMenu).not.toContain("ACCOUNT_SETTINGS_PATH");
    expect(userMenu).not.toContain("HELP_DOCS_URL");
    expect(userMenu).not.toContain("SUPPORT_MAILTO_URL");
    expect(userMenu).not.toContain("FEEDBACK_MAILTO_URL");
    expect(userMenu).not.toContain("@repo/ui/components/ui");
    expect(userMenu).not.toContain("asChild");
    expect(userMenu).not.toContain('variant="destructive"');
    expect(userMenu).not.toContain("[&_svg]:text-destructive");
    expect(userMenu).not.toContain("rounded-full");
    expect(userMenu).not.toContain(">Settings</span>");
  });

  it("opens web app paths from desktop menu items", () => {
    expect(ipc).toContain('openAppPath: channel("open-app-path")');
    expect(ipc).toContain("openAppPath: (path: string) => Promise<void>;");
    expect(preloadBridge).toContain("openAppPath: (path) =>");
    expect(preloadBridge).toContain("IpcChannels.openAppPath");
    expect(mainIndex).toContain("IpcChannels.openAppPath");
    expect(appUrl).toContain("openAppPath(path: string)");
  });

  it("keeps Storybook scoped to ui-v2 package components", () => {
    expect(readdirSync(storybookStories).sort()).toEqual([
      "button.stories.tsx",
      "dropdown-menu.stories.tsx",
    ]);
  });
});
