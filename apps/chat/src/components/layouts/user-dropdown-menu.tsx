"use client";

import { User } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { useClerk } from "@clerk/nextjs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";

interface UserDropdownMenuProps {
  className?: string;
}

export function UserDropdownMenu({ className }: UserDropdownMenuProps) {
  const { signOut } = useClerk();

  const handleSignOut = async () => {
    await signOut(); // Will use afterSignOutUrl from Clerk config
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="xs" className={`rounded-full ${className ?? ""}`}>
          <User className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}