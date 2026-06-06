"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { TeamSettingsFormValues } from "@repo/app-validation/forms";
import { teamSettingsFormSchema } from "@repo/app-validation/forms";
import { Avatar, AvatarFallback } from "@repo/ui/components/ui/avatar";
import { Button } from "@repo/ui/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  useFormCompat,
} from "@repo/ui/components/ui/form";
import { Input } from "@repo/ui/components/ui/input";
import { toast } from "@repo/ui/components/ui/sonner";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useAuth, useOrganizationList } from "@vendor/clerk";
import { Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SettingRow, SettingsGroup } from "~/components/settings-section";
import { useTRPC } from "~/trpc/react";
import {
  normalizeTeamDomainList,
  normalizeTeamSlugInput,
  parseTeamDomainInput,
  useTeamDomainsUpdate,
  useTeamNameUpdate,
} from "./team-general-settings-actions";

interface TeamGeneralSettingsClientProps {
  slug: string;
}

function areDomainListsEqual(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((domain, index) => domain === right[index])
  );
}

export function TeamGeneralSettingsClient({
  slug,
}: TeamGeneralSettingsClientProps) {
  const router = useRouter();
  const trpc = useTRPC();
  const { has, isLoaded } = useAuth();
  const { setActive } = useOrganizationList();
  const canManageDomains = isLoaded && !!has?.({ role: "org:admin" });

  const { data: organizations } = useSuspenseQuery({
    ...trpc.viewer.organization.listUserOrganizations.queryOptions(),
    staleTime: 5 * 60 * 1000,
  });
  const { data: organizationDomains } = useSuspenseQuery({
    ...trpc.org.settings.organization.listDomains.queryOptions({ slug }),
    staleTime: 5 * 60 * 1000,
  });
  const currentOrg = useMemo(
    () => organizations.find((org) => org.slug === slug),
    [organizations, slug]
  );
  const currentDomainNames = useMemo(
    () => organizationDomains.domains.map((domain) => domain.name),
    [organizationDomains]
  );
  const [draftDomains, setDraftDomains] = useState(currentDomainNames);
  const [domainInput, setDomainInput] = useState("");

  useEffect(() => {
    setDraftDomains((current) =>
      areDomainListsEqual(current, currentDomainNames)
        ? current
        : currentDomainNames
    );
  }, [currentDomainNames]);

  const form = useFormCompat<TeamSettingsFormValues>({
    resolver: zodResolver(teamSettingsFormSchema),
    defaultValues: {
      teamName: slug,
    },
    mode: "onChange",
  });

  const currentFormName = form.watch("teamName");
  const hasChanges = currentFormName !== slug;

  const handleTeamUpdated = useCallback(
    async (data: { id: string; name: string }) => {
      try {
        if (setActive) {
          await setActive({ organization: data.id });
        }

        router.refresh();
        router.push(`/${data.name}/settings`);
      } catch (error) {
        console.error("Failed to set active organization:", error);
        router.push(`/${data.name}/settings`);
      }
    },
    [router, setActive]
  );
  const { isUpdating, updateTeamName } = useTeamNameUpdate({
    onUpdated: handleTeamUpdated,
  });
  const { isUpdatingDomains, updateTeamDomains } = useTeamDomainsUpdate({
    onError: () => {
      setDraftDomains(currentDomainNames);
    },
    onUpdated: (domains) => {
      setDraftDomains(domains.map((domain) => domain.name));
    },
    slug,
  });
  const isDomainEditorDisabled = isUpdatingDomains || !canManageDomains;

  const onSubmit = useCallback(
    async (values: TeamSettingsFormValues) => {
      // Trigger validation
      const isValid = await form.trigger();
      if (!isValid) {
        toast.error("Validation failed", {
          description: "Please fix the errors in the form before submitting.",
        });
        return;
      }

      updateTeamName(values.teamName, slug);
    },
    [form, slug, updateTeamName]
  );

  const handleTeamNameChange = useCallback(
    (
      fieldOnChange: (...event: unknown[]) => void,
      event: React.ChangeEvent<HTMLInputElement>
    ) => {
      fieldOnChange(normalizeTeamSlugInput(event.target.value));
    },
    []
  );

  const commitDomains = useCallback(
    (domains: string[]) => {
      if (!canManageDomains) {
        return;
      }

      const nextDomains = normalizeTeamDomainList(domains);
      if (areDomainListsEqual(nextDomains, draftDomains)) {
        return;
      }

      setDraftDomains(nextDomains);
      updateTeamDomains(nextDomains);
    },
    [canManageDomains, draftDomains, updateTeamDomains]
  );

  const addDomainInput = useCallback(() => {
    const parsedDomains = parseTeamDomainInput(domainInput);
    if (parsedDomains.length === 0) {
      return;
    }
    commitDomains([...draftDomains, ...parsedDomains]);
    setDomainInput("");
  }, [commitDomains, domainInput, draftDomains]);

  const handleDomainKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (
        (event.key === "Enter" ||
          event.key === "," ||
          (event.key === "Tab" && domainInput.trim())) &&
        domainInput.trim()
      ) {
        event.preventDefault();
        addDomainInput();
      }
    },
    [addDomainInput, domainInput]
  );

  const handleDomainPaste = useCallback(
    (event: React.ClipboardEvent<HTMLInputElement>) => {
      const pastedDomains = parseTeamDomainInput(
        event.clipboardData.getData("text")
      );
      if (pastedDomains.length <= 1) {
        return;
      }

      event.preventDefault();
      commitDomains([...draftDomains, ...pastedDomains]);
      setDomainInput("");
    },
    [commitDomains, draftDomains]
  );

  const removeDomain = useCallback(
    (domainToRemove: string) => {
      commitDomains(draftDomains.filter((domain) => domain !== domainToRemove));
    },
    [commitDomains, draftDomains]
  );

  return (
    <div className="space-y-10">
      <SettingsGroup title="Profile">
        <SettingRow label="Avatar">
          <Avatar className="size-7">
            <AvatarFallback className="bg-foreground text-background text-xs">
              {currentOrg?.initials ?? "?"}
            </AvatarFallback>
          </Avatar>
        </SettingRow>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="teamName"
              render={({ field }) => (
                <SettingRow
                  description="This is your team's visible name within Lightfast. Lowercase letters, numbers, and hyphens (3-39 characters)."
                  label="Team name"
                >
                  <FormItem className="space-y-0">
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        <FormControl>
                          <Input
                            {...field}
                            aria-label="Team name"
                            className="w-64"
                            onChange={(event) =>
                              handleTeamNameChange(field.onChange, event)
                            }
                            placeholder="acme-inc"
                            size="lf"
                            type="text"
                            variant="lf"
                          />
                        </FormControl>
                        <Button
                          disabled={
                            !(hasChanges && form.formState.isValid) ||
                            isUpdating
                          }
                          size="lf"
                          type="submit"
                        >
                          {isUpdating ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin" />
                              Saving
                            </>
                          ) : (
                            "Save"
                          )}
                        </Button>
                      </div>
                      <FormMessage className="text-xs" />
                    </div>
                  </FormItem>
                </SettingRow>
              )}
            />
          </form>
        </Form>
      </SettingsGroup>

      {organizationDomains.enabled ? (
        <SettingsGroup title="Domains">
          <div className="space-y-3 py-4">
            <p className="text-muted-foreground text-sm leading-relaxed">
              People with matching email domains will automatically join this
              team.
            </p>
            <div className="flex min-h-12 w-full flex-wrap items-center gap-2 rounded-[9px] border border-input bg-card px-2.5 py-2 shadow-none transition-[color,box-shadow,background-color] focus-within:bg-background focus-within:shadow-[inset_0_0_0_1px_var(--ring)]">
              {draftDomains.map((domain) => (
                <span
                  className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-md bg-muted px-2.5 text-foreground text-sm"
                  key={domain}
                >
                  <span className="truncate">{domain}</span>
                  <button
                    aria-label={`Remove ${domain}`}
                    className="inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                    disabled={isDomainEditorDisabled}
                    onClick={() => removeDomain(domain)}
                    type="button"
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
              <input
                aria-label="Add domain"
                className="h-7 min-w-36 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
                disabled={isDomainEditorDisabled}
                onBlur={addDomainInput}
                onChange={(event) => setDomainInput(event.target.value)}
                onKeyDown={handleDomainKeyDown}
                onPaste={handleDomainPaste}
                placeholder={draftDomains.length === 0 ? "lightfast.ai" : ""}
                type="text"
                value={domainInput}
              />
              {isUpdatingDomains ? (
                <Loader2
                  aria-label="Saving domains"
                  className="size-3.5 animate-spin text-muted-foreground"
                />
              ) : null}
            </div>
          </div>
        </SettingsGroup>
      ) : null}
    </div>
  );
}
