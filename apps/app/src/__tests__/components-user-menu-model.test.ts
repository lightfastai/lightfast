import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getUserMenuIdentity,
  SETTINGS_HREF,
} from "~/components/user-menu-model";

const appRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

describe("TanStack user menu", () => {
  it("uses the sidebar-owned menu instead of Clerk's packaged UserButton", () => {
    const topbarSource = source("src/components/authenticated-topbar.tsx");
    const sidebarSource = source("src/components/app-sidebar.tsx");

    expect(topbarSource).not.toContain('from "~/components/user-menu"');
    expect(topbarSource).not.toContain("<UserMenu />");
    expect(topbarSource).not.toContain("UserButton");
    expect(sidebarSource).toContain("<SidebarFooter");
    expect(sidebarSource).toContain("<UserMenu />");
    expect(sidebarSource).toContain(
      'useClerk } from "@clerk/tanstack-react-start"'
    );
    expect(sidebarSource).toContain("accountProfileQueryOptions()");
    expect(sidebarSource).toContain('enabled: typeof window !== "undefined"');
    expect(sidebarSource).toContain('from "@repo/ui/hooks/use-mounted"');
    expect(sidebarSource).toContain("const mounted = useMounted();");
    expect(sidebarSource).toContain("if (!mounted || isPending || !profile)");
    expect(sidebarSource).not.toContain("useSuspenseQuery");
    expect(sidebarSource).toContain("to={SETTINGS_HREF}");
    expect(sidebarSource).toContain('signOut({ redirectUrl: "/sign-in" })');
  });

  it("uses ui-v2 dropdown and avatar primitives while old ui components migrate separately", () => {
    const menuSource = source("src/components/app-sidebar.tsx");

    expect(menuSource).toContain(
      'from "@repo/ui-v2/components/ui/dropdown-menu"'
    );
    expect(menuSource).not.toContain(
      'from "@repo/ui/components/ui/dropdown-menu"'
    );
    expect(menuSource).toContain('from "@repo/ui-v2/components/ui/avatar"');
    expect(menuSource).not.toContain('from "@repo/ui/components/ui/avatar"');
    expect(menuSource).toContain('from "@repo/ui/components/ui/button"');
  });

  it("uses Hugeicons for user-menu glyphs", () => {
    const menuSource = source("src/components/app-sidebar.tsx");

    expect(menuSource).toContain('from "@hugeicons/core-free-icons"');
    expect(menuSource).toContain('from "@hugeicons/react"');
    expect(menuSource).not.toContain('from "lucide-react"');
    expect(menuSource).toContain("BookOpen01Icon");
    expect(menuSource).toContain("HelpCircleIcon");
    expect(menuSource).toContain("LogoutIcon");
    expect(menuSource).toContain("Mail01Icon");
    expect(menuSource).toContain("SettingsIcon");
    expect(menuSource).toContain("HugeiconsIcon");
  });

  it("owns account, help, and sign-out menu sections", () => {
    const menuSource = source("src/components/app-sidebar.tsx");

    expect(menuSource).toContain("DropdownMenuGroup");
    expect(menuSource).toContain("DropdownMenuSub");
    expect(menuSource).toContain("DropdownMenuSubTrigger");
    expect(menuSource).toContain("DropdownMenuSubContent");
    expect(menuSource).toContain("icon={HelpCircleIcon}");
    expect(menuSource).toContain("Help Docs");
    expect(menuSource).toContain("Contact Support");
    expect(menuSource).toContain(
      "https://lightfast.ai/docs/get-started/overview"
    );
    expect(menuSource).toContain("mailto:support@lightfast.ai");
    expect(menuSource).toContain("Sign out");
  });

  it("uses the shared small dropdown size without app-specific content width overrides", () => {
    const menuSource = source("src/components/app-sidebar.tsx");
    const dropdownSource = readFileSync(
      resolve(
        appRoot,
        "../../packages/ui-v2/src/components/ui/dropdown-menu.tsx"
      ),
      "utf8"
    );

    expect(dropdownSource).toContain('size?: "sm" | "md"');
    expect(dropdownSource).toContain('sm: "w-[220px] space-y-1"');
    expect(dropdownSource).toContain('md: "w-[280px] space-y-1"');
    expect(menuSource).toContain(
      '<DropdownMenuContent align="start" side="top" size="sm">'
    );
    expect(menuSource).not.toContain(
      '<DropdownMenuContent align="start" className='
    );
    expect(menuSource).not.toContain("<DropdownMenuTrigger asChild");
    expect(menuSource).not.toContain("<DropdownMenuItem asChild className=");
    expect(menuSource).not.toContain("<DropdownMenuItem\n          className=");
    expect(menuSource).not.toContain("<HugeiconsIcon className=");
  });

  it("uses avatar and username in the sidebar footer trigger", () => {
    const menuSource = source("src/components/app-sidebar.tsx");

    expect(menuSource).toContain('aria-label="Open user menu"');
    expect(menuSource).toContain('className="h-11 w-full justify-start');
    expect(menuSource).toContain('<Avatar className="size-7');
    expect(menuSource).toContain("{primaryIdentity}");
  });

  it("derives the visible identity from username and email", () => {
    expect(
      getUserMenuIdentity({
        primaryEmailAddress: "ada@example.com",
        username: "ada-dev",
      })
    ).toEqual({
      primaryIdentity: "ada-dev",
      secondaryIdentity: "ada@example.com",
    });

    expect(
      getUserMenuIdentity({
        primaryEmailAddress: "ada@example.com",
        username: null,
      })
    ).toEqual({
      primaryIdentity: "ada@example.com",
      secondaryIdentity: null,
    });

    expect(
      getUserMenuIdentity({
        primaryEmailAddress: null,
        username: null,
      })
    ).toEqual({
      primaryIdentity: "User",
      secondaryIdentity: null,
    });
  });

  it("links to general account settings", () => {
    expect(SETTINGS_HREF).toBe("/account/settings/general");
  });
});
