import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { appUrl } from "~/lib/related-projects";
import { UserDropdownMenu } from "./user-dropdown-menu";
import { NewChatButton } from "./new-chat-button";

export function PlaygroundHeader() {
  return (
    <header className="h-14 flex items-center justify-between px-4 lg:px-6 bg-background">
      <div className="flex items-center gap-4">
        <div className="pr-4 border-r">
          <Button variant="outline" size="xs" asChild>
            <Link href={appUrl}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <NewChatButton className="hidden lg:flex" />
        <NewChatButton variant="mobile" className="lg:hidden" />
      </div>

      <UserDropdownMenu />
    </header>
  );
}