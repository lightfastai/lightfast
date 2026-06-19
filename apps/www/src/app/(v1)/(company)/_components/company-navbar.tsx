import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { NavLink } from "~/components/nav-link";

const navLinkClass =
  "text-foreground/60 hover:text-foreground transition-colors" as const;

export function CompanyNavbar() {
  return (
    <header className="fixed top-0 left-0 z-50 px-6 py-4">
      {/* Desktop: Left-anchored nav pill */}
      <nav className="relative hidden h-9 items-center gap-0.5 rounded-md py-1 pr-1 pl-4 md:inline-flex">
        <div className="absolute inset-0 -z-10 rounded-md border border-border/50 bg-card/40 backdrop-blur-md" />
        <NavLink className="mr-auto flex items-center pr-4" href="/" prefetch>
          <Icons.logoShort className="h-4 w-4 text-foreground/60 transition-colors hover:text-foreground" />
        </NavLink>
        <Button asChild className={navLinkClass} size="sm" variant="none">
          <NavLink href="/" prefetch>
            Home
          </NavLink>
        </Button>
        <Button asChild className={navLinkClass} size="sm" variant="none">
          <NavLink href="/company" prefetch>
            Company
          </NavLink>
        </Button>
        <Button asChild className={navLinkClass} size="sm" variant="none">
          <NavLink href="/careers" prefetch>
            Careers
          </NavLink>
        </Button>
      </nav>

      {/* Mobile: Logo only */}
      <NavLink
        className="flex items-center transition-opacity hover:opacity-80 md:hidden"
        href="/"
        prefetch
      >
        <Icons.logoShort className="h-4 w-4 text-foreground" />
      </NavLink>
    </header>
  );
}
