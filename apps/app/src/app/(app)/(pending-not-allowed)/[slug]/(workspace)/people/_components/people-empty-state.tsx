import { cn } from "@repo/ui/lib/utils";
import { UsersRound } from "lucide-react";
import type { ReactNode } from "react";

export function PeopleEmptyState({
  action,
  description,
  size = "page",
  title,
}: {
  action?: ReactNode;
  description: string;
  size?: "page" | "section";
  title: string;
}) {
  // Uniform outer rhythm across every variant: a 4px top gap (`pt-1`), matching
  // the row spacing — no special vertical padding. The only context-dependent
  // bit is horizontal: `page` is rendered standalone so it adds `px-3` to align
  // with the toolbar; `section` sits inside an already-padded scroller, so it
  // inherits that inset and the box aligns edge-to-edge with the rows.
  const isPage = size === "page";

  return (
    <div className={cn("pt-1", isPage && "px-3")}>
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-lg border border-border/70 bg-background px-6 text-center",
          isPage ? "min-h-96" : "min-h-24"
        )}
      >
        <div
          className={cn(
            "flex items-center justify-center rounded-full border border-border/70 bg-muted/20",
            isPage ? "mb-4 size-10" : "mb-2 size-8"
          )}
        >
          <UsersRound
            className={cn(
              "text-muted-foreground",
              isPage ? "size-4" : "size-3.5"
            )}
          />
        </div>
        <p className="font-medium text-sm">{title}</p>
        <p className="mt-1 max-w-sm text-muted-foreground text-sm">
          {description}
        </p>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}
