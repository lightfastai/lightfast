"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/components/ui/tooltip";
import { cn } from "@repo/ui/lib/utils";
import { Timer } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useBillingContext } from "~/hooks/use-billing-context";

interface TemporarySessionButtonProps {
  className?: string;
}

// Self-contained toggle: determines availability, state, and routing internally
export function TemporarySessionButton({ className }: TemporarySessionButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const billing = useBillingContext();

  const isOnNewPage = pathname === "/new";
  const mode = searchParams.get("mode");
  const temporary = searchParams.get("temporary");
  const isTemporary = mode === "temporary" || temporary === "1";

  const canStartTemporaryChat = billing.isLoaded && billing.plan.isPlusUser && isOnNewPage;

  // If the control isn't applicable, don't render anything
  if (!canStartTemporaryChat) {
    return null;
  }

  const ariaLabel = isTemporary ? "Disable temporary chat" : "Start temporary chat";

  const handleToggle = () => {
    router.replace(isTemporary ? "/new" : "/new?mode=temporary");
  };

  const button = (
    <Button
      type="button"
      variant="ghost"
      aria-pressed={isTemporary}
      aria-label={ariaLabel}
      onClick={handleToggle}
      className={cn(
        "h-8 w-8 px-0 py-0 flex items-center justify-center",
        isTemporary
          ? "border border-blue-500/70 text-blue-600 hover:bg-blue-500/10 dark:text-blue-200 dark:border-blue-400"
          : "hover:bg-muted",
        className,
      )}
    >
      <Timer className="h-4 w-4" aria-hidden="true" />
    </Button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="bottom" align="end">
        {ariaLabel}
      </TooltipContent>
    </Tooltip>
  );
}
