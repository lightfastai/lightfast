import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { appUrl } from "~/lib/related-projects";
import { UserDropdownMenu } from "./user-dropdown-menu";
import { NewChatButton } from "./new-chat-button";

export function PlaygroundHeader() {
  return (
    <>
      {/* Desktop header - absolute positioned */}
      <div className="hidden lg:flex absolute top-4 left-6 right-6 z-20 items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="xs" asChild>
            <Link href={appUrl}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <NewChatButton />
        </div>

        <UserDropdownMenu />
      </div>

      {/* Mobile/Tablet header */}
      <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="xs" asChild>
            <Link href={appUrl}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <NewChatButton variant="mobile" />
        </div>

        <UserDropdownMenu />
      </header>
    </>
  );
}