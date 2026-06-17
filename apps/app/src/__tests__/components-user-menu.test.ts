import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

describe("TanStack user menu", () => {
  it("uses the extracted sidebar menu instead of Clerk's packaged UserButton", () => {
    const topbarSource = source("src/components/authenticated-topbar.tsx");
    const sidebarSource = source("src/components/app-sidebar.tsx");
    const menuSource = source("src/components/user-menu.tsx");

    expect(topbarSource).not.toContain('from "~/components/user-menu"');
    expect(topbarSource).not.toContain("<UserMenu />");
    expect(topbarSource).not.toContain("UserButton");
    expect(sidebarSource).toContain("<SidebarFooter");
    expect(sidebarSource).toContain('import { UserMenu } from "./user-menu";');
    expect(sidebarSource).toContain("<UserMenu />");
    expect(sidebarSource).not.toContain("function UserMenu");
    expect(sidebarSource).not.toContain("function UserMenuSkeleton");
    expect(sidebarSource).not.toContain(
      'useClerk } from "@clerk/tanstack-react-start"'
    );
    expect(menuSource).toContain(
      'useClerk } from "@clerk/tanstack-react-start"'
    );
    expect(menuSource).toContain("accountProfileQueryOptions()");
    expect(menuSource).toContain('enabled: typeof window !== "undefined"');
    expect(menuSource).toContain('from "@repo/ui/hooks/use-mounted"');
    expect(menuSource).toContain("const mounted = useMounted();");
    expect(menuSource).toContain("if (!mounted || isPending || !profile)");
    expect(menuSource).not.toContain("useSuspenseQuery");
    expect(menuSource).toContain('to="/account/settings/general"');
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
    const menuSource = source("src/components/user-menu.tsx");
    const dropdownSource = readFileSync(
      resolve(
        appRoot,
        "../../packages/ui-v2/src/components/ui/dropdown-menu.tsx"
      ),
      "utf8"
    );

    expect(dropdownSource).toContain('size?: "sm" | "md"');
    expect(dropdownSource).toContain('size === "sm" && "w-[220px] space-y-1"');
    expect(dropdownSource).toContain('size === "md" && "w-[280px] space-y-1"');
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
    const menuSource = source("src/components/user-menu.tsx");

    expect(menuSource).toContain('aria-label="Open user menu"');
    expect(menuSource).toContain('className="h-11 w-full justify-start');
    expect(menuSource).toContain('<Avatar className="size-7');
    expect(menuSource).toContain("{primaryIdentity}");
  });

  it("keeps identity and settings logic inline in the user menu component", () => {
    const menuSource = source("src/components/user-menu.tsx");
    const userMenuModelPath = resolve(
      appRoot,
      "src/components/user-menu-model.ts"
    );

    expect(existsSync(userMenuModelPath)).toBe(false);
    expect(menuSource).not.toContain("user-menu-model");
    expect(menuSource).not.toContain("getUserMenuIdentity");
    expect(menuSource).not.toContain("SETTINGS_HREF");
    expect(menuSource).toContain("const identityLines = [");
    expect(menuSource).toContain("profile.username");
    expect(menuSource).toContain("profile.primaryEmailAddress");
    expect(menuSource).toContain(
      'primaryIdentity = identityLines[0] ?? "User"'
    );
    expect(menuSource).toContain(
      "secondaryIdentity = identityLines[1] ?? null"
    );
    expect(menuSource).toContain('to="/account/settings/general"');
  });
});
