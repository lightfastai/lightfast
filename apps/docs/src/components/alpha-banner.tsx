import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";

export function AlphaBanner() {
  return (
    <div className="bg-red-500/20 rounded-xs p-4 mb-6">
      <p className="text-sm text-foreground font-medium mb-1">Alpha API</p>
      <p className="text-sm text-fd-muted-foreground">
        This API is currently in alpha. Breaking changes may occur between
        releases. We recommend pinning to a specific version and monitoring the{" "}
        <Button asChild variant="link" className="h-auto p-0 text-sm">
          <Link href="/docs/changelog">changelog</Link>
        </Button>{" "}
        for updates.
      </p>
    </div>
  );
}
