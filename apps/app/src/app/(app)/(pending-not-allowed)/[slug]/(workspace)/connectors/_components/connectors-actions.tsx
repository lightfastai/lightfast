"use client";

import { cn } from "@repo/ui/lib/utils";
import { useQueryState } from "nuqs";
import {
  type ConnectorOwnerScope,
  connectorOwnerScopeParser,
} from "./connectors-search-params";

export function ConnectorsActions() {
  const [scope, setScope] = useQueryState("scope", connectorOwnerScopeParser);
  const [selectedProvider] = useQueryState("connector");
  const activeScope: ConnectorOwnerScope =
    selectedProvider === "granola" ? "personal" : scope;

  return (
    <div
      aria-label="Connector ownership"
      className="grid h-7 w-fit min-w-[184px] max-w-full grid-cols-2 rounded-[9px] border border-input bg-card p-0.5 text-muted-foreground"
      role="tablist"
    >
      <OwnerScopeTrigger
        controlsId="team-connectors-panel"
        id="team-connectors-tab"
        isActive={activeScope === "team"}
        label="Team"
        onSelect={() => void setScope("team")}
      />
      <OwnerScopeTrigger
        controlsId="personal-connectors-panel"
        id="personal-connectors-tab"
        isActive={activeScope === "personal"}
        label="Personal"
        onSelect={() => void setScope("personal")}
      />
    </div>
  );
}

function OwnerScopeTrigger({
  controlsId,
  id,
  isActive,
  label,
  onSelect,
}: {
  controlsId: string;
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
        "inline-flex h-6 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 font-medium text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isActive
          ? "bg-muted/60 text-foreground"
          : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
      )}
      id={id}
      onClick={onSelect}
      role="tab"
      type="button"
    >
      {label}
    </button>
  );
}
