"use client";

import type { AppRouterOutputs } from "@api/app";
import { AUTOMATION_PROMPT_MAX_LENGTH } from "@repo/app-validation/schemas";
import { Markdown } from "@repo/ui/components/markdown";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@vendor/clerk";
import { useTRPC } from "~/trpc/react";
import { automationUpdateMutationOptions } from "../../_components/automations-cache";
import { useInlineEdit } from "./use-inline-edit";

type Automation = AppRouterOutputs["org"]["workspace"]["automations"]["get"];

export function AutomationPromptEditor({
  automation,
}: {
  automation: Automation;
}) {
  const { has, isLoaded } = useAuth();
  const canManage = isLoaded && !!has?.({ role: "org:admin" });

  const qc = useQueryClient();
  const trpc = useTRPC();
  const id = automation.publicId;

  const update = useMutation(
    automationUpdateMutationOptions(qc, trpc, id, {
      errorTitle: "Failed to update instructions",
    })
  );

  const { editing, draft, begin, fieldProps } = useInlineEdit({
    value: automation.prompt,
    multiline: true,
    onCommit: (next) => update.mutate({ id, prompt: next }),
  });

  const rendered = (
    <Markdown className="text-muted-foreground">{automation.prompt}</Markdown>
  );

  if (!canManage) {
    return rendered;
  }

  if (editing) {
    const length = draft.trim().length;
    const isTooLong = length > AUTOMATION_PROMPT_MAX_LENGTH;
    return (
      <div className="space-y-1.5">
        <Textarea
          {...fieldProps}
          maxLength={AUTOMATION_PROMPT_MAX_LENGTH}
          variant="lf"
        />
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-xs">
            Markdown supported · ⌘↵ to save · Esc to cancel
          </p>
          <p
            className={`font-mono text-xs ${
              isTooLong ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            {length} / {AUTOMATION_PROMPT_MAX_LENGTH}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="-mx-2 cursor-text rounded-[9px] px-2 py-1 transition-colors hover:bg-accent/50"
      onClick={(event) => {
        // Let links inside the rendered markdown navigate instead of editing.
        if ((event.target as HTMLElement).closest("a")) {
          return;
        }
        begin();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          begin();
        }
      }}
      role="button"
      tabIndex={0}
    >
      {rendered}
    </div>
  );
}
