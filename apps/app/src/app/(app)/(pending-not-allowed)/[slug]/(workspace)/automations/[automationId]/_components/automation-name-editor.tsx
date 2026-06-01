"use client";

import type { AppRouterOutputs } from "@api/app";
import { AUTOMATION_NAME_MAX_LENGTH } from "@repo/app-validation/schemas";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@vendor/clerk";
import { useTRPC } from "~/trpc/react";
import { automationUpdateMutationOptions } from "../../_components/automations-cache";
import { useInlineEdit } from "./use-inline-edit";

type Automation = AppRouterOutputs["org"]["workspace"]["automations"]["get"];

export function AutomationNameEditor({
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
      errorTitle: "Failed to rename automation",
    })
  );

  const { editing, begin, fieldProps } = useInlineEdit({
    value: automation.name,
    onCommit: (next) => update.mutate({ id, name: next }),
  });

  if (!canManage) {
    return (
      <h1 className="font-medium font-pp text-2xl text-foreground">
        {automation.name}
      </h1>
    );
  }

  if (editing) {
    return (
      <input
        {...fieldProps}
        className="-mx-1 w-full bg-transparent px-1 font-medium font-pp text-2xl text-foreground outline-none"
        maxLength={AUTOMATION_NAME_MAX_LENGTH}
      />
    );
  }

  return (
    <div
      className="-mx-1 cursor-text rounded px-1 transition-colors hover:bg-accent/50"
      onClick={begin}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          begin();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <h1 className="font-medium font-pp text-2xl text-foreground">
        {automation.name}
      </h1>
    </div>
  );
}
