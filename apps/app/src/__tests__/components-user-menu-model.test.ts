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
  it("uses the app-owned menu instead of Clerk's packaged UserButton", () => {
    const topbarSource = source("src/components/authenticated-topbar.tsx");
    const menuSource = source("src/components/user-menu.tsx");

    expect(topbarSource).toContain('from "~/components/user-menu"');
    expect(topbarSource).toContain("<UserMenu />");
    expect(topbarSource).not.toContain("UserButton");
    expect(menuSource).toContain(
      'useClerk } from "@clerk/tanstack-react-start"'
    );
    expect(menuSource).toContain("accountProfileQueryOptions()");
    expect(menuSource).toContain('enabled: typeof window !== "undefined"');
    expect(menuSource).toContain('from "@repo/ui/hooks/use-mounted"');
    expect(menuSource).toContain("const mounted = useMounted();");
    expect(menuSource).toContain("if (!mounted || isPending || !profile)");
    expect(menuSource).not.toContain("useSuspenseQuery");
    expect(menuSource).toContain("to={SETTINGS_HREF}");
    expect(menuSource).toContain('signOut({ redirectUrl: "/sign-in" })');
  });

  it("uses ui-v2 dropdown and avatar primitives while old ui components migrate separately", () => {
    const menuSource = source("src/components/user-menu.tsx");

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
    const menuSource = source("src/components/user-menu.tsx");

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
    const menuSource = source("src/components/user-menu.tsx");
    const appSidebarSource = source("src/components/app-sidebar.tsx");

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

    expect(appSidebarSource).not.toContain("DropdownMenu");
    expect(appSidebarSource).not.toContain("Help Docs");
    expect(appSidebarSource).not.toContain("Contact Support");
    expect(appSidebarSource).not.toContain("mailto:support@lightfast.ai");
  });

  it("uses dropdown defaults without app-specific dropdown class overrides", () => {
    const menuSource = source("src/components/user-menu.tsx");

    expect(menuSource).toContain("<DropdownMenuContent align=\"end\">");
    expect(menuSource).not.toContain(
      '<DropdownMenuContent align="end" className='
    );
    expect(menuSource).not.toContain("asChild");
    expect(menuSource).not.toContain("<DropdownMenuItem asChild className=");
    expect(menuSource).not.toContain("<DropdownMenuItem\n          className=");
    expect(menuSource).not.toContain("<HugeiconsIcon className=");
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
