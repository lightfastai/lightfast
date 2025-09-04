"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@repo/ui/components/ui/sheet";
import { Icons } from "@repo/ui/components/icons";
import { useUser, useOrganization } from "@clerk/nextjs";
import { 
  LayoutDashboard, 
  Settings, 
  Key, 
  Menu,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar";
import { useState } from "react";

const navigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Settings",
    icon: Settings,
    children: [
      {
        name: "API Keys",
        href: "/dashboard/settings/api-keys",
        icon: Key,
      },
    ],
  },
];

function NavigationItems({ onItemClick }: { onItemClick?: () => void }) {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>(["Settings"]);

  const toggleExpanded = (name: string) => {
    setExpandedItems(prev =>
      prev.includes(name)
        ? prev.filter(item => item !== name)
        : [...prev, name]
    );
  };

  return (
    <nav className="flex-1 space-y-1 px-2 py-4">
      {navigation.map((item) => {
        if (item.children) {
          const isExpanded = expandedItems.includes(item.name);
          return (
            <div key={item.name} className="space-y-1">
              <button
                onClick={() => toggleExpanded(item.name)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  "text-gray-300 hover:text-white hover:bg-gray-700"
                )}
              >
                <div className="flex items-center">
                  <item.icon className="mr-3 h-4 w-4" />
                  {item.name}
                </div>
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
              {isExpanded && (
                <div className="ml-6 space-y-1">
                  {item.children.map((child) => {
                    const isActive = pathname === child.href;
                    return (
                      <Link
                        key={child.name}
                        href={child.href}
                        onClick={onItemClick}
                        className={cn(
                          "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                          isActive
                            ? "bg-blue-600 text-white"
                            : "text-gray-300 hover:text-white hover:bg-gray-700"
                        )}
                      >
                        <child.icon className="mr-3 h-4 w-4" />
                        {child.name}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }

        const isActive = pathname === item.href;
        return (
          <Link
            key={item.name}
            href={item.href}
            onClick={onItemClick}
            className={cn(
              "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
              isActive
                ? "bg-blue-600 text-white"
                : "text-gray-300 hover:text-white hover:bg-gray-700"
            )}
          >
            <item.icon className="mr-3 h-4 w-4" />
            {item.name}
          </Link>
        );
      })}
    </nav>
  );
}

function UserSection() {
  const { user } = useUser();
  const { organization } = useOrganization();

  const displayName = organization?.name ?? user?.fullName ?? user?.emailAddresses[0]?.emailAddress ?? "User";
  const displayEmail = organization?.slug ?? user?.emailAddresses[0]?.emailAddress ?? "";
  const avatarUrl = organization?.imageUrl ?? user?.imageUrl;

  return (
    <div className="border-t border-gray-700 p-4">
      <div className="flex items-center">
        <Avatar className="h-8 w-8">
          <AvatarImage src={avatarUrl} alt={displayName} />
          <AvatarFallback className="bg-gray-700 text-gray-300">
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="ml-3 min-w-0 flex-1">
          <p className="text-sm font-medium text-white truncate">
            {displayName}
          </p>
          {displayEmail && (
            <p className="text-xs text-gray-400 truncate">
              {displayEmail}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <div className="flex flex-col flex-grow bg-gray-900">
          {/* Logo */}
          <div className="flex items-center h-16 px-4 border-b border-gray-700">
            <Link href="/dashboard" className="flex items-center">
              <Icons.logo className="h-6 w-auto text-white" />
            </Link>
          </div>

          {/* Navigation */}
          <NavigationItems />

          {/* User section */}
          <UserSection />
        </div>
      </div>

      {/* Mobile sidebar */}
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden fixed top-4 left-4 z-50 bg-gray-900 text-white hover:bg-gray-800"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 bg-gray-900 border-gray-700 p-0">
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="flex items-center h-16 px-4 border-b border-gray-700">
              <Link href="/dashboard" className="flex items-center">
                <Icons.logo className="h-6 w-auto text-white" />
              </Link>
            </div>

            {/* Navigation */}
            <NavigationItems onItemClick={() => document.body.click()} />

            {/* User section */}
            <UserSection />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}