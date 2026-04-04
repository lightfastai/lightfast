import { cn } from "@repo/ui/lib/utils";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const methodBadgeClass =
  "bg-transparent border border-border/50 text-foreground/60";

interface ApiMethodProps {
  className?: string;
  method: HttpMethod;
}

export function ApiMethod({ method, className }: ApiMethodProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
        methodBadgeClass,
        className
      )}
    >
      {method}
    </span>
  );
}
