import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { cn } from "@repo/ui/lib/utils";

import { useApiHealth } from "../hooks/use-api-health";

const statusConfig = {
  loading: {
    color: "bg-yellow-500",
    text: "Checking API connection...",
    label: "API Status: Loading",
  },
  connected: {
    color: "bg-green-500",
    text: "API connection healthy.",
    label: "API Status: Connected",
  },
  disconnected: {
    color: "bg-red-500",
    text: "API connection failed or timed out.",
    label: "API Status: Disconnected",
  },
  error: {
    color: "bg-orange-500",
    text: "Error checking API status (check console or config).",
    label: "API Status: Error",
  },
};

export function ApiStatusIndicator() {
  const status = useApiHealth();
  const config = statusConfig[status];

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-block h-2 w-2 animate-pulse rounded-full",
                config.color,
                status !== "loading" && "animate-none", // Only pulse when loading
              )}
              aria-hidden="true"
            />
            <span>API</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>{config.text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
