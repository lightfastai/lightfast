"use client";

import { Button } from "@repo/ui/components/ui/button";
import { captureException } from "@sentry/nextjs";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

interface ChatErrorProps {
  error: Error & { digest?: string };
  reset?: () => void;
  unstable_retry?: () => void;
}

export default function ChatError({
  error,
  reset,
  unstable_retry,
}: ChatErrorProps) {
  const pathname = usePathname();
  const slug = pathname.split("/").filter(Boolean)[0] ?? "workspace";
  const retry = unstable_retry ?? reset;

  useEffect(() => {
    captureException(error, {
      extra: { errorDigest: error.digest },
      tags: { route: "workspace-chat" },
    });
  }, [error]);

  return (
    <main className="flex h-full min-h-0 w-full items-center justify-center bg-background px-6 py-10">
      <section className="w-full max-w-xl rounded-sm border border-border/60 px-5 py-6">
        <h2 className="font-medium text-foreground text-lg">
          Couldn&apos;t load this chat
        </h2>
        <p className="mt-2 text-muted-foreground text-sm">
          There was a transient error while loading the conversation.
        </p>
        {error.digest ? (
          <p className="mt-3 text-muted-foreground text-xs">
            Error ID: {error.digest}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {retry ? (
            <Button onClick={() => retry()} size="sm" type="button">
              Try again
            </Button>
          ) : null}
          <Button asChild size="sm" type="button" variant="outline">
            <Link href={`/${slug}/chat` as Route}>New chat</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
