"use client";

import { Button } from "@repo/ui/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AuthHeaderCta() {
  const pathname = usePathname();
  const isSignIn = pathname === "/sign-in";
  const href = isSignIn ? "/sign-up" : "/sign-in";
  const label = isSignIn ? "Sign up" : "Log in";

  return (
    <Button asChild className="rounded-full" size="lg" variant="secondary">
      <Link href={href} prefetch={true}>
        {label}
      </Link>
    </Button>
  );
}
