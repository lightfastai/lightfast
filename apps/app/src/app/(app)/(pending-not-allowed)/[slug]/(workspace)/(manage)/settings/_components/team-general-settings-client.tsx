"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { TeamSettingsFormValues } from "@repo/app-validation/forms";
import { teamSettingsFormSchema } from "@repo/app-validation/forms";
import { Avatar, AvatarFallback } from "@repo/ui/components/ui/avatar";
import { Button } from "@repo/ui/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
  useFormCompat,
} from "@repo/ui/components/ui/form";
import { Input } from "@repo/ui/components/ui/input";
import { toast } from "@repo/ui/components/ui/sonner";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useOrganizationList } from "@vendor/clerk";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTRPC } from "~/trpc/react";

interface TeamGeneralSettingsClientProps {
  slug: string;
}

export function TeamGeneralSettingsClient({
  slug,
}: TeamGeneralSettingsClientProps) {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { setActive } = useOrganizationList();
  const [isUpdating, setIsUpdating] = useState(false);

  const { data: organizations } = useSuspenseQuery({
    ...trpc.viewer.organization.listUserOrganizations.queryOptions(),
    staleTime: 5 * 60 * 1000,
  });
  const currentOrg = organizations.find((org) => org.slug === slug);

  const form = useFormCompat<TeamSettingsFormValues>({
    resolver: zodResolver(teamSettingsFormSchema),
    defaultValues: {
      teamName: slug,
    },
    mode: "onChange",
  });

  const currentFormName = form.watch("teamName");
  const hasChanges = currentFormName !== slug;

  const orgListQueryKey =
    trpc.viewer.organization.listUserOrganizations.queryOptions().queryKey;

  // Optimistic cache update so sidebar and header reflect the new name instantly
  const updateNameMutation = useMutation(
    trpc.org.settings.organization.updateName.mutationOptions({
      meta: { errorTitle: "Failed to update team name" },

      onMutate: async (input) => {
        await queryClient.cancelQueries({ queryKey: orgListQueryKey });
        const previousOrgs = queryClient.getQueryData(orgListQueryKey);
        queryClient.setQueryData(orgListQueryKey, (old: typeof previousOrgs) =>
          old?.map((org) =>
            org.slug === input.slug ? { ...org, slug: input.name } : org
          )
        );
        return { previousOrgs };
      },

      onError: (_err, _input, context) => {
        if (context?.previousOrgs) {
          queryClient.setQueryData(orgListQueryKey, context.previousOrgs);
        }
      },

      onSuccess: async (data) => {
        toast.success("Team updated!", {
          description: `Team name changed to "${data.name}"`,
        });

        // Update Clerk's active organization before navigation
        // This ensures cookies are updated before the RSC request
        try {
          if (setActive) {
            await setActive({ organization: data.id });
          }

          // Refresh router cache to clear any stale RSC data
          router.refresh();

          // Navigate with updated cookies (client-side navigation)
          router.push(`/${data.name}/settings`);
        } catch (error) {
          console.error("Failed to set active organization:", error);
          // Still navigate, but may cause temporary mismatch
          router.push(`/${data.name}/settings`);
        }
      },

      onSettled: () => {
        // Invalidate to ensure consistency with server
        void queryClient.invalidateQueries({ queryKey: orgListQueryKey });
        setIsUpdating(false);
      },
    })
  );

  const onSubmit = async (values: TeamSettingsFormValues) => {
    // Trigger validation
    const isValid = await form.trigger();
    if (!isValid) {
      toast.error("Validation failed", {
        description: "Please fix the errors in the form before submitting.",
      });
      return;
    }

    setIsUpdating(true);

    updateNameMutation.mutate({
      slug,
      name: values.teamName,
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-medium font-pp text-2xl text-foreground">
          General
        </h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Manage your team's profile and preferences.
        </p>
      </div>

      {/* Avatar Section */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <h2 className="font-semibold text-foreground text-xl">Avatar</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            This is your team's avatar.
          </p>
        </div>
        <Avatar className="size-10">
          <AvatarFallback className="bg-foreground text-background text-xs">
            {currentOrg?.initials ?? "?"}
          </AvatarFallback>
        </Avatar>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          {/* Team Name Section */}
          <div className="space-y-4">
            <div>
              <h2 className="font-semibold text-foreground text-xl">
                Team Name
              </h2>
              <p className="mt-1 text-muted-foreground text-sm">
                This is your team's visible name within Lightfast.
              </p>
            </div>

            <FormField
              control={form.control}
              name="teamName"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-2">
                      <FormControl>
                        <Input
                          {...field}
                          onChange={(e) => {
                            // Normalize: lowercase, alphanumeric + hyphens only
                            const normalized = e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9-]/g, "")
                              .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens

                            field.onChange(normalized);
                          }}
                          placeholder="acme-inc"
                          type="text"
                        />
                      </FormControl>
                      <FormDescription>
                        Lowercase letters, numbers, and hyphens (3-39
                        characters)
                      </FormDescription>
                      <FormMessage />
                    </div>
                    <Button
                      disabled={
                        !(hasChanges && form.formState.isValid) || isUpdating
                      }
                      type="submit"
                      variant="secondary"
                    >
                      {isUpdating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save"
                      )}
                    </Button>
                  </div>
                </FormItem>
              )}
            />
          </div>
        </form>
      </Form>
    </div>
  );
}
