"use client";

import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTRPC } from "~/trpc/react";

interface UsernameAccountTaskClientProps {
  returnTo?: string;
}

const DEFAULT_RETURN_TO = "/account/teams/new";
const USERNAME_TASK_PATH = "/account/tasks/username";

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

function normalizeReturnTo(returnTo: string | undefined): Route {
  if (returnTo?.startsWith("/") !== true || returnTo.startsWith("//")) {
    return DEFAULT_RETURN_TO;
  }

  try {
    const url = new URL(returnTo, "https://lightfast.localhost");
    if (url.origin !== "https://lightfast.localhost") {
      return DEFAULT_RETURN_TO;
    }

    const path = `${url.pathname}${url.search}${url.hash}`;
    if (
      path === USERNAME_TASK_PATH ||
      path.startsWith(`${USERNAME_TASK_PATH}?`) ||
      path.startsWith("/sign-in") ||
      path.startsWith("/sign-up")
    ) {
      return DEFAULT_RETURN_TO;
    }

    return path as Route;
  } catch {
    return DEFAULT_RETURN_TO;
  }
}

export function UsernameAccountTaskClient({
  returnTo,
}: UsernameAccountTaskClientProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const accountQuery = trpc.viewer.account.get.queryOptions();
  const { data: profile } = useSuspenseQuery(accountQuery);
  const [username, setUsername] = useState(profile.username ?? "");
  const [error, setError] = useState<string>();
  const idempotencyKeyRef = useRef<string | null>(null);
  const targetPath = normalizeReturnTo(returnTo);

  const createUsernameMutation = useMutation(
    trpc.viewer.account.createUsername.mutationOptions({
      meta: { suppressErrorToast: true },
      onSuccess: (data) => {
        idempotencyKeyRef.current = null;
        queryClient.setQueryData(accountQuery.queryKey, data);
        router.replace(targetPath);
      },
      onError: (err) => {
        setError(err.message ?? "Failed to create username. Please try again.");
      },
    })
  );

  useEffect(() => {
    if (profile.username) {
      router.replace(targetPath);
    }
  }, [profile.username, router, targetPath]);

  const normalizedUsername = normalizeUsernameInput(username);
  const canContinue =
    !profile.username &&
    normalizedUsername.length > 0 &&
    !createUsernameMutation.isPending;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canContinue) {
      return;
    }

    idempotencyKeyRef.current ??= createIdempotencyKey();
    setError(undefined);
    createUsernameMutation.mutate({
      idempotencyKey: idempotencyKeyRef.current,
      username: normalizedUsername,
    });
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 pb-32">
      <div className="w-full max-w-md space-y-4">
        <div className="w-fit rounded-sm bg-card p-3">
          <Icons.logoShort className="h-5 w-5 text-foreground" />
        </div>

        <div className="space-y-4">
          <h1 className="pb-4 font-medium font-pp text-2xl text-foreground">
            Choose your username
          </h1>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <p className="text-muted-foreground text-sm">
              Pick the stable Lightfast handle people will use to find you.
            </p>

            {error ? (
              <div
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm"
                role="alert"
              >
                {error}
              </div>
            ) : null}

            <div className="space-y-2">
              <label
                className="font-medium text-muted-foreground text-sm"
                htmlFor="account-task-username"
              >
                Username
              </label>
              <Input
                autoComplete="username"
                autoFocus
                className="font-mono"
                disabled={!!profile.username}
                id="account-task-username"
                onChange={(event) => {
                  setUsername(normalizeUsernameInput(event.target.value));
                  idempotencyKeyRef.current = null;
                  setError(undefined);
                }}
                placeholder="ada-dev"
                required
                type="text"
                value={username}
              />
              <p className="font-mono text-muted-foreground text-sm">
                lightfast.ai/
                <span className="text-foreground">
                  {username || "your-username"}
                </span>
              </p>
            </div>

            <Button className="w-full" disabled={!canContinue} type="submit">
              {createUsernameMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
