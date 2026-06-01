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
import { useOrganizationList } from "@vendor/clerk";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { useTRPC } from "~/trpc/react";
import { SettingRow, SettingsGroup } from "./settings-section";
import { SourceControlSection } from "./source-control-connection-section";
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
  const { data: sourceControlConnection } = useSuspenseQuery(
    trpc.org.settings.sourceControl.get.queryOptions()
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
        <h2 className="font-medium font-pp text-foreground text-xl">General</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Manage your team's profile and preferences.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsGroup title="Profile">
            <SettingRow label="Avatar">
              <Avatar className="size-7">
                <AvatarFallback className="bg-foreground text-background text-xs">
                  {currentOrg?.initials ?? "?"}
                </AvatarFallback>
              </Avatar>
            </SettingRow>

            <FormField
              control={form.control}
              name="teamName"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-6 space-y-0 py-4">
                  <p className="text-foreground text-sm">Team name</p>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          {...field}
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
                          !(hasChanges && form.formState.isValid) || isUpdating
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
              )}
            />
          </SettingsGroup>
        </form>
      </Form>

      <SourceControlSection
        connection={sourceControlConnection.binding}
        orgSlug={slug}
      />
    </div>
  );
}
