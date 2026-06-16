import type { AppRouterOutputs } from "@api/app";
import { useAuth } from "@clerk/tanstack-react-start";
import { AUTOMATION_PROMPT_MAX_LENGTH } from "@repo/app-validation/schemas";
import { MarkdownContent } from "@repo/ui/components/markdown-content";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { automationUpdateMutationOptions } from "./automations-cache";
import { useAutosaveField } from "./use-autosave-field";

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

  const { fieldProps } = useAutosaveField({
    value: automation.prompt,
    multiline: true,
    onCommit: (next) => update.mutate({ id, prompt: next }),
  });

  if (!canManage) {
    return (
      <MarkdownContent
        className="text-foreground"
        sourcePath="automation.md"
        sourceUrlBase=""
      >
        {automation.prompt}
      </MarkdownContent>
    );
  }

  return (
    <textarea
      {...fieldProps}
      aria-label="Instructions"
      className="field-sizing-content block w-full resize-none break-words bg-transparent p-0 text-foreground text-sm leading-7 outline-none placeholder:text-muted-foreground"
      maxLength={AUTOMATION_PROMPT_MAX_LENGTH}
      placeholder="Describe what this automation should do..."
    />
  );
}
