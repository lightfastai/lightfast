import { cn } from "@repo/ui/lib/utils";

interface ApiEndpointProps {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  className?: string;
}

export function ApiEndpoint({ method, path, className }: ApiEndpointProps) {
  const methodColors = {
    GET: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30",
    POST: "bg-green-500/10 text-green-600 border-green-500/20 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/30",
    PUT: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20 dark:bg-yellow-500/10 dark:text-yellow-400 dark:border-yellow-500/30",
    PATCH: "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/30",
    DELETE: "bg-red-500/10 text-red-600 border-red-500/20 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30",
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-muted/30 p-4 font-mono text-sm mb-6",
        className
      )}
    >
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors",
          methodColors[method]
        )}
      >
        {method}
      </span>
      <code className="flex-1 text-sm text-foreground">{path}</code>
    </div>
  );
}