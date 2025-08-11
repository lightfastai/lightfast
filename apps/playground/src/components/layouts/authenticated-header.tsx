import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import { Icons } from "@repo/ui/components/icons";
import { appUrl } from "~/lib/related-projects";
import { UserDropdownMenu } from "./user-dropdown-menu";
import { AuthenticatedMobileNav } from "./authenticated-mobile-nav";

export function AuthenticatedHeader() {
  return (
    <header className="absolute top-0 left-0 right-0 h-14 flex items-center justify-between app-container bg-background border-b border-border/50 lg:border-b-0 z-10">
      {/* Left side - Logo and New Playground */}
      <div className="flex items-center">
        <Button variant="outline" size="xs" asChild>
          <Link href={appUrl}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        
        {/* New Playground Button - visible on all screen sizes */}
        <div className="flex items-center">
          <div className="flex h-4 items-center px-4">
            <Separator orientation="vertical" />
          </div>
          <Button size="xs" variant="ghost" asChild>
            <Link href="/playground">
              <Icons.newChat className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Mobile menu button */}
        <AuthenticatedMobileNav />
        
        {/* Desktop - User dropdown */}
        <div className="hidden lg:block">
          <UserDropdownMenu />
        </div>
      </div>
    </header>
  );
}