import { Button } from "@repo/ui/components/ui/button";
import { Link, useLocation } from "@tanstack/react-router";

interface AccountSettingsSidebarItem {
  activePath?: string;
  name: string;
  params?: never;
  to: "/account/settings/general" | "/account/settings/source-control";
}

interface WorkspaceSettingsSidebarItem {
  activePath: string;
  name: string;
  params: { slug: string };
  to:
    | "/$slug/settings/members"
    | "/$slug/settings/api-keys"
    | "/$slug/settings/mcp"
    | "/$slug/settings/source-control";
}

type SettingsSidebarItem =
  | AccountSettingsSidebarItem
  | WorkspaceSettingsSidebarItem;

export function SettingsSidebar({ items }: { items: SettingsSidebarItem[] }) {
  const location = useLocation();

  return (
    <aside className="w-full flex-shrink-0 md:w-48">
      <nav className="grid grid-cols-2 gap-1 sm:grid-cols-4 md:block md:space-y-1">
        {items.map((item) => {
          const isActive = location.pathname === (item.activePath ?? item.to);

          return (
            <Button
              asChild
              className="w-full justify-start rounded-xl font-normal text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground"
              data-active={isActive}
              key={item.name}
              size="sm"
              variant="none"
            >
              {item.params ? (
                <Link params={item.params} preload="intent" to={item.to}>
                  {item.name}
                </Link>
              ) : (
                <Link preload="intent" to={item.to}>
                  {item.name}
                </Link>
              )}
            </Button>
          );
        })}
      </nav>
    </aside>
  );
}
