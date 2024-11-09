import Link from "next/link";

import { auth } from "@repo/auth";
import { Button } from "@repo/ui/components/ui/button";

export async function AuthWrapper() {
  const session = await auth();

  if (session) {
    return null;
  }

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
