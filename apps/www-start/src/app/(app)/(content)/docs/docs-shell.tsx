import { Icons } from "@repo/ui/components/icons";
import type { ReactNode } from "react";
import { NavLink } from "~/components/nav-link";
import { docsNavigation } from "~/lib/docs-content";

interface DocsShellProps {
  children?: ReactNode;
  currentPath: string;
}

function DocsSidebarLink({
  currentPath,
  href,
  title,
}: {
  currentPath: string;
  href: string;
  title: string;
}) {
  const active = href === currentPath;

  return (
    <NavLink
      aria-current={active ? "page" : undefined}
      className={[
        "block w-fit rounded-md px-3 py-1.5 text-sm transition-colors",
        active
          ? "bg-accent/70 text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      ].join(" ")}
      href={href}
    >
      {title}
    </NavLink>
  );
}

export default function DocsShell({ children, currentPath }: DocsShellProps) {
  return (
    <div className="dark flex min-h-screen w-full bg-background text-foreground">
      <aside className="hidden w-72 shrink-0 lg:block">
        <div className="sticky top-0 flex h-screen flex-col">
          <div className="page-gutter flex h-[4.25rem] items-center">
            <NavLink aria-label="Lightfast" href="/">
              <Icons.logoShort className="h-4 w-4 text-foreground transition-colors hover:text-muted-foreground" />
            </NavLink>
          </div>
          <nav
            aria-label="Documentation"
            className="min-h-0 flex-1 overflow-y-auto px-12 py-4"
          >
            {docsNavigation.map((section) => (
              <section className="mb-8" key={section.title}>
                <h2 className="mb-2 px-3 font-normal text-muted-foreground text-xs">
                  {section.title}
                </h2>
                <div className="grid gap-1">
                  {section.items.map((item) => (
                    <DocsSidebarLink
                      currentPath={currentPath}
                      href={item.href}
                      key={item.href}
                      title={item.title}
                    />
                  ))}
                </div>
              </section>
            ))}
          </nav>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="page-gutter shrink-0 bg-background/95 py-4 backdrop-blur">
          <div className="flex h-9 items-center gap-6">
            <NavLink aria-label="Lightfast" className="lg:hidden" href="/">
              <Icons.logoShort className="h-4 w-4 text-foreground" />
            </NavLink>
            <nav className="ml-auto flex items-center gap-6">
              <NavLink
                className="font-medium text-foreground text-sm transition-colors hover:text-muted-foreground"
                href="/docs/get-started/overview"
              >
                Docs
              </NavLink>
              <NavLink
                className="font-medium text-muted-foreground text-sm transition-colors hover:text-foreground"
                href="/docs/api-reference/getting-started/overview"
              >
                API
              </NavLink>
              <NavLink
                className="rounded-full bg-secondary px-4 py-2 font-medium text-secondary-foreground text-sm transition-colors hover:bg-secondary/80"
                href="/sign-in"
                microfrontend
              >
                Log In
              </NavLink>
            </nav>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden">
          <div className="page-gutter py-8 lg:py-12">{children}</div>
        </main>
      </div>
    </div>
  );
}
