"use client";

import type { AppRouterOutputs } from "@api/app";
import {
  type AutomationScheduleInput,
  formatAutomationSchedule,
} from "@repo/app-validation/schemas";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@vendor/clerk";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useTRPC } from "~/trpc/react";
import { setOne, upsertInList } from "../../_components/automations-cache";
import { LfSelect } from "../../_components/lf-select";
import {
  isTimeBasedKind,
  SCHEDULE_KINDS,
  type ScheduleKind,
  WEEKDAY_OPTIONS,
} from "../../_components/schedule-options";
import { RailRow } from "./detail-sections";

type Automation = AppRouterOutputs["org"]["workspace"]["automations"]["get"];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

interface FormState {
  dayOfWeek: number;
  intervalHours: string;
  kind: ScheduleKind;
  time: string;
  timezone: string;
}

function extractFormState(automation: Automation): FormState {
  const config = automation.scheduleConfig as {
    intervalHours?: number;
    time?: string;
    dayOfWeek?: number;
  };
  return {
    kind: automation.scheduleKind as ScheduleKind,
    intervalHours:
      config.intervalHours === undefined ? "1" : String(config.intervalHours),
    time: config.time ?? "09:00",
    dayOfWeek: config.dayOfWeek ?? 1,
    timezone: automation.timezone,
  };
}

function buildSchedule(state: {
  kind: ScheduleKind;
  parsedHours: number;
  time: string;
  dayOfWeek: number;
}): AutomationScheduleInput {
  switch (state.kind) {
    case "manual":
      return { kind: "manual" as const, config: {} };
    case "hourly":
      return {
        kind: "hourly" as const,
        config: { intervalHours: state.parsedHours },
      };
    case "daily":
      return { kind: "daily" as const, config: { time: state.time } };
    case "weekdays":
      return { kind: "weekdays" as const, config: { time: state.time } };
    case "weekly":
      return {
        kind: "weekly" as const,
        config: { dayOfWeek: state.dayOfWeek, time: state.time },
      };
    default:
      return { kind: "manual" as const, config: {} };
  }
}

export function AutomationScheduleEditor({
  automation,
}: {
  automation: Automation;
}) {
  const { has, isLoaded } = useAuth();
  const canManage = isLoaded && !!has?.({ role: "org:admin" });
  const [open, setOpen] = useState(false);

  const initial = extractFormState(automation);
  const [kind, setKind] = useState<ScheduleKind>(initial.kind);
  const [intervalHours, setIntervalHours] = useState(initial.intervalHours);
  const [time, setTime] = useState(initial.time);
  const [dayOfWeek, setDayOfWeek] = useState(initial.dayOfWeek);
  const [timezone, setTimezone] = useState(initial.timezone);

  const qc = useQueryClient();
  const trpc = useTRPC();
  const id = automation.publicId;

  const update = useMutation(
    trpc.org.workspace.automations.update.mutationOptions({
      meta: { errorTitle: "Failed to update schedule" },
      onSuccess: (updated) => {
        setOne(qc, trpc, id, () => updated);
        upsertInList(qc, trpc, id, () => updated);
      },
    })
  );

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      // Re-sync the working state from the server value each time the popover
      // opens, so it never drifts from what landed after the last auto-save.
      const fresh = extractFormState(automation);
      setKind(fresh.kind);
      setIntervalHours(fresh.intervalHours);
      setTime(fresh.time);
      setDayOfWeek(fresh.dayOfWeek);
      setTimezone(fresh.timezone);
    }
  }

  // Auto-save: every control commits immediately. `next` carries the value that
  // just changed; the rest is read from current state. A still-invalid draft
  // (a half-typed interval) is skipped until it parses.
  function commit(next: Partial<FormState>) {
    const merged: FormState = {
      kind,
      intervalHours,
      time,
      dayOfWeek,
      timezone,
      ...next,
    };
    const parsedHours = Number.parseInt(merged.intervalHours, 10);
    const hoursValid =
      Number.isInteger(parsedHours) && parsedHours >= 1 && parsedHours <= 24;
    const timeValid = TIME_RE.test(merged.time);
    const valid =
      merged.kind === "manual"
        ? true
        : merged.kind === "hourly"
          ? hoursValid
          : timeValid;
    if (!valid) {
      return;
    }
    update.mutate({
      id,
      schedule: buildSchedule({
        kind: merged.kind,
        parsedHours,
        time: merged.time,
        dayOfWeek: merged.dayOfWeek,
      }),
      timezone: merged.timezone,
    });
  }

  function handleKindChange(value: string) {
    const nextKind = value as ScheduleKind;
    setKind(nextKind);
    commit({ kind: nextKind });
  }

  function handleDayChange(value: string) {
    const nextDay = Number(value);
    setDayOfWeek(nextDay);
    commit({ dayOfWeek: nextDay });
  }

  function handleTimeChange(value: string) {
    setTime(value);
    commit({ time: value });
  }

  const repeatsValue = formatAutomationSchedule(automation);
  const serverTimeBased = isTimeBasedKind(
    automation.scheduleKind as ScheduleKind
  );

  if (!canManage) {
    return (
      <>
        <RailRow label="Repeats">
          <span className="text-foreground text-sm">{repeatsValue}</span>
        </RailRow>
        {serverTimeBased && (
          <RailRow label="Timezone">
            <span className="text-foreground text-sm">
              {automation.timezone}
            </span>
          </RailRow>
        )}
      </>
    );
  }

  return (
    <>
      <Popover onOpenChange={handleOpenChange} open={open}>
        <RailRow label="Repeats">
          <PopoverTrigger asChild>
            <Button size="lf" type="button" variant="secondary">
              {repeatsValue}
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
        </RailRow>
        <PopoverContent
          align="end"
          className="w-56 space-y-1 rounded-[13px] p-[5px]"
        >
          <LfSelect
            className="w-full"
            onValueChange={handleKindChange}
            options={SCHEDULE_KINDS}
            value={kind}
          />

          {kind === "hourly" && (
            <div className="flex items-center gap-2.5">
              <span className="text-muted-foreground text-xs">Every</span>
              <Input
                className="w-16 text-center"
                max={24}
                min={1}
                onBlur={() => commit({})}
                onChange={(e) => setIntervalHours(e.target.value)}
                size="lf"
                type="number"
                value={intervalHours}
                variant="lf"
              />
              <span className="text-muted-foreground text-xs">hours</span>
            </div>
          )}

          {kind === "weekly" && (
            <LfSelect
              className="w-full"
              onValueChange={handleDayChange}
              options={WEEKDAY_OPTIONS.map((day) => ({
                label: day.label,
                value: String(day.value),
              }))}
              value={String(dayOfWeek)}
            />
          )}

          {(kind === "daily" || kind === "weekdays" || kind === "weekly") && (
            <Input
              className="w-full [&::-webkit-calendar-picker-indicator]:opacity-70 dark:[&::-webkit-calendar-picker-indicator]:invert"
              onChange={(e) => handleTimeChange(e.target.value)}
              size="lf"
              type="time"
              value={time}
              variant="lf"
            />
          )}
        </PopoverContent>
      </Popover>
      {serverTimeBased && (
        <RailRow label="Timezone">
          <span className="text-foreground text-sm">{automation.timezone}</span>
        </RailRow>
      )}
    </>
  );
}
