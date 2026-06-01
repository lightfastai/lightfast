"use client";

import type { AppRouterOutputs } from "@api/app";
import { AUTOMATION_PROMPT_MAX_LENGTH } from "@repo/app-validation/schemas";
import { Markdown } from "@repo/ui/components/markdown";
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

  const { editing, begin, fieldProps } = useInlineEdit({
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
    // Borderless, transparent, and typed to match the rendered markdown body so
    // entering edit mode never looks like a textarea popping in.
    return (
      <textarea
        {...fieldProps}
        className="field-sizing-content block w-full resize-none break-words bg-transparent p-0 text-muted-foreground text-sm leading-7 outline-none"
        maxLength={AUTOMATION_PROMPT_MAX_LENGTH}
      />
    );
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: rendered markdown is block content and cannot be nested inside a native <button>
    <div
      className="cursor-text"
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
