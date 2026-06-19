import { useAuth } from "@clerk/tanstack-react-start";
import { AUTOMATION_NAME_MAX_LENGTH } from "@repo/app-validation/schemas";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Automation } from "./automations-cache";
import { automationUpdateMutationOptions } from "./automations-mutations";
import { useAutosaveField } from "./use-autosave-field";

export function AutomationNameEditor({
  automation,
}: {
  automation: Automation;
}) {
  const { has, isLoaded } = useAuth();
  const canManage = isLoaded && !!has?.({ role: "org:admin" });

  const qc = useQueryClient();
  const id = automation.publicId;

  const update = useMutation(
    automationUpdateMutationOptions(qc, id, {
      errorTitle: "Failed to rename automation",
    })
  );

  const { fieldProps } = useAutosaveField({
    value: automation.name,
    onCommit: (next) => update.mutate({ id, name: next }),
  });

  if (!canManage) {
    return (
      <h1 className="font-medium font-pp text-3xl text-foreground">
        {automation.name}
      </h1>
    );
  }

  return (
    <textarea
      {...fieldProps}
      aria-label="Automation name"
      className="field-sizing-content block w-full resize-none break-words bg-transparent p-0 font-medium font-pp text-3xl text-foreground leading-tight outline-none placeholder:text-muted-foreground"
      maxLength={AUTOMATION_NAME_MAX_LENGTH}
      placeholder="Untitled automation"
      rows={1}
    />
  );
}
