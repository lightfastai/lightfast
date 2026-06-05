import { Button } from "@repo/ui/components/ui/button";
import { Link, useLocation } from "@tanstack/react-router";

interface SettingsSidebarItem {
  name: string;
  to: "/account/settings/general" | "/account/settings/source-control";
}

export function SettingsSidebar({ items }: { items: SettingsSidebarItem[] }) {
  const location = useLocation();

  return (
    <aside className="w-full flex-shrink-0 md:w-48">
      <nav className="grid grid-cols-2 gap-1 sm:grid-cols-4 md:block md:space-y-1">
        {items.map((item) => {
          const isActive = location.pathname === item.to;

          return (
            <Button
              asChild
              className="w-full justify-start rounded-xl font-normal text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground"
              data-active={isActive}
              key={item.name}
              size="sm"
              variant="none"
            >
              <Link preload="intent" to={item.to}>
                {item.name}
              </Link>
            </Button>
          );
        })}
      </nav>
    </aside>
  );
}
