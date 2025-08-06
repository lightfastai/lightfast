"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Icons } from "@repo/ui/components/icons";
import Link from "next/link";

interface NewChatButtonProps {
  variant?: "default" | "mobile";
}

export function NewChatButton({ variant = "default" }: NewChatButtonProps) {
  const href = "/";

  if (variant === "mobile") {
    return (
      <Button asChild size="icon" variant="ghost" className="h-8 w-8">
        <Link href={href}>
          <Icons.newChat className="h-4 w-4" />
          <span className="sr-only">New Chat</span>
        </Link>
      </Button>
    );
  }

  return (
    <Button asChild variant="ghost" size="icon">
      <Link href={href}>
        <Icons.newChat className="h-4 w-4" />
      </Link>
    </Button>
  );
}