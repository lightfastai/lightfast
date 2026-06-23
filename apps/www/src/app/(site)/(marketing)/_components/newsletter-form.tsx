"use client";

import { Spinner } from "@repo/ui-v2/components/ui/spinner";
import { type ReactNode, useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  type NewsletterActionState,
  subscribeToNewsletter,
} from "../_actions/newsletter";

const initialState: NewsletterActionState = {
  message: "",
  status: "idle",
};

export function NewsletterForm({
  children,
  resetIcon,
}: {
  children: ReactNode;
  resetIcon: ReactNode;
}) {
  const [resetKey, setResetKey] = useState(0);

  return (
    <NewsletterActionForm
      key={resetKey}
      onReset={() => setResetKey((key) => key + 1)}
      resetIcon={resetIcon}
    >
      {children}
    </NewsletterActionForm>
  );
}

function NewsletterActionForm({
  children,
  onReset,
  resetIcon,
}: {
  children: ReactNode;
  onReset: () => void;
  resetIcon: ReactNode;
}) {
  const [state, formAction, isPending] = useActionState(
    subscribeToNewsletter,
    initialState
  );

  if (state.status !== "idle") {
    return (
      <NewsletterStatusMessage
        onReset={onReset}
        resetIcon={resetIcon}
        state={state}
      />
    );
  }

  return (
    <form action={formAction} className="relative flex items-center">
      <fieldset className="contents" disabled={isPending}>
        {children}
      </fieldset>
    </form>
  );
}

function NewsletterStatusMessage({
  onReset,
  resetIcon,
  state,
}: {
  onReset: () => void;
  resetIcon: ReactNode;
  state: NewsletterActionState;
}) {
  return (
    <div
      className={
        state.status === "success"
          ? "relative flex items-center border border-transparent bg-muted p-3 pr-12 text-xs leading-tight"
          : "relative flex items-center border border-transparent bg-muted p-3 pr-12 text-destructive text-xs leading-tight"
      }
      id="footer-newsletter-status"
      role={state.status === "error" ? "alert" : "status"}
    >
      <p className="min-w-0 flex-1 truncate">{state.message}</p>
      <button
        aria-label="Reset newsletter form"
        className="absolute inset-y-0 right-0 flex h-full cursor-pointer items-center bg-transparent p-3 transition-colors hover:text-muted-foreground focus-visible:text-muted-foreground focus-visible:outline-none"
        onClick={onReset}
        type="button"
      >
        {resetIcon}
      </button>
    </div>
  );
}

export function NewsletterSubmitButton({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <button
      aria-label={pending ? "Subscribing" : undefined}
      className="absolute inset-y-0 right-0 flex h-full cursor-pointer items-center gap-2 bg-transparent p-3 text-xs leading-tight transition-colors hover:text-muted-foreground focus-visible:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:text-muted-foreground"
      disabled={pending}
      type="submit"
    >
      {pending ? (
        <Spinner />
      ) : (
        <>
          <span>Subscribe</span>
          {children}
        </>
      )}
    </button>
  );
}
