"use client";

import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";

interface LoginDropdownProps {
  chatUrl: string;
  cloudUrl: string;
}

export function LoginDropdown({ chatUrl, cloudUrl }: LoginDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">Login</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={chatUrl}>Chat</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={cloudUrl}>Cloud</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
