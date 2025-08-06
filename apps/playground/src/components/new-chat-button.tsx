"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Icons } from "@repo/ui/components/icons";
import Link from "next/link";

interface NewChatButtonProps {
  variant?: "default" | "mobile";
  className?: string;
}

export function NewChatButton({ variant = "default", className }: NewChatButtonProps) {
  if (variant === "mobile") {
    return (
      <Button asChild size="icon" variant="ghost" className={className}>
        <Link href="/">
          <Icons.newChat className="h-4 w-4" />
          <span className="sr-only">New Chat</span>
        </Link>
      </Button>
    );
  }

  return (
    <Button asChild variant="ghost" size="icon" className={className}>
      <Link href="/">
        <Icons.newChat className="h-4 w-4" />
      </Link>
    </Button>
  );
}