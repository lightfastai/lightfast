"use client";

import Link from "~/components/ui/link";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";

interface LoginDropdownProps {
  chatUrl: string;
  consoleUrl: string;
}

export function LoginDropdown({ chatUrl, consoleUrl }: LoginDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild suppressHydrationWarning>
        <Button variant="outline" size="lg" className="rounded-full">
          <span className="text-xs text-foreground font-medium uppercase tracking-widest">
            Sign In
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={chatUrl} microfrontend>Chat</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={consoleUrl} microfrontend>Console</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
