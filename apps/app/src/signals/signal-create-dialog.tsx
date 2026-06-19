import {
  type CreateSignalInput,
  createSignal,
} from "@api/app/tanstack/signals";
import { Loading03Icon as Loader2 } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { SIGNAL_INPUT_MAX_LENGTH } from "@repo/api-contract";
import { Avatar, AvatarFallback } from "@repo/ui/components/ui/avatar";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { toast } from "@repo/ui/components/ui/sonner";
import { Switch } from "@repo/ui/components/ui/switch";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import type { ChangeEvent, FormEvent, KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { listUserOrganizationsQueryOptions } from "~/organization/organization-queries";
import { signalQueryKeys } from "./signals-queries";

interface SignalCreateDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

const SIGNAL_CREATE_DRAFT_PREFIX = "lightfast:create-signal-draft:";
const SIGNAL_CREATE_FORM_ID = "signal-create-form";
const CREATE_MORE_STORAGE_KEY = "lightfast:create-signal-more";
const RESERVED_ROUTES = new Set([
  "new",
  "account",
  "api",
  "sign-in",
  "sign-up",
]);

function getPathSlug(pathname: string) {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  return firstSegment && !RESERVED_ROUTES.has(firstSegment)
    ? firstSegment
    : null;
}

function normalizeSignalInput(value: string) {
  return value.replace(/\r\n?/g, "\n").slice(0, SIGNAL_INPUT_MAX_LENGTH);
}

function readSignalDraft(storageKey: string) {
  if (typeof window === "undefined") {
    return "";
  }
  try {
    return window.sessionStorage.getItem(storageKey) ?? "";
  } catch {
    return "";
  }
}

function writeSignalDraft(storageKey: string, value: string) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (value.length === 0) {
      window.sessionStorage.removeItem(storageKey);
      return;
    }
    window.sessionStorage.setItem(storageKey, value);
  } catch {
    // Draft persistence is best-effort and should never block signal creation.
  }
}

function removeSignalDraft(storageKey: string) {
  writeSignalDraft(storageKey, "");
}

function readCreateMore() {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem(CREATE_MORE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCreateMore(value: boolean) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(CREATE_MORE_STORAGE_KEY, value ? "1" : "0");
  } catch {
    // Preference persistence is best-effort.
  }
}

export function SignalCreateDialog({
  onOpenChange,
  open,
}: SignalCreateDialogProps) {
  const queryClient = useQueryClient();
  const { pathname } = useLocation();
  const slug = getPathSlug(pathname);
  const { data: organizations = [] } = useQuery({
    ...listUserOrganizationsQueryOptions({ enabled: open }),
  });
  const org = slug
    ? (organizations.find((organization) => organization.slug === slug) ?? null)
    : null;
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");
  const [createMore, setCreateMore] = useState(false);
  const draftStorageKey = `${SIGNAL_CREATE_DRAFT_PREFIX}${pathname}`;

  const trimmedInput = input.trim();
  const inputLength = input.length;
  const isAtLimit = inputLength === SIGNAL_INPUT_MAX_LENGTH;
  const isOverLimit = inputLength > SIGNAL_INPUT_MAX_LENGTH;
  const formattedInputLength = inputLength.toLocaleString();
  const formattedInputLimit = SIGNAL_INPUT_MAX_LENGTH.toLocaleString();

  const createMutation = useMutation({
    meta: { errorTitle: "Failed to create signal" },
    mutationFn: (data: CreateSignalInput) => createSignal({ data }),
    onSuccess: () => {
      removeSignalDraft(draftStorageKey);
      void queryClient.invalidateQueries({
        queryKey: signalQueryKeys.workingSet(),
      });
      void queryClient.invalidateQueries({
        queryKey: signalQueryKeys.processing(),
      });
      toast.success("Signal queued", {
        description: "Classification will start shortly.",
      });
      setInput("");
      if (createMore) {
        requestAnimationFrame(() => textareaRef.current?.focus());
        return;
      }
      onOpenChange(false);
    },
  });

  useEffect(() => {
    setCreateMore(readCreateMore());
  }, []);

  useEffect(() => {
    if (!open || input.length > 0) {
      return;
    }
    const draft = readSignalDraft(draftStorageKey);
    if (draft.length > 0) {
      setInput(normalizeSignalInput(draft));
    }
  }, [draftStorageKey, input.length, open]);

  const isSubmitDisabled =
    createMutation.isPending || trimmedInput.length === 0 || isOverLimit;

  function handleOpenChange(nextOpen: boolean) {
    if (createMutation.isPending) {
      return;
    }
    onOpenChange(nextOpen);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitDisabled) {
      return;
    }
    createMutation.mutate({ input: trimmedInput });
  }

  function handleInputChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const nextInput = normalizeSignalInput(event.currentTarget.value);
    setInput(nextInput);
    writeSignalDraft(draftStorageKey, nextInput);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      (event.metaKey || event.ctrlKey) &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  function handleCreateMoreChange(next: boolean) {
    setCreateMore(next);
    writeCreateMore(next);
  }

  const footerLeft = (
    <div
      aria-live="polite"
      className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs"
    >
      <span className="shrink-0">
        {formattedInputLength} / {formattedInputLimit} characters
      </span>
      {(isAtLimit || isOverLimit) && (
        <>
          <span aria-hidden="true">·</span>
          <span
            className={
              isOverLimit
                ? "shrink-0 text-destructive"
                : "shrink-0 text-muted-foreground"
            }
          >
            {isOverLimit ? "Too long" : "Limit reached"}
          </span>
        </>
      )}
      {trimmedInput.length === 0 && inputLength > 0 && (
        <>
          <span aria-hidden="true">·</span>
          <span className="shrink-0 text-muted-foreground">
            Add signal text
          </span>
        </>
      )}
    </div>
  );

  const footerRight = (
    <>
      <span className="flex items-center gap-2 text-muted-foreground text-sm">
        <Switch
          aria-label="Create more"
          checked={createMore}
          disabled={createMutation.isPending}
          onCheckedChange={handleCreateMoreChange}
        />
        Create more
      </span>
      <Button
        disabled={isSubmitDisabled}
        form={SIGNAL_CREATE_FORM_ID}
        size="sm"
        type="submit"
      >
        {createMutation.isPending && (
          <HugeiconsIcon
            aria-hidden="true"
            className="size-3.5 animate-spin"
            icon={Loader2}
          />
        )}
        {createMutation.isPending ? "Creating" : "Create signal"}
        {!createMutation.isPending && (
          <kbd className="ml-1 rounded bg-foreground/10 px-1 text-[10px] text-primary-foreground/80">
            ⌘↵
          </kbd>
        )}
      </Button>
    </>
  );

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="gap-0 overflow-hidden rounded-[12px] border-border bg-card p-0 shadow-2xl sm:max-w-2xl">
        <DialogDescription className="sr-only">
          Paste one raw signal to queue it for classification.
        </DialogDescription>

        <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-1">
          <div className="flex min-w-0 items-center gap-2 pr-8 text-sm">
            <Avatar className="size-5">
              <AvatarFallback className="bg-foreground text-[10px] text-background">
                {org?.initials ?? "?"}
              </AvatarFallback>
            </Avatar>
            <span className="truncate font-medium">
              {org?.name ?? "Workspace"}
            </span>
            <span aria-hidden="true" className="text-muted-foreground">
              ›
            </span>
            <DialogTitle className="truncate font-medium text-sm">
              New signal
            </DialogTitle>
          </div>
        </div>

        <form
          aria-label="Create signal"
          className="flex min-h-[14rem] px-4 pb-2"
          id={SIGNAL_CREATE_FORM_ID}
          onSubmit={handleSubmit}
          ref={formRef}
        >
          <Textarea
            aria-label="Signal input"
            autoFocus
            className="field-sizing-fixed h-full max-h-[40vh] min-h-[14rem] flex-1 resize-none overflow-y-auto whitespace-pre-wrap break-words rounded-none border-0 bg-transparent p-0 text-sm leading-6 shadow-none focus-visible:ring-0 dark:bg-transparent"
            disabled={createMutation.isPending}
            maxLength={SIGNAL_INPUT_MAX_LENGTH}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Paste a customer request, support note, product signal, or internal observation..."
            ref={textareaRef}
            value={input}
            wrap="soft"
          />
        </form>

        <div className="flex items-center justify-between gap-3 px-4 pt-2 pb-4">
          <div className="min-w-0">{footerLeft}</div>
          <div className="flex items-center gap-3">{footerRight}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
