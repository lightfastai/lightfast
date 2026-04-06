"use client";

import { Settings } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

interface UserMenuProps {
  className?: string;
  /** User's display email */
  email: string;
  /** 1-2 character initials for avatar */
  initials: string;
  /** Called when user clicks "Sign out" */
  onSignOut: () => void;
  /** Href for settings link (e.g., "/account/settings/general") */
  settingsHref: string;
}

export type { UserMenuProps };

export function UserMenu({
  email,
  initials,
  settingsHref,
  onSignOut,
  className,
}: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className={`size-8 rounded-full p-0 ${className ?? ""}`}
          variant="ghost"
        >
          <Avatar className="size-6">
            <AvatarFallback className="bg-foreground text-[10px] text-background">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-54">
        <div className="px-2 py-1.5">
          <p className="text-muted-foreground text-sm">{email || "User"}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer rounded-xl">
          <Link href={{ pathname: settingsHref }} prefetch={true}>
            <Settings className="h-3 w-3" />
            Your Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer rounded-xl"
          onClick={onSignOut}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
