import { IsoFigure, peopleScene } from "@repo/ui/components/iso-figure";
import {
  UserGroupIcon as UsersRound,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
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
  if (size === "page") {
    return (
      <div className="flex min-h-0 w-full flex-1 items-center justify-center px-6 pb-12">
        <div className="flex items-center gap-12 sm:gap-16">
          <div className="shrink-0">
            <IsoFigure scene={peopleScene} width={200} />
          </div>
          <div className="max-w-md">
            <p className="font-medium text-foreground text-lg">{title}</p>
            <p className="mt-2.5 text-base text-muted-foreground leading-relaxed">
              {description}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              {action}
              <a
                className="inline-flex h-6 items-center rounded-lg border border-border/70 bg-muted/30 px-2.5 font-normal text-muted-foreground text-sm hover:bg-muted/60 hover:text-foreground"
                href="/docs/get-started/overview"
                rel="noopener noreferrer"
                target="_blank"
              >
                Documentation
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-1">
      <div className="flex min-h-24 flex-col items-center justify-center rounded-lg border border-border/70 bg-background px-6 text-center">
        <div className="mb-2 flex size-8 items-center justify-center rounded-full border border-border/70 bg-muted/20">
          <HugeiconsIcon icon={UsersRound} className="size-3.5 text-muted-foreground" />
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
