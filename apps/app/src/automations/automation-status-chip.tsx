import {
  Tick02Icon as Check,
  ChevronDownIcon as ChevronDown,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui-v2/components/ui/dropdown-menu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "~/compat/clerk";
import type { Automation } from "./automations-cache";
import {
  automationPauseMutationOptions,
  automationResumeMutationOptions,
} from "./automations-queries";
import { RailRow } from "./detail-sections";

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-1.5 rounded-full",
        active ? "bg-emerald-500" : "bg-muted-foreground"
      )}
    />
  );
}

export function AutomationStatusChip({
  automation,
}: {
  automation: Automation;
}) {
  const { has, isLoaded } = useAuth();
  const canManage = isLoaded && !!has?.({ role: "org:admin" });
  const [open, setOpen] = useState(false);

  const qc = useQueryClient();
  const id = automation.publicId;
  const isPaused = automation.status === "paused";

  const pauseMutation = useMutation(
    automationPauseMutationOptions({
      automation,
      queryClient: qc,
    })
  );

  const resumeMutation = useMutation(
    automationResumeMutationOptions({
      automation,
      queryClient: qc,
    })
  );

  const isMutating = pauseMutation.isPending || resumeMutation.isPending;

  if (!canManage) {
    return (
      <RailRow label="Status">
        <span className="flex items-center gap-1.5 text-foreground text-sm capitalize">
          <StatusDot active={automation.status === "active"} />
          {automation.status}
        </span>
      </RailRow>
    );
  }

  return (
    <RailRow label="Status">
      <DropdownMenu onOpenChange={setOpen} open={open}>
        <DropdownMenuTrigger
          render={<Button size="lf" type="button" variant="secondary" />}
        >
          <StatusDot active={automation.status === "active"} />
          <span className="capitalize">{automation.status}</span>
          <HugeiconsIcon
            className="size-3.5 text-muted-foreground"
            icon={ChevronDown}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-36">
          <DropdownMenuItem
            disabled={isMutating}
            onClick={() => {
              if (isPaused) {
                resumeMutation.mutate({ id });
              }
            }}
          >
            <span className={`flex-1 ${isPaused ? "" : "font-semibold"}`}>
              Active
            </span>
            {isPaused ? null : (
              <HugeiconsIcon
                aria-hidden="true"
                className="size-3.5 text-muted-foreground"
                icon={Check}
              />
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isMutating}
            onClick={() => {
              if (!isPaused) {
                pauseMutation.mutate({ id });
              }
            }}
          >
            <span className={`flex-1 ${isPaused ? "font-semibold" : ""}`}>
              Paused
            </span>
            {isPaused ? (
              <HugeiconsIcon
                aria-hidden="true"
                className="size-3.5 text-muted-foreground"
                icon={Check}
              />
            ) : null}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </RailRow>
  );
}
