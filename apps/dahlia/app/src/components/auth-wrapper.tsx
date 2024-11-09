"use client";

import Link from "next/link";

import { Button } from "@repo/ui/components/ui/button";

export function AuthWrapper() {
  return (
    <div className="absolute right-4 top-4 z-10 sm:right-8 sm:top-8">
      <Button
        variant="outline"
        className="backdrop-blur-sm transition-all duration-300 hover:bg-background/60"
        asChild
      >
        <Link href="/login">Login / Sign up</Link>
      </Button>
    </div>
  );
}
