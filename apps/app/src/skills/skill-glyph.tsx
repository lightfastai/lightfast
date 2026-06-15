import { cn } from "@repo/ui/lib/utils";
import { Box } from "lucide-react";

export function SkillGlyph({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-[9px] border border-border bg-transparent text-muted-foreground",
        className
      )}
    >
      <Box aria-hidden="true" className="size-[18px]" strokeWidth={1.6} />
    </span>
  );
}
