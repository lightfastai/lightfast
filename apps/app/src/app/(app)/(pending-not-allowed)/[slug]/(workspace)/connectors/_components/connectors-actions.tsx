"use client";

import { cn } from "@repo/ui/lib/utils";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { useTRPC } from "~/trpc/react";
import { connectorOwnerScopeParser } from "./connectors-search-params";

export function ConnectorsActions() {
  const trpc = useTRPC();
  const { data: connectorSections } = useSuspenseQuery({
    ...trpc.org.workspace.connectors.listSections.queryOptions(),
    staleTime: 30_000,
  });
  const [scope, setScope] = useQueryState("scope", connectorOwnerScopeParser);

  return (
    <div
      aria-label="Connector ownership"
      className="grid w-full max-w-[320px] grid-cols-2 rounded-[10px] border border-border/60 bg-muted/40 p-1 text-muted-foreground sm:w-[320px]"
      role="tablist"
    >
      <OwnerScopeTrigger
        controlsId="team-connectors-panel"
        count={connectorSections.teamConnectors.length}
        id="team-connectors-tab"
        isActive={scope === "team"}
        label="Team"
        onSelect={() => void setScope("team")}
      />
      <OwnerScopeTrigger
        controlsId="personal-connectors-panel"
        count={connectorSections.yourConnectors.length}
        id="personal-connectors-tab"
        isActive={scope === "personal"}
        label="Personal"
        onSelect={() => void setScope("personal")}
      />
    </div>
  );
}

function OwnerScopeTrigger({
  controlsId,
  count,
  id,
  isActive,
  label,
  onSelect,
}: {
  controlsId: string;
  count: number;
  id: string;
  isActive: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      aria-controls={controlsId}
      aria-selected={isActive}
      className={cn(
        "inline-flex h-7 items-center justify-center whitespace-nowrap rounded-md px-2.5 font-medium text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isActive
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
      id={id}
      onClick={onSelect}
      role="tab"
      type="button"
    >
      {label}
      <span
        aria-hidden="true"
        className="ml-2 rounded-full bg-muted px-1.5 py-0.5 font-normal text-[11px] text-muted-foreground"
      >
        {count}
      </span>
    </button>
  );
}
