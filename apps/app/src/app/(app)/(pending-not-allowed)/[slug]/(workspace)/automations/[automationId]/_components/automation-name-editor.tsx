"use client";

import type { AppRouterOutputs } from "@api/app";
import { AUTOMATION_NAME_MAX_LENGTH } from "@repo/app-validation/schemas";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@vendor/clerk";
import { useState } from "react";
import { useTRPC } from "~/trpc/react";
import {
  setOne,
  upsertInList,
} from "../../_components/automations-cache";

type Automation = AppRouterOutputs["org"]["workspace"]["automations"]["get"];

export function AutomationNameEditor({
  automation,
}: {
  automation: Automation;
}) {
  const { has, isLoaded } = useAuth();
  const canManage = isLoaded && !!has?.({ role: "org:admin" });
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(automation.name);

  const qc = useQueryClient();
  const trpc = useTRPC();
  const id = automation.publicId;

  const getKey = trpc.org.workspace.automations.get.queryOptions({ id }).queryKey;
  const listKey = trpc.org.workspace.automations.list.queryOptions().queryKey;

  const updateMutation = useMutation(
    trpc.org.workspace.automations.update.mutationOptions({
      meta: { errorTitle: "Failed to rename automation" },
      onMutate: async ({ name: newName }) => {
        await Promise.all([
          qc.cancelQueries({ queryKey: getKey }),
          qc.cancelQueries({ queryKey: listKey }),
        ]);
        const prevGet = qc.getQueryData(getKey);
        const prevList = qc.getQueryData(listKey);
        setOne(qc, trpc, id, (a) => ({ ...a!, name: newName! }));
        upsertInList(qc, trpc, id, (a) => ({ ...a!, name: newName! }));
        return { prevGet, prevList };
      },
      onError: (_e, _v, ctx) => {
        if (ctx?.prevGet) qc.setQueryData(getKey, ctx.prevGet);
        if (ctx?.prevList) qc.setQueryData(listKey, ctx.prevList);
      },
      onSuccess: (updated) => {
        setOne(qc, trpc, id, () => updated);
        upsertInList(qc, trpc, id, () => updated);
        setOpen(false);
      },
    }),
  );

  const trimmed = value.trim();
  const isTooLong = trimmed.length > AUTOMATION_NAME_MAX_LENGTH;
  const isUnchanged = trimmed === automation.name;
  const isEmpty = trimmed.length === 0;
  const isSaveDisabled = isEmpty || isUnchanged || isTooLong || updateMutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSaveDisabled) return;
    updateMutation.mutate({ id, name: trimmed });
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setValue(automation.name);
    }
  }

  const heading = (
    <h1 className="font-medium font-pp text-2xl text-foreground">
      {automation.name}
    </h1>
  );

  if (!canManage) {
    return heading;
  }

  return (
    <Popover onOpenChange={handleOpenChange} open={open}>
      <PopoverTrigger asChild>
        <button
          className="rounded px-1 -mx-1 text-left hover:bg-accent/50 transition-colors"
          type="button"
        >
          {heading}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3">
        <form className="space-y-3" onSubmit={handleSubmit}>
          <Input
            autoFocus
            maxLength={AUTOMATION_NAME_MAX_LENGTH + 1}
            onChange={(e) => setValue(e.target.value)}
            value={value}
          />
          {isTooLong && (
            <p className="text-destructive text-xs">
              Name must be {AUTOMATION_NAME_MAX_LENGTH} characters or fewer.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => setOpen(false)}
              size="sm"
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              disabled={isSaveDisabled}
              size="sm"
              type="submit"
            >
              Save
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
