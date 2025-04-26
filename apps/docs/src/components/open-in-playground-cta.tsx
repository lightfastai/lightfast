import Link from "next/link";

import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";

export function OpenInPlaygroundCta({
  className,
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "group relative flex flex-col gap-2 rounded-lg border p-4 text-sm",
        className,
      )}
    >
      <div className="text-lg leading-tight font-semibold text-balance group-hover:underline">
        Create beautiful art with Dahlia
      </div>
      <div>
        Dahlia provides tools and infrastructure to create beautiful art.
      </div>
      <Button size="sm" className="mt-2 w-fit">
        Dahlia Playground
      </Button>
      <Link
        href="/playground"
        target="_blank"
        rel="noreferrer"
        className="absolute inset-0"
      >
        <span className="sr-only">Dahlia Playground</span>
      </Link>
    </div>
  );
}
