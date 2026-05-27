"use client";

import type { AppRouterOutputs } from "@api/app";
import { AUTOMATION_PROMPT_MAX_LENGTH } from "@repo/app-validation/schemas";
import { Button } from "@repo/ui/components/ui/button";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@vendor/clerk";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTRPC } from "~/trpc/react";
import { setOne, upsertInList } from "../../_components/automations-cache";

type Automation = AppRouterOutputs["org"]["workspace"]["automations"]["get"];

export function AutomationPromptEditor({
  automation,
}: {
  automation: Automation;
}) {
  const { has, isLoaded } = useAuth();
  const canManage = isLoaded && !!has?.({ role: "org:admin" });
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(automation.prompt);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const qc = useQueryClient();
  const trpc = useTRPC();
  const id = automation.publicId;

  useEffect(() => {
    if (isEditing) {
      textareaRef.current?.focus();
    }
  }, [isEditing]);

  const update = useMutation(
    trpc.org.workspace.automations.update.mutationOptions({
      meta: { errorTitle: "Failed to update prompt" },
      onSuccess: (updated) => {
        setOne(qc, trpc, id, () => updated);
        upsertInList(qc, trpc, id, () => updated);
        setIsEditing(false);
      },
    }),
  );

  const trimmed = value.trim();
  const isTooLong = trimmed.length > AUTOMATION_PROMPT_MAX_LENGTH;
  const isUnchanged = trimmed === automation.prompt;
  const isEmpty = trimmed.length === 0;
  const isSaveDisabled =
    update.isPending || isEmpty || isUnchanged || isTooLong;

  function handleSave() {
    if (isSaveDisabled) return;
    update.mutate({ id, prompt: trimmed });
  }

  function handleCancel() {
    setValue(automation.prompt);
    setIsEditing(false);
  }

  const displayBlock = (
    <p className="text-muted-foreground text-sm whitespace-pre-wrap">
      {automation.prompt}
    </p>
  );

  if (!canManage) {
    return displayBlock;
  }

  if (!isEditing) {
    return (
      <div className="group">
        {displayBlock}
        <button
          className="mt-1 text-muted-foreground text-xs hover:text-foreground transition-colors"
          onClick={() => {
            setValue(automation.prompt);
            setIsEditing(true);
          }}
          type="button"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Textarea
        className="min-h-32"
        onChange={(e) => setValue(e.target.value)}
        ref={textareaRef}
        rows={6}
        value={value}
      />
      <p
        className={`text-xs ${isTooLong ? "text-destructive" : "text-muted-foreground"}`}
      >
        {trimmed.length} / {AUTOMATION_PROMPT_MAX_LENGTH}
      </p>
      <div className="flex gap-2">
        <Button onClick={handleCancel} size="sm" type="button" variant="ghost">
          Cancel
        </Button>
        <Button
          disabled={isSaveDisabled}
          onClick={handleSave}
          size="sm"
          type="button"
        >
          {update.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            "Save"
          )}
        </Button>
      </div>
    </div>
  );
}
