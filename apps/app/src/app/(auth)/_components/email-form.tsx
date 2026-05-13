"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { useRouter } from "next/navigation";
import * as React from "react";
import {
  serializeSignInParams,
  serializeSignUpParams,
} from "../_lib/search-params";

interface EmailFormProps {
  action: "sign-in" | "sign-up";
  ticket?: string | null;
}

export function EmailForm({ action, ticket }: EmailFormProps) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      return;
    }
    setSubmitting(true);
    const url =
      action === "sign-in"
        ? serializeSignInParams("/sign-in", { step: "code", email: trimmed })
        : serializeSignUpParams("/sign-up", {
            step: "code",
            email: trimmed,
            ticket: ticket ?? null,
          });
    router.push(url);
  };

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <Input
        autoComplete="email"
        className="bg-background dark:bg-background"
        disabled={submitting}
        name="email"
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email Address"
        required
        size="lg"
        type="email"
        value={email}
      />
      <Button className="w-full" disabled={submitting} size="lg" type="submit">
        Continue with Email
      </Button>
    </form>
  );
}
