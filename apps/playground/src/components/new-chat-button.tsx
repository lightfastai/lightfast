"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

interface NewChatButtonProps {
  variant?: "default" | "mobile";
}

export function NewChatButton({ variant = "default" }: NewChatButtonProps) {
  const href = "/";

  if (variant === "mobile") {
    return (
      <Button asChild size="icon" variant="outline" className="h-8 w-8">
        <Link href={href}>
          <Plus className="h-4 w-4" />
          <span className="sr-only">New Chat</span>
        </Link>
      </Button>
    );
  }

  return (
    <Button asChild variant="outline" size="sm">
      <Link href={href}>
        <Plus className="mr-2 h-4 w-4" />
        New Chat
      </Link>
    </Button>
  );
}