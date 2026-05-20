import { Button } from "@repo/ui/components/ui/button";
import Link from "next/link";

export default function AppNotFound() {
  return (
    <div className="flex min-h-full w-full items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-xl rounded-sm border border-border border-dashed p-10 text-center sm:p-16">
        <div className="mb-8 flex justify-center">
          <div className="relative h-20 w-20">
            <div className="h-20 w-20 rounded-full border-2 border-border" />
            <div className="absolute top-1/2 left-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground" />
          </div>
        </div>

        <h1 className="mb-5 font-bold text-7xl text-foreground">404</h1>
        <p className="mx-auto mb-8 max-w-sm text-muted-foreground text-sm">
          Sorry, we couldn't find the page you're looking for.
        </p>

        <Button asChild className="rounded-full" size="lg" variant="outline">
          <Link href="/account/welcome">Return Home</Link>
        </Button>
      </div>
    </div>
  );
}
