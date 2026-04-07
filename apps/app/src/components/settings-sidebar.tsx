"use client";

import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
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
    <aside className="w-48 flex-shrink-0">
      <nav className="space-y-0.5">
        {items.map((item) => {
          const href = item.path ? `${basePath}/${item.path}` : basePath;
          const isActive = pathname === href;

          return (
            <Button
              asChild
              className="w-full justify-start rounded-xl font-normal text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground data-[active=true]:bg-accent data-[active=true]:font-medium data-[active=true]:text-accent-foreground"
              data-active={isActive}
              key={item.name}
              size="sm"
              variant="ghost"
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
