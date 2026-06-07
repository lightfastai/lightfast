import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getUserMenuIdentity, SETTINGS_HREF } from "~/components/user-menu-model";

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
    expect(menuSource).toContain("viewer.account.get.queryOptions()");
    expect(menuSource).toContain('enabled: typeof window !== "undefined"');
    expect(menuSource).not.toContain("useSuspenseQuery");
    expect(menuSource).toContain("to={SETTINGS_HREF}");
    expect(menuSource).toContain('signOut({ redirectUrl: "/sign-in" })');
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
