"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/ui/button";
import { 
  User, 
  Key, 
  CreditCard, 
  Shield,
  Settings
} from "lucide-react";

const settingsNavItems = [
  {
    href: "/settings",
    label: "Overview",
    icon: Settings,
    description: "General account overview"
  },
  {
    href: "/settings/profile",
    label: "Profile",
    icon: User,
    description: "Personal information and preferences"
  },
  {
    href: "/settings/api-keys",
    label: "API Keys",
    icon: Key,
    description: "Manage your API keys and tokens"
  },
  {
    href: "/settings/billing",
    label: "Billing",
    icon: CreditCard,
    description: "Subscription and payment methods"
  },
  {
    href: "/settings/security",
    label: "Security",
    icon: Shield,
    description: "Password and security settings"
  },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1" role="navigation" aria-label="Settings navigation">
      {/* Desktop sidebar navigation */}
      <div className="hidden lg:block">
        {settingsNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg text-sm transition-colors group",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="size-4 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium">{item.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5 group-hover:text-muted-foreground/80">
                  {item.description}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Mobile tab navigation */}
      <div className="lg:hidden">
        <div className="flex gap-1 p-1 bg-muted rounded-lg overflow-x-auto">
          {settingsNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            return (
              <Button
                key={item.href}
                asChild
                variant={isActive ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "flex-shrink-0 text-xs",
                  isActive 
                    ? "bg-background shadow-sm" 
                    : "text-muted-foreground"
                )}
              >
                <Link href={item.href} aria-current={isActive ? "page" : undefined}>
                  <Icon className="size-3" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              </Button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}