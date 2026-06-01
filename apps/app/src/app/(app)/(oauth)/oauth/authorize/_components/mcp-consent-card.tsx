"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/ui/components/ui/sheet";
import {
  AlertTriangle,
  ArrowLeftRight,
  Check,
  Info,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";

import {
  approveMcpAuthorizationAction,
  denyMcpAuthorizationAction,
} from "../actions";
import type { McpConsentViewModel } from "../model";

export function McpConsentCard({ model }: { model: McpConsentViewModel }) {
  const [organizationId, setOrganizationId] = useState(
    model.organizations[0]?.id ?? ""
  );
  const hasWriteScope = model.permissions.some(
    (permission) => permission.kind === "write"
  );

  return (
    <main className="flex min-h-svh w-full items-center justify-center bg-background px-4 py-8 text-foreground">
      <section className="w-full max-w-[520px] rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex size-14 items-center justify-center rounded-lg border bg-background font-semibold text-lg">
            LF
          </div>
          <ArrowLeftRight className="size-4 text-muted-foreground" />
          <div className="flex size-14 items-center justify-center rounded-lg bg-foreground font-semibold text-background text-lg">
            {model.client.name.slice(0, 1).toUpperCase()}
          </div>
        </div>

        <div className="space-y-2 text-center">
          <h1 className="font-semibold text-2xl tracking-normal">
            {model.client.name} is requesting access
          </h1>
          <p className="text-muted-foreground text-sm">{model.user.email}</p>
        </div>

        <form className="mt-8 space-y-5">
          <input name="clientId" type="hidden" value={model.request.clientId} />
          <input
            name="codeChallenge"
            type="hidden"
            value={model.request.codeChallenge}
          />
          <input
            name="codeChallengeMethod"
            type="hidden"
            value={model.request.codeChallengeMethod}
          />
          <input
            name="redirectUri"
            type="hidden"
            value={model.request.redirectUri}
          />
          <input name="resource" type="hidden" value={model.request.resource} />
          <input name="scope" type="hidden" value={model.request.scope} />
          {model.request.state ? (
            <input name="state" type="hidden" value={model.request.state} />
          ) : null}

          <div className="space-y-3">
            <div className="rounded-lg border bg-background/60 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 size-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="text-muted-foreground text-xs">User</div>
                  <div className="truncate font-medium text-sm">
                    {model.user.name}
                  </div>
                  <div className="truncate text-muted-foreground text-xs">
                    {model.user.email}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-background/60 p-4">
              <label
                className="mb-2 block text-muted-foreground text-xs"
                htmlFor="organizationId"
              >
                Organization
              </label>
              {model.organizations.length > 1 ? (
                <select
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  id="organizationId"
                  name="organizationId"
                  onChange={(event) => setOrganizationId(event.target.value)}
                  value={organizationId}
                >
                  {model.organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <input
                    name="organizationId"
                    type="hidden"
                    value={organizationId}
                  />
                  <div className="font-medium text-sm">
                    {model.organizations[0]?.name ?? "No organization"}
                  </div>
                </>
              )}
            </div>

            <div className="rounded-lg border bg-background/60 p-4">
              <div className="text-muted-foreground text-xs">Redirect URI</div>
              <div className="mt-1 break-all font-mono text-xs">
                {model.client.redirectUri}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {!model.client.verified ? (
              <WarningRow
                icon={<AlertTriangle className="size-4" />}
                label="Unverified client"
              />
            ) : null}
            {hasWriteScope ? (
              <WarningRow
                icon={<AlertTriangle className="size-4" />}
                label="Can write to your workspace"
              />
            ) : null}
          </div>

          <div className="space-y-2">
            {model.permissions.map((permission) => (
              <div
                className="flex items-start gap-3 rounded-lg border bg-background/60 p-3"
                key={permission.scope}
              >
                <Check className="mt-0.5 size-4 text-muted-foreground" />
                <div>
                  <div className="font-medium text-sm">{permission.label}</div>
                  <div className="text-muted-foreground text-xs">
                    {permission.description}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <DetailsSheet model={model} />
            <div className="flex gap-2">
              <Button formAction={denyMcpAuthorizationAction} variant="outline">
                Cancel
              </Button>
              <Button formAction={approveMcpAuthorizationAction}>Approve</Button>
            </div>
          </div>
        </form>
      </section>
    </main>
  );
}

function WarningRow({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-amber-200 text-sm">
      {icon}
      <span>{label}</span>
    </div>
  );
}

function DetailsSheet({ model }: { model: McpConsentViewModel }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm" type="button" variant="ghost">
          <Info className="size-4" />
          Details
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Connection details</SheetTitle>
          <SheetDescription>{model.client.name}</SheetDescription>
        </SheetHeader>
        <dl className="mt-6 space-y-4 text-sm">
          <DetailRow label="Client ID" value={model.client.id} />
          <DetailRow label="Resource" value={model.request.resource} />
          <DetailRow label="Redirect URI" value={model.request.redirectUri} />
          <DetailRow label="Scopes" value={model.request.scope} />
        </dl>
      </SheetContent>
    </Sheet>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1 break-all font-mono text-xs">{value}</dd>
    </div>
  );
}
