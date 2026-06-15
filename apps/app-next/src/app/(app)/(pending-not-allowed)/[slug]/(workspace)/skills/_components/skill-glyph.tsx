import { cn } from "@repo/ui/lib/utils";

export function SkillGlyph({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-[9px] border border-border bg-transparent text-muted-foreground",
        className
      )}
    >
      <svg
        aria-hidden="true"
        className="size-[18px]"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={1.6}
        viewBox="0 0 24 24"
      >
        <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
        <path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z" opacity={0.5} />
        <path d="M12 12v9" opacity={0.5} />
      </svg>
    </span>
  );
}
