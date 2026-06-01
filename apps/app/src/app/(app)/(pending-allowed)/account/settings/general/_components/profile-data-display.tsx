"use client";

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
import { useEffect, useState } from "react";
import { useTRPC } from "~/trpc/react";

import { GithubAccountConnectionSection } from "./github-account-connection-section";

function normalizeUsernameInput(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+/, "");
}

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

  useEffect(() => {
    setName(profile.fullName ?? "");
    setUsername(profile.username ?? "");
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
        queryClient.setQueryData(accountQuery.queryKey, data);
        toast.success("Username created");
      },
    })
  );

  const normalizedName = name.trim();
  const hasUsername = !!profile.username;
  const normalizedUsername = normalizeUsernameInput(username);
  const isSavingName = updateNameMutation.isPending;
  const isCreatingUsername = createUsernameMutation.isPending;
  const canSaveName =
    normalizedName.length > 0 &&
    normalizedName !== (profile.fullName ?? "") &&
    !isSavingName;
  const canCreateUsername =
    !hasUsername && normalizedUsername.length > 0 && !isCreatingUsername;

  function handleNameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSaveName) {
      return;
    }
    updateNameMutation.mutate({ name: normalizedName });
  }

  function handleUsernameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreateUsername) {
      return;
    }
    createUsernameMutation.mutate({
      idempotencyKey: createIdempotencyKey(),
      username: normalizedUsername,
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-medium font-pp text-2xl text-foreground">
          General
        </h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Manage your personal account settings.
        </p>
      </div>

      {/* Avatar Section */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <h2 className="font-semibold text-foreground text-xl">Avatar</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            This is your avatar.
          </p>
        </div>
        <Avatar className="size-10">
          <AvatarFallback className="bg-foreground text-background text-xs">
            {profile.initials}
          </AvatarFallback>
        </Avatar>
      </div>

      {/* Display Name Section */}
      <form className="space-y-4" onSubmit={handleNameSubmit}>
        <div>
          <h2 className="font-semibold text-foreground text-xl">Name</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Please enter your full name, or a display name you are comfortable
            with.
          </p>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <label className="sr-only" htmlFor="account-name">
              Name
            </label>
            <Input
              autoComplete="name"
              className="bg-muted/50"
              id="account-name"
              onChange={(event) => setName(event.target.value)}
              type="text"
              value={name}
            />
          </div>
          <Button disabled={!canSaveName} type="submit" variant="secondary">
            {isSavingName ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving
              </>
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </form>

      {/* Username Section */}
      <form className="space-y-4" onSubmit={handleUsernameSubmit}>
        <div>
          <h2 className="font-semibold text-foreground text-xl">Username</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            This is your stable Lightfast handle.
          </p>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <label className="sr-only" htmlFor="account-username">
              Username
            </label>
            <Input
              autoComplete="username"
              className="bg-muted/50 font-mono"
              disabled={hasUsername}
              id="account-username"
              onChange={(event) =>
                setUsername(normalizeUsernameInput(event.target.value))
              }
              placeholder="ada-dev"
              type="text"
              value={username}
            />
            <p className="mt-2 font-mono text-muted-foreground text-sm">
              lightfast.ai/
              <span className="text-foreground">
                {username || "your-username"}
              </span>
            </p>
          </div>
          <Button
            disabled={!canCreateUsername}
            type="submit"
            variant={hasUsername ? "secondary" : "default"}
          >
            {hasUsername ? (
              <>
                <Check className="h-4 w-4" />
                Username created
              </>
            ) : isCreatingUsername ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating
              </>
            ) : (
              "Create username"
            )}
          </Button>
        </div>
      </form>

      {/* Email Section (Read-only) */}
      <div className="space-y-4">
        <div>
          <h2 className="font-semibold text-foreground text-xl">Email</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Your primary email address.
          </p>
        </div>
        <Input
          className="bg-muted/50"
          disabled
          type="email"
          value={profile.primaryEmailAddress ?? ""}
        />
      </div>

      <GithubAccountConnectionSection />
    </div>
  );
}
