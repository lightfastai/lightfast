import { cn } from "@repo/ui/lib/utils";
import {
  ApiMethod,
  type HttpMethod,
} from "~/app/(app)/(content)/docs/_components/api-method";

interface ApiEndpointProps {
  className?: string;
  method: HttpMethod;
  path: string;
}

export function ApiEndpoint({ method, path, className }: ApiEndpointProps) {
  return (
    <div
      className={cn(
        "mb-6 flex items-center gap-3 font-mono text-sm",
        className
      )}
    >
      <ApiMethod method={method} />
      <code className="flex-1 text-foreground text-sm">{path}</code>
    </div>
  );
}
