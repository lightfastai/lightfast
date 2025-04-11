import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@repo/ui/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center">
      <div className="mx-auto flex max-w-[500px] flex-col items-center justify-center text-center">
        <h1 className="text-4xl font-bold tracking-tight">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page Not Found</h2>
        <p className="mt-2 text-muted-foreground">
          Sorry, we couldn't find the page you're looking for. Please check the
          URL or navigate back home.
        </p>
        <Button variant="default" className="mt-8" asChild>
          <Link href="/" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </Button>
      </div>
    </div>
  );
}
