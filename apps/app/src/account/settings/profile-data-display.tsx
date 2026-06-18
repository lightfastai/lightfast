import { zodResolver } from "@hookform/resolvers/zod";
import type { AccountSettingsFormValues } from "@repo/app-validation/forms";
import { accountSettingsFormSchema } from "@repo/app-validation/forms";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { useMounted } from "@repo/ui/hooks/use-mounted";
import { useQuery } from "@tanstack/react-query";
import {
  Loading03Icon as Loader2,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect } from "react";
import { SettingRow, SettingsGroup } from "~/components/settings-section";
import { accountProfileQueryOptions } from "../account-queries";
import { useAccountNameUpdate } from "./account-settings-actions";
import { ProfileDataLoading } from "./profile-data-loading";

export function ProfileDataDisplay() {
  const mounted = useMounted();
  const accountQuery = accountProfileQueryOptions();
  const { data: profile, isPending } = useQuery({
    ...accountQuery,
    enabled: typeof window !== "undefined",
    staleTime: 10 * 60 * 1000,
  });

  const currentDisplayName = profile?.fullName ?? "";
  const form = useFormCompat<AccountSettingsFormValues>({
    resolver: zodResolver(accountSettingsFormSchema),
    defaultValues: {
      displayName: currentDisplayName,
    },
    mode: "onChange",
  });

  const { isUpdating, updateDisplayName } = useAccountNameUpdate();
  const { reset } = form;
  const watchedName = form.watch("displayName");
  const hasNameChanges = (watchedName ?? "").trim() !== currentDisplayName;

  useEffect(() => {
    reset({ displayName: currentDisplayName });
  }, [currentDisplayName, reset]);

  const onNameSubmit = useCallback(
    (values: AccountSettingsFormValues) => {
      updateDisplayName(values.displayName);
    },
    [updateDisplayName]
  );

  if (!mounted || isPending || !profile) {
    return <ProfileDataLoading />;
  }

  return (
    <div className="space-y-10">
      <div>
        <h2 className="font-medium font-pp text-foreground text-xl">General</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Manage your personal account settings.
        </p>
      </div>

      <SettingsGroup title="Profile">
        <SettingRow label="Avatar">
          <Avatar className="size-7">
            <AvatarFallback className="bg-foreground text-background text-xs">
              {profile.initials}
            </AvatarFallback>
          </Avatar>
        </SettingRow>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onNameSubmit)}>
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <SettingRow
                  description="Please enter your full name, or a display name you are comfortable with."
                  label="Display name"
                >
                  <FormItem className="space-y-0">
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        <FormControl>
                          <Input
                            {...field}
                            aria-label="Display name"
                            className="w-64"
                            placeholder="Your name"
                            size="lf"
                            type="text"
                            variant="lf"
                          />
                        </FormControl>
                        <Button
                          disabled={
                            !(hasNameChanges && form.formState.isValid) ||
                            isUpdating
                          }
                          size="lf"
                          type="submit"
                        >
                          {isUpdating ? (
                            <>
                              <HugeiconsIcon icon={Loader2} className="size-3.5 animate-spin" />
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

        <SettingRow
          description="This is your stable Lightfast handle."
          label="Username"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Input
                  aria-label="Username"
                  autoComplete="username"
                  className="w-64 bg-muted/50 font-mono"
                  disabled
                  placeholder="ada-dev"
                  readOnly
                  size="lf"
                  type="text"
                  value={profile.username ?? ""}
                  variant="lf"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              Changing your username is disabled for now.
            </TooltipContent>
          </Tooltip>
        </SettingRow>

        <SettingRow description="Your primary email address." label="Email">
          <Input
            aria-label="Email"
            className="w-64 bg-muted/50"
            disabled
            readOnly
            size="lf"
            type="email"
            value={profile.primaryEmailAddress ?? ""}
            variant="lf"
          />
        </SettingRow>
      </SettingsGroup>
    </div>
  );
}
