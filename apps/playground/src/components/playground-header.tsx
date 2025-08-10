import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import { appUrl } from "~/lib/related-projects";
import { UserDropdownMenu } from "./user-dropdown-menu";
import { NewChatButton } from "./new-chat-button";

export function PlaygroundHeader() {
  return (
    <header className="h-14 flex items-center justify-between app-container bg-background">
      <div className="flex items-center">
        <Button variant="outline" size="xs" asChild>
          <Link href={appUrl}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex h-4 items-center px-4">
          <Separator orientation="vertical" />
        </div>
        <NewChatButton className="hidden lg:flex" />
        <NewChatButton variant="mobile" className="lg:hidden" />
      </div>

      <UserDropdownMenu />
    </header>
  );
}