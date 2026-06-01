"use client";

import {
  lightfastHandleSchema,
  normalizeLightfastHandle,
} from "@repo/app-validation";
import { Avatar, AvatarFallback } from "@repo/ui/components/ui/avatar";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { toast } from "@repo/ui/components/ui/sonner";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { SettingRow, SettingsGroup } from "~/components/settings-section";
import { useTRPC } from "~/trpc/react";

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
  const [name, setName] = useState(profile.fullName ?? "");
  const [username, setUsername] = useState(profile.username ?? "");
  const usernameIdempotencyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    setName(profile.fullName ?? "");
    setUsername(profile.username ?? "");
    usernameIdempotencyKeyRef.current = null;
  }, [profile.fullName, profile.username]);

  const updateNameMutation = useMutation(
    trpc.viewer.account.updateName.mutationOptions({
      meta: { errorTitle: "Failed to update name" },
      onSuccess: (data) => {
        queryClient.setQueryData(accountQuery.queryKey, data);
        toast.success("Name updated");
      },
    })
  );
  const createUsernameMutation = useMutation(
    trpc.viewer.account.createUsername.mutationOptions({
      meta: { errorTitle: "Failed to create username" },
      onSuccess: (data) => {
        usernameIdempotencyKeyRef.current = null;
        queryClient.setQueryData(accountQuery.queryKey, data);
        toast.success("Username created");
      },
    })
  );

  const normalizedName = name.trim();
  const hasUsername = !!profile.username;
  const parsedUsername = lightfastHandleSchema.safeParse(username);
  const isSavingName = updateNameMutation.isPending;
  const isCreatingUsername = createUsernameMutation.isPending;
  const canSaveName =
    normalizedName.length > 0 &&
    normalizedName !== (profile.fullName ?? "") &&
    !isSavingName;
  const canCreateUsername =
    !hasUsername && parsedUsername.success && !isCreatingUsername;

  function handleNameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSaveName) {
      return;
    }
    updateNameMutation.mutate({ name: normalizedName });
  }

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

        <SettingRow
          description="Please enter your full name, or a display name you are comfortable with."
          label="Display name"
        >
          <form className="flex items-center gap-2" onSubmit={handleNameSubmit}>
            <label className="sr-only" htmlFor="account-name">
              Name
            </label>
            <Input
              autoComplete="name"
              className="w-64 bg-muted/50"
              id="account-name"
              onChange={(event) => setName(event.target.value)}
              size="lf"
              type="text"
              value={name}
              variant="lf"
            />
            <Button disabled={!canSaveName} size="lf" type="submit">
              {isSavingName ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Saving
                </>
              ) : (
                "Save"
              )}
            </Button>
          </form>
        </SettingRow>

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
