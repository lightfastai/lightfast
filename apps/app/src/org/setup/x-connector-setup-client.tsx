import {
  listConnectors,
  type StartConnectorInput,
  type StartConnectorResult,
  startConnector,
} from "@api/app/tanstack/connectors";
import {
  ArrowUpRightIcon as ArrowUpRight,
  Loading03Icon as Loader2,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@repo/ui/components/ui/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { TeamSwitcherSlot } from "~/components/team-switcher";
import { ConnectorIcon } from "~/connectors/connector-icons";
import {
  type ConnectorCatalogRow,
  connectionStatus,
} from "~/connectors/connectors-model";

interface XConnectorSetupClientProps {
  orgSlug: string;
}

function missingConfigMessage(row: ConnectorCatalogRow) {
  if (
    row.connectAvailability.status === "unavailable" &&
    row.connectAvailability.reason === "missing_config"
  ) {
    return row.connectAvailability.missing?.join(", ") ?? "X OAuth";
  }
  return null;
}

function unavailableMessage(row: ConnectorCatalogRow) {
  if (row.connectAvailability.status === "available") {
    return null;
  }

  switch (row.connectAvailability.reason) {
    case "missing_config":
      return `X OAuth credentials are not configured: ${missingConfigMessage(row)}.`;
    case "permission_required":
      return "Admin access required to connect X.";
    default:
      return "X is not available yet.";
  }
}

export function XConnectorSetupClient({ orgSlug }: XConnectorSetupClientProps) {
  const {
    data: connectors = [],
    error,
    isPending,
  } = useQuery({
    enabled: typeof window !== "undefined",
    queryFn: () => listConnectors(),
    queryKey: ["connectors", "list"] as const,
    staleTime: 30_000,
  });
  const xConnector = connectors.find((row) => row.provider === "x");

  const startConnectMutation = useMutation({
    meta: { errorTitle: "Failed to connect provider" },
    mutationFn: (data: StartConnectorInput) => startConnector({ data }),
    onSuccess: (result: StartConnectorResult) => {
      window.location.assign(result.authorizationUrl);
    },
  });

  if (isPending) {
    return <SetupPageSkeleton label="Loading X connector" />;
  }

  if (error) {
    return (
      <main className="flex min-h-full flex-1 items-center justify-center px-4 pb-32">
        <section className="w-full max-w-md space-y-3">
          <TeamSwitcherSlot />
          <h1 className="font-medium font-title text-2xl text-foreground">
            Connect X
          </h1>
          <p className="text-destructive text-sm">{error.message}</p>
        </section>
      </main>
    );
  }

  if (!xConnector) {
    return (
      <main className="flex min-h-full flex-1 items-center justify-center px-4 pb-32">
        <section className="w-full max-w-md space-y-3">
          <TeamSwitcherSlot />
          <h1 className="font-medium font-title text-2xl text-foreground">
            Connect X
          </h1>
          <p className="text-muted-foreground text-sm">
            X is not available in this workspace.
          </p>
        </section>
      </main>
    );
  }

  const status = xConnector.connection
    ? connectionStatus(xConnector.connection)
    : null;
  const disabled =
    startConnectMutation.isPending ||
    xConnector.connectAvailability.status !== "available";
  const unavailable = unavailableMessage(xConnector);
  const actionLabel = xConnector.connection ? "Reconnect X" : "Connect X";

  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 pb-32">
      <section className="w-full max-w-md space-y-5">
        <TeamSwitcherSlot />
        <div className="w-fit rounded-sm bg-card p-3">
          <ConnectorIcon provider="x" />
        </div>

        <div className="space-y-3">
          <h1 className="font-medium font-title text-2xl text-foreground">
            Connect X
          </h1>
          <p className="text-muted-foreground text-sm">
            Lightfast needs an X connector before workspace features unlock for{" "}
            {orgSlug}.
          </p>
        </div>

        {xConnector.connection ? (
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-foreground text-sm">
                  {xConnector.connection.providerActorName ?? "X account"}
                </p>
                <p className="mt-1 text-muted-foreground text-xs">
                  Current connector status
                </p>
              </div>
              {status ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 text-foreground text-sm">
                  <span
                    className={`size-1.5 rounded-full ${status.dotClass}`}
                  />
                  {status.label}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {unavailable ? (
          <div
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm"
            role="alert"
          >
            {unavailable}
          </div>
        ) : null}

        <Button
          className="w-full"
          disabled={disabled}
          onClick={() => startConnectMutation.mutate({ provider: "x" })}
        >
          {startConnectMutation.isPending ? (
            <>
              <HugeiconsIcon
                className="mr-1.5 h-4 w-4 animate-spin"
                icon={Loader2}
              />
              Connecting...
            </>
          ) : (
            <>
              {actionLabel}
              <HugeiconsIcon
                aria-hidden="true"
                className="h-4 w-4"
                icon={ArrowUpRight}
              />
            </>
          )}
        </Button>
      </section>
    </main>
  );
}

function SetupPageSkeleton({ label }: { label: string }) {
  return (
    <div
      aria-label={label}
      className="grid min-h-full flex-1 place-items-center px-4 pb-32"
      role="status"
    >
      <div className="h-5 w-40 rounded-md bg-muted" />
    </div>
  );
}
