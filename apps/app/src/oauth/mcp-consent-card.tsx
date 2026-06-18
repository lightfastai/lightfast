import {
  Alert02Icon as AlertTriangle,
  ArrowLeftRightIcon as ArrowLeftRight,
  Building03Icon as Building2,
  InformationCircleIcon as Info,
  SecurityCheckIcon as ShieldCheck,
  UserIcon as User,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Icons } from "@repo/ui/components/icons";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@repo/ui/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/ui/components/ui/sheet";
import { useServerFn } from "@tanstack/react-start";
import type { CSSProperties, ReactNode } from "react";
import { useRef, useState } from "react";

import {
  approveMcpAuthorization,
  denyMcpAuthorization,
} from "./mcp-consent-functions";
import type {
  McpAuthorizationInput,
  McpConsentViewModel,
} from "./mcp-consent-types";

type CSSCustomProperties = CSSProperties & Record<`--${string}`, string>;

const SHADCN_LIGHT_THEME: CSSCustomProperties = {
  "--accent": "oklch(0.97 0 0)",
  "--accent-foreground": "oklch(0.205 0 0)",
  "--background": "oklch(1 0 0)",
  "--border": "oklch(0.922 0 0)",
  "--card": "oklch(1 0 0)",
  "--card-foreground": "oklch(0.145 0 0)",
  "--destructive": "oklch(0.577 0.245 27.325)",
  "--destructive-foreground": "oklch(1 0 0)",
  "--foreground": "oklch(0.145 0 0)",
  "--input": "oklch(0.922 0 0)",
  "--input-bg": "oklch(1 0 0)",
  "--muted": "oklch(0.97 0 0)",
  "--muted-foreground": "oklch(0.556 0 0)",
  "--popover": "oklch(1 0 0)",
  "--popover-foreground": "oklch(0.145 0 0)",
  "--primary": "oklch(0.205 0 0)",
  "--primary-foreground": "oklch(0.985 0 0)",
  "--ring": "oklch(0.708 0 0)",
  "--secondary": "oklch(0.97 0 0)",
  "--secondary-foreground": "oklch(0.205 0 0)",
};

export function McpConsentCard({ model }: { model: McpConsentViewModel }) {
  const formRef = useRef<HTMLFormElement>(null);
  const approveAuthorization = useServerFn(approveMcpAuthorization);
  const denyAuthorization = useServerFn(denyMcpAuthorization);
  const [organizationId, setOrganizationId] = useState(
    model.organizations[0]?.id ?? ""
  );
  const [submittingAction, setSubmittingAction] = useState<
    "approve" | "deny" | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const selectedOrganization =
    model.organizations.find(
      (organization) => organization.id === organizationId
    ) ?? model.organizations[0];
  const hasWriteScope = model.permissions.some(
    (permission) => permission.kind === "write"
  );

  const submitAuthorization = async (action: "approve" | "deny") => {
    if (!(formRef.current && !submittingAction)) {
      return;
    }
    setSubmittingAction(action);
    setErrorMessage(null);

    try {
      const data = mcpAuthorizationInputFromForm(formRef.current);
      const redirectUrl =
        action === "approve"
          ? await approveAuthorization({ data })
          : await denyAuthorization({ data });
      window.location.assign(redirectUrl);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to complete authorization."
      );
      setSubmittingAction(null);
    }
  };

  return (
    <main
      className="flex min-h-svh w-full items-start justify-center bg-background px-4 py-6 text-foreground [@media_(min-height:900px)]:items-center [@media_(min-height:900px)]:py-10"
      style={SHADCN_LIGHT_THEME}
    >
      <section className="w-full max-w-[660px] rounded-lg border border-border/70 bg-card px-7 py-7 shadow-xs sm:px-9 sm:py-8">
        <ConnectionMarks clientName={model.client.name} />

        <h1 className="mt-6 text-center font-semibold text-2xl tracking-normal">
          {model.client.name} is requesting access
        </h1>

        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submitAuthorization("approve");
          }}
          ref={formRef}
        >
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
            <h2 className="font-medium text-muted-foreground text-sm">
              Details
            </h2>
            <div className="overflow-hidden rounded-lg border border-border bg-background">
              <SummaryRow label="Name" value={model.client.name} />
              <SummaryRow
                label="Redirect URI"
                value={model.client.redirectUri}
              />
            </div>
          </div>

          <p className="text-muted-foreground text-sm leading-relaxed">
            This MCP client is requesting to be authorized. If you approve, it
            can use the selected Lightfast organization with the tools listed
            below.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <ContextPanel
              description={model.user.email}
              icon={<HugeiconsIcon className="size-4" icon={User} />}
              label="Signed in as"
              value={model.user.name}
            />

            <div className="rounded-lg border border-border bg-background p-3">
              {model.organizations.length > 1 ? (
                <div className="space-y-2">
                  <label
                    className="flex items-center gap-2 text-muted-foreground text-xs"
                    htmlFor="organizationId"
                  >
                    <HugeiconsIcon className="size-3.5" icon={Building2} />
                    Organization
                  </label>
                  <input
                    name="organizationId"
                    type="hidden"
                    value={organizationId}
                  />
                  <Select
                    onValueChange={setOrganizationId}
                    value={organizationId}
                  >
                    <SelectTrigger
                      aria-label="Organization"
                      className="h-8 w-full bg-background"
                      id="organizationId"
                    >
                      <span className="truncate">
                        {selectedOrganization?.name ?? "Select organization"}
                      </span>
                    </SelectTrigger>
                    <SelectContent style={SHADCN_LIGHT_THEME}>
                      {model.organizations.map((organization) => (
                        <SelectItem
                          key={organization.id}
                          value={organization.id}
                        >
                          {organization.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <>
                  <input
                    name="organizationId"
                    type="hidden"
                    value={organizationId}
                  />
                  <ContextPanelContent
                    description={selectedOrganization?.slug ?? "No slug"}
                    icon={<HugeiconsIcon className="size-4" icon={Building2} />}
                    label="Organization"
                    value={selectedOrganization?.name ?? "No organization"}
                  />
                </>
              )}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {model.client.verified ? null : (
              <WarningRow
                icon={<HugeiconsIcon className="size-4" icon={AlertTriangle} />}
                label="Unverified client"
              />
            )}
            {hasWriteScope ? (
              <WarningRow
                icon={<HugeiconsIcon className="size-4" icon={AlertTriangle} />}
                label="Can write to your workspace"
              />
            ) : null}
          </div>

          <ToolsPreview permissions={model.permissions} />

          {errorMessage ? (
            <p className="text-destructive text-sm">{errorMessage}</p>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <DetailsSheet model={model} />
            <div className="flex justify-end gap-2">
              <Button
                disabled={submittingAction !== null}
                onClick={() => void submitAuthorization("deny")}
                type="button"
                variant="outline"
              >
                {submittingAction === "deny" ? (
                  <Icons.spinner className="size-4 animate-spin" />
                ) : (
                  "Cancel"
                )}
              </Button>
              <Button disabled={submittingAction !== null} type="submit">
                {submittingAction === "approve" ? (
                  <Icons.spinner className="size-4 animate-spin" />
                ) : (
                  "Approve"
                )}
              </Button>
            </div>
          </div>
        </form>
      </section>
    </main>
  );
}

function mcpAuthorizationInputFromForm(
  form: HTMLFormElement
): McpAuthorizationInput {
  const formData = new FormData(form);
  return {
    clientId: requireFormString(formData, "clientId"),
    codeChallenge: requireFormString(formData, "codeChallenge"),
    codeChallengeMethod: "S256",
    organizationId: requireFormString(formData, "organizationId"),
    redirectUri: requireFormString(formData, "redirectUri"),
    resource: requireFormString(formData, "resource"),
    scope: optionalFormString(formData, "scope"),
    state: optionalFormString(formData, "state"),
  };
}

function requireFormString(formData: FormData, key: string) {
  const value = optionalFormString(formData, key);
  if (!value) {
    throw new Error(`${key} is required.`);
  }
  return value;
}

function optionalFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function ConnectionMarks({ clientName }: { clientName: string }) {
  return (
    <div className="flex items-center justify-center gap-3">
      <div className="flex size-14 items-center justify-center rounded-lg border border-border bg-background text-foreground shadow-xs">
        <Icons.logoShort className="size-8" />
      </div>
      <HugeiconsIcon
        className="size-4 text-muted-foreground"
        icon={ArrowLeftRight}
      />
      <div className="flex size-14 items-center justify-center rounded-lg bg-foreground font-semibold text-background text-lg shadow-xs">
        {clientName.slice(0, 1).toUpperCase()}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[132px_minmax(0,1fr)] border-border border-t first:border-t-0">
      <div className="px-3.5 py-2.5 font-medium text-sm">{label}</div>
      <div className="min-w-0 break-all px-3.5 py-2.5 text-sm">{value}</div>
    </div>
  );
}

function ContextPanel({
  description,
  icon,
  label,
  value,
}: {
  description: string;
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <ContextPanelContent
        description={description}
        icon={icon}
        label={label}
        value={value}
      />
    </div>
  );
}

function ContextPanelContent({
  description,
  icon,
  label,
  value,
}: {
  description: string;
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-muted-foreground text-xs">{label}</div>
        <div className="mt-1 truncate font-medium text-sm">{value}</div>
        <div className="truncate text-muted-foreground text-xs">
          {description}
        </div>
      </div>
    </div>
  );
}

function WarningRow({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-muted-foreground text-xs">
      <span className="text-foreground">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function ToolsPreview({
  permissions,
}: {
  permissions: McpConsentViewModel["permissions"];
}) {
  return (
    <section className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-center gap-2">
        <h2 className="font-medium text-foreground text-sm">Tools</h2>
        <Badge className="px-1.5 text-muted-foreground" variant="secondary">
          {permissions.length}
        </Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {permissions.map((permission) => (
          <Badge
            className="font-normal"
            key={permission.scope}
            title={permission.description}
            variant="secondary"
          >
            {permission.label}
          </Badge>
        ))}
      </div>
    </section>
  );
}

function DetailsSheet({ model }: { model: McpConsentViewModel }) {
  const selectedOrganization = model.organizations[0];

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="ghost">
          <HugeiconsIcon className="size-4" icon={Info} />
          View details
        </Button>
      </SheetTrigger>
      <SheetContent
        className="gap-0 p-0 sm:max-w-[420px]"
        style={SHADCN_LIGHT_THEME}
      >
        <SheetHeader className="border-border/60 border-b px-5 py-5">
          <div className="mb-2 flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-background text-foreground">
              <Icons.logoShort className="size-5" />
            </div>
            <HugeiconsIcon
              className="size-3.5 text-muted-foreground"
              icon={ArrowLeftRight}
            />
            <div className="flex size-9 items-center justify-center rounded-lg bg-foreground font-semibold text-background text-sm">
              {model.client.name.slice(0, 1).toUpperCase()}
            </div>
          </div>
          <SheetTitle>Connection details</SheetTitle>
          <SheetDescription>
            Review the raw OAuth request before approving access.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <dl className="space-y-0">
            <PropertyRow
              icon={<HugeiconsIcon className="size-4" icon={ShieldCheck} />}
              label="Client"
              value={model.client.name}
            />
            <PropertyRow
              icon={<HugeiconsIcon className="size-4" icon={User} />}
              label="User"
              value={`${model.user.name} (${model.user.email})`}
            />
            <PropertyRow
              icon={<HugeiconsIcon className="size-4" icon={Building2} />}
              label="Organization"
              value={selectedOrganization?.name ?? "No organization"}
            />
          </dl>

          <div className="my-5 border-border/60 border-t" />

          <dl className="space-y-0">
            <DetailRow label="Client ID" value={model.client.id} />
            <DetailRow label="Resource" value={model.request.resource} />
            <DetailRow label="Redirect URI" value={model.request.redirectUri} />
            <DetailRow label="Scopes" value={model.request.scope} />
          </dl>

          <div className="my-5 border-border/60 border-t" />

          <DetailedTools permissions={model.permissions} />
        </div>

        <div className="border-border/60 border-t px-5 py-3.5 text-muted-foreground text-xs">
          Redirects to {model.client.redirectUri}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PropertyRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="flex w-32 shrink-0 items-center gap-2.5 text-muted-foreground text-sm">
        {icon}
        {label}
      </span>
      <dd className="min-w-0 flex-1 break-words text-foreground text-sm">
        {value}
      </dd>
    </div>
  );
}

function DetailedTools({
  permissions,
}: {
  permissions: McpConsentViewModel["permissions"];
}) {
  return (
    <section>
      <div className="flex items-center gap-2">
        <h3 className="font-medium text-foreground text-sm">Tools</h3>
        <Badge className="px-1.5 text-muted-foreground" variant="secondary">
          {permissions.length}
        </Badge>
      </div>
      <div className="mt-2 flex flex-col">
        {permissions.map((permission) => (
          <div
            className="flex items-start gap-3 border-border/60 border-t py-2.5 first:border-t-0"
            key={permission.scope}
          >
            <div className="min-w-0 flex-1">
              <p className="font-mono text-foreground text-sm">
                {permission.scope}
              </p>
              <p className="mt-0.5 text-muted-foreground text-xs leading-relaxed">
                {permission.description}
              </p>
            </div>
            <span
              aria-label={
                permission.kind === "write" ? "Write access" : "Read access"
              }
              className="mt-1.5 size-1.5 shrink-0 rounded-full bg-foreground"
              role="img"
              title={
                permission.kind === "write" ? "Write access" : "Read access"
              }
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-2.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1 break-all font-mono text-foreground text-xs">
        {value}
      </dd>
    </div>
  );
}
