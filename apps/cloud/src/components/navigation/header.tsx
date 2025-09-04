"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

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
      <h1 className="text-2xl font-semibold text-foreground md:hidden">
        {currentTitle}
      </h1>
      
      {/* Desktop breadcrumbs */}
      <div className="hidden md:flex items-center space-x-1 text-sm text-muted-foreground">
        {breadcrumbItems.map((item, index) => {
          const isLast = index === breadcrumbItems.length - 1;
          
          return (
            <div key={item.href} className="flex items-center">
              {index > 0 && (
                <ChevronRight className="h-4 w-4 mx-1" />
              )}
              {isLast ? (
                <span className="text-foreground font-medium">
                  {item.title}
                </span>
              ) : (
                <Link 
                  href={item.href}
                  className="hover:text-foreground transition-colors"
                >
                  {item.title}
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop title */}
      <h1 className="hidden md:block text-2xl font-semibold text-foreground mt-2">
        {currentTitle}
      </h1>
    </div>
  );
}

export function Header() {
  return (
    <div className="flex-1">
      <Breadcrumbs />
    </div>
  );
}