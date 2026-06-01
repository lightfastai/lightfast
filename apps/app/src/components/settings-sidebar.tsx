"use client";

import { Button } from "@repo/ui/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  name: string;
  path: string;
}

interface SettingsSidebarProps {
  basePath: string;
  items: NavItem[];
}

export function SettingsSidebar({ basePath, items }: SettingsSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-full flex-shrink-0 md:w-48">
      <nav className="grid grid-cols-2 gap-1 sm:grid-cols-4 md:block md:space-y-1">
        {items.map((item) => {
          const href = item.path ? `${basePath}/${item.path}` : basePath;
          const isActive = pathname === href;

          return (
            <Button
              asChild
              className="w-full justify-start rounded-xl font-normal text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground"
              data-active={isActive}
              key={item.name}
              size="sm"
              variant="none"
            >
              <Link href={{ pathname: href }} prefetch={true}>
                {item.name}
              </Link>
            </Button>
          );
        })}
      </nav>
    </aside>
  );
}
