"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  lightfastHandleSchema,
  normalizeLightfastHandle,
} from "@repo/app-validation";
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
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import type { FormEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SettingRow, SettingsGroup } from "~/components/settings-section";
import { useTRPC } from "~/trpc/react";
import { useAccountNameUpdate } from "./account-settings-actions";

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `username-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function ProfileDataDisplay() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const accountQuery = trpc.viewer.account.get.queryOptions();

  const { data: profile } = useSuspenseQuery({
    ...accountQuery,
    staleTime: 10 * 60 * 1000,
  });

  const currentDisplayName = profile.fullName ?? "";
  const form = useFormCompat<AccountSettingsFormValues>({
    resolver: zodResolver(accountSettingsFormSchema),
    defaultValues: {
      displayName: currentDisplayName,
    },
    mode: "onChange",
  });

  const { isUpdating, updateDisplayName } = useAccountNameUpdate();
  const watchedName = form.watch("displayName");
  const hasNameChanges = (watchedName ?? "").trim() !== currentDisplayName;

  const [username, setUsername] = useState(profile.username ?? "");
  const usernameIdempotencyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    form.reset({ displayName: currentDisplayName });
    setUsername(profile.username ?? "");
    usernameIdempotencyKeyRef.current = null;
  }, [currentDisplayName, form, profile.username]);

  const createUsernameMutation = useMutation(
    trpc.viewer.account.createUsername.mutationOptions({
      meta: { errorTitle: "Failed to create username" },
      onSuccess: (data) => {
        usernameIdempotencyKeyRef.current = null;
        queryClient.setQueryData(accountQuery.queryKey, data);
      },
    })
  );

  const hasUsername = !!profile.username;
  const parsedUsername = lightfastHandleSchema.safeParse(username);
  const isCreatingUsername = createUsernameMutation.isPending;
  const canCreateUsername =
    !hasUsername && parsedUsername.success && !isCreatingUsername;

  const onNameSubmit = useCallback(
    (values: AccountSettingsFormValues) => {
      updateDisplayName(values.displayName);
    },
    [updateDisplayName]
  );

  function handleUsernameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!(canCreateUsername && parsedUsername.success)) {
      return;
    }
    usernameIdempotencyKeyRef.current ??= createIdempotencyKey();
    createUsernameMutation.mutate({
      idempotencyKey: usernameIdempotencyKeyRef.current,
      username: parsedUsername.data,
    });
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

        <SettingRow
          description="This is your stable Lightfast handle."
          label="Username"
        >
          <form
            className="flex flex-col items-end gap-2"
            onSubmit={handleUsernameSubmit}
          >
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor="account-username">
                Username
              </label>
              <Input
                autoComplete="username"
                className="w-64 bg-muted/50 font-mono"
                disabled={hasUsername}
                id="account-username"
                onChange={(event) => {
                  setUsername(normalizeLightfastHandle(event.target.value));
                  usernameIdempotencyKeyRef.current = null;
                }}
                placeholder="ada-dev"
                size="lf"
                type="text"
                value={username}
                variant="lf"
              />
              <Button
                disabled={!canCreateUsername}
                size="lf"
                type="submit"
                variant={hasUsername ? "secondary" : "default"}
              >
                {hasUsername ? (
                  <>
                    <Check className="size-3.5" />
                    Username created
                  </>
                ) : isCreatingUsername ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Creating
                  </>
                ) : (
                  "Create username"
                )}
              </Button>
            </div>
            <p className="font-mono text-muted-foreground text-sm">
              lightfast.ai/
              <span className="text-foreground">
                {username || "your-username"}
              </span>
            </p>
          </form>
        </SettingRow>

        <SettingRow description="Your primary email address." label="Email">
          <Input
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
