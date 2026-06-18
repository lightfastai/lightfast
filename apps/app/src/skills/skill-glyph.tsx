import { BoxIcon as Box } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@repo/ui/lib/utils";

export function SkillGlyph({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-[9px] border border-border bg-transparent text-muted-foreground",
        className
      )}
    >
      <HugeiconsIcon
        aria-hidden="true"
        className="size-[18px]"
        icon={Box}
        strokeWidth={1.6}
      />
    </span>
  );
}
