"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { UserMenu } from "./user-menu";

// Map of paths to breadcrumb titles
const pathTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/settings": "Settings",
  "/dashboard/settings/api-keys": "API Keys",
};

function Breadcrumbs() {
  const pathname = usePathname();
  
  // Split pathname into segments and build breadcrumb items
  const segments = pathname.split("/").filter(Boolean);
  
  const breadcrumbItems = segments.reduce((acc: {href: string; title: string}[], segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    const title = pathTitles[href] ?? segment.charAt(0).toUpperCase() + segment.slice(1);
    
    acc.push({ href, title });
    return acc;
  }, []);

  // Get current page title
  const currentTitle = pathTitles[pathname] ?? "Dashboard";

  return (
    <div className="flex flex-col">
      {/* Mobile title */}
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white md:hidden">
        {currentTitle}
      </h1>
      
      {/* Desktop breadcrumbs */}
      <div className="hidden md:flex items-center space-x-1 text-sm text-gray-500 dark:text-gray-400">
        {breadcrumbItems.map((item, index) => {
          const isLast = index === breadcrumbItems.length - 1;
          
          return (
            <div key={item.href} className="flex items-center">
              {index > 0 && (
                <ChevronRight className="h-4 w-4 mx-1" />
              )}
              {isLast ? (
                <span className="text-gray-900 dark:text-white font-medium">
                  {item.title}
                </span>
              ) : (
                <Link 
                  href={item.href}
                  className="hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  {item.title}
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop title */}
      <h1 className="hidden md:block text-2xl font-semibold text-gray-900 dark:text-white mt-2">
        {currentTitle}
      </h1>
    </div>
  );
}

export function Header() {
  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 md:px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left side - Breadcrumbs and title */}
        <div className="flex-1 min-w-0 ml-0 md:ml-64">
          <Breadcrumbs />
        </div>

        {/* Right side - User menu */}
        <div className="ml-4 flex items-center space-x-4">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}