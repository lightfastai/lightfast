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
import { ChevronDown, Loader2 } from "lucide-react";
import { useState } from "react";
import { useTRPC } from "~/trpc/react";
import { setOne, upsertInList } from "../../_components/automations-cache";
import { LfSelect } from "../../_components/lf-select";
import {
  isTimeBasedKind,
  SCHEDULE_KINDS,
  type ScheduleKind,
  TIMEZONES,
  WEEKDAY_OPTIONS,
} from "../../_components/schedule-options";
import { RailRow } from "./detail-sections";

type Automation = AppRouterOutputs["org"]["workspace"]["automations"]["get"];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function extractFormState(automation: Automation) {
  const kind = automation.scheduleKind as ScheduleKind;
  const config = automation.scheduleConfig as {
    intervalHours?: number;
    time?: string;
    dayOfWeek?: number;
  };
  return {
    kind,
    intervalHours:
      config.intervalHours === undefined ? "1" : String(config.intervalHours),
    time: config.time ?? "09:00",
    dayOfWeek: config.dayOfWeek ?? 1,
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
  const [timezone, setTimezone] = useState(automation.timezone);

  const qc = useQueryClient();
  const trpc = useTRPC();
  const id = automation.publicId;

  const update = useMutation(
    trpc.org.workspace.automations.update.mutationOptions({
      meta: { errorTitle: "Failed to update schedule" },
      onSuccess: (updated) => {
        setOne(qc, trpc, id, () => updated);
        upsertInList(qc, trpc, id, () => updated);
        setOpen(false);
      },
    })
  );

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      const fresh = extractFormState(automation);
      setKind(fresh.kind);
      setIntervalHours(fresh.intervalHours);
      setTime(fresh.time);
      setDayOfWeek(fresh.dayOfWeek);
      setTimezone(automation.timezone);
    }
  }

  const parsedHours = Number.parseInt(intervalHours, 10);
  const hoursValid =
    Number.isInteger(parsedHours) && parsedHours >= 1 && parsedHours <= 24;
  const timeValid = TIME_RE.test(time);
  const fieldValid =
    kind === "manual" ? true : kind === "hourly" ? hoursValid : timeValid;

  const isSaveDisabled = update.isPending || !fieldValid;

  function handleSave() {
    if (isSaveDisabled) {
      return;
    }
    update.mutate({
      id,
      schedule: buildSchedule({ kind, parsedHours, time, dayOfWeek }),
      timezone,
    });
  }

  const repeatsValue = formatAutomationSchedule(automation);

  if (!canManage) {
    return (
      <>
        <RailRow label="Repeats">
          <span className="text-foreground text-sm">{repeatsValue}</span>
        </RailRow>
        <RailRow label="Timezone">
          <span className="text-foreground text-sm">{automation.timezone}</span>
        </RailRow>
      </>
    );
  }

  return (
    <>
      <Popover onOpenChange={handleOpenChange} open={open}>
        <RailRow label="Repeats">
          <PopoverTrigger asChild>
            <button
              className="-mr-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-foreground text-sm transition-colors hover:bg-accent/50"
              type="button"
            >
              {repeatsValue}
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </button>
          </PopoverTrigger>
        </RailRow>
        <PopoverContent align="end" className="w-80 space-y-4 p-4">
          <LfSelect
            className="w-full"
            onValueChange={(v) => setKind(v as ScheduleKind)}
            options={SCHEDULE_KINDS}
            value={kind}
          />

          <div className="min-h-7">
            {kind === "manual" && (
              <p className="text-muted-foreground text-xs">
                Runs only when triggered — no automatic schedule.
              </p>
            )}

            {kind === "hourly" && (
              <div className="flex items-center gap-2.5">
                <span className="text-muted-foreground text-xs">Every</span>
                <Input
                  className="w-14 text-center"
                  max={24}
                  min={1}
                  onChange={(e) => setIntervalHours(e.target.value)}
                  size="lf"
                  type="number"
                  value={intervalHours}
                  variant="lf"
                />
                <span className="text-muted-foreground text-xs">hours</span>
              </div>
            )}

            {(kind === "daily" || kind === "weekdays") && (
              <div className="flex items-center gap-2.5">
                <span className="text-muted-foreground text-xs">At</span>
                <Input
                  className="w-[7rem] [&::-webkit-calendar-picker-indicator]:hidden"
                  onChange={(e) => setTime(e.target.value)}
                  size="lf"
                  type="time"
                  value={time}
                  variant="lf"
                />
                {kind === "weekdays" && (
                  <span className="rounded-md border border-border px-1.5 py-0.5 text-muted-foreground text-xs">
                    Mon–Fri
                  </span>
                )}
              </div>
            )}

            {kind === "weekly" && (
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-muted-foreground text-xs">On</span>
                <LfSelect
                  className="w-32"
                  onValueChange={(v) => setDayOfWeek(Number(v))}
                  options={WEEKDAY_OPTIONS.map((day) => ({
                    label: day.label,
                    value: String(day.value),
                  }))}
                  value={String(dayOfWeek)}
                />
                <span className="text-muted-foreground text-xs">at</span>
                <Input
                  className="w-[7rem] [&::-webkit-calendar-picker-indicator]:hidden"
                  onChange={(e) => setTime(e.target.value)}
                  size="lf"
                  type="time"
                  value={time}
                  variant="lf"
                />
              </div>
            )}
          </div>

          {isTimeBasedKind(kind) && (
            <div className="space-y-1.5">
              <p className="text-muted-foreground text-sm">Timezone</p>
              <LfSelect
                className="w-full"
                onValueChange={setTimezone}
                options={TIMEZONES.map((tz) => ({ label: tz, value: tz }))}
                value={timezone}
              />
            </div>
          )}

          <div className="flex justify-end gap-2.5">
            <Button
              onClick={() => setOpen(false)}
              size="lf"
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              disabled={isSaveDisabled}
              onClick={handleSave}
              size="lf"
              type="button"
            >
              {update.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <RailRow label="Timezone">
        <span className="text-foreground text-sm">{automation.timezone}</span>
      </RailRow>
    </>
  );
}
