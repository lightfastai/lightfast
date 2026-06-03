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
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { useOrganizationList } from "@vendor/clerk";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { SettingRow, SettingsGroup } from "~/components/settings-section";
import { useTRPC } from "~/trpc/react";
import {
  IdentitySoulEmptyState,
  IdentitySoulSection,
} from "./identity-soul-section";
import {
  normalizeTeamSlugInput,
  useTeamNameUpdate,
} from "./team-general-settings-actions";

interface TeamGeneralSettingsClientProps {
  slug: string;
}

export function TeamGeneralSettingsClient({
  slug,
}: TeamGeneralSettingsClientProps) {
  const router = useRouter();
  const trpc = useTRPC();
  const { setActive } = useOrganizationList();

  const { data: organizations } = useSuspenseQuery({
    ...trpc.viewer.organization.listUserOrganizations.queryOptions(),
    staleTime: 5 * 60 * 1000,
  });
  const identitySettingsQuery = useQuery(
    trpc.org.settings.identity.get.queryOptions()
  );
  const currentOrg = useMemo(
    () => organizations.find((org) => org.slug === slug),
    [organizations, slug]
  );

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

  return (
    <div className="space-y-10">
      <div>
        <h2 className="font-medium font-pp text-2xl text-foreground">
          General
        </h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Manage your team's profile and preferences.
        </p>
      </div>

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

      {identitySettingsQuery.isError &&
      isIdentityNotConfigured(identitySettingsQuery.error) ? (
        <IdentitySoulEmptyState slug={slug} />
      ) : identitySettingsQuery.data ? (
        <IdentitySoulSection identity={identitySettingsQuery.data} />
      ) : null}
    </div>
  );
}

function isIdentityNotConfigured(
  error: unknown
): error is Error & { data: { code: "PRECONDITION_FAILED" } } {
  if (error instanceof TRPCClientError) {
    return error.data?.code === "PRECONDITION_FAILED";
  }
  return (
    !!error &&
    typeof error === "object" &&
    "data" in error &&
    (error as { data?: { code?: unknown } }).data?.code ===
      "PRECONDITION_FAILED"
  );
}
