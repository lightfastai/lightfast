import { cn } from "@repo/ui/lib/utils";
import { type HttpMethod, methodColors } from "./api-method";

interface ApiEndpointProps {
  className?: string;
  method: HttpMethod;
  path: string;
}

export function ApiEndpoint({ method, path, className }: ApiEndpointProps) {
  return (
    <div
      className={cn(
        "mb-6 flex items-center gap-3 rounded-lg border bg-muted/30 p-4 font-mono text-sm",
        className
      )}
    >
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-md border px-2.5 py-0.5 font-semibold text-xs transition-colors",
          methodColors[method]
        )}
      >
        {method}
      </span>
      <code className="flex-1 text-foreground text-sm">{path}</code>
    </div>
  );
}
