"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { cn } from "@repo/ui/lib/utils";
import { Key } from "lucide-react";

const getSettingsNavItems = (orgSlug: string) => [
  {
    href: `/orgs/${orgSlug}/settings/api-keys`,
    label: "API Keys",
    icon: Key,
    description: "Manage your API keys and tokens"
  },
];

export function SettingsNav() {
  const pathname = usePathname();
  const params = useParams();
  const orgSlug = params.slug as string;
  
  const settingsNavItems = getSettingsNavItems(orgSlug);

  return (
    <nav className="space-y-1" role="navigation" aria-label="Settings navigation">
      {settingsNavItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="size-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}