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
  const minHeight = size === "page" ? "min-h-96" : "min-h-32";

  return (
    <div className="px-3 py-3">
      <div
        className={`flex ${minHeight} flex-col items-center justify-center rounded-lg border border-border/70 bg-background px-6 text-center`}
      >
        <div className="mb-4 flex size-10 items-center justify-center rounded-full border border-border/70 bg-muted/20">
          <UsersRound className="size-4 text-muted-foreground" />
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
