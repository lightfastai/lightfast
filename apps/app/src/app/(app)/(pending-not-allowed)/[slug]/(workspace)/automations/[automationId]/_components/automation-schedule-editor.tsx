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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@vendor/clerk";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useTRPC } from "~/trpc/react";
import { setOne, upsertInList } from "../../_components/automations-cache";
import {
  isTimeBasedKind,
  SCHEDULE_KINDS,
  type ScheduleKind,
  TIMEZONES,
  WEEKDAY_OPTIONS,
} from "../../_components/schedule-options";
import { RailSection } from "./rail-section";

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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground text-[12.5px]">{label}</span>
      <span className="text-foreground text-[12.5px]">{value}</span>
    </div>
  );
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
    kind === "manual"
      ? true
      : kind === "hourly"
        ? hoursValid
        : timeValid;

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

  const display = (
    <div className="space-y-1">
      <DetailRow label="Repeats" value={formatAutomationSchedule(automation)} />
      <DetailRow label="Timezone" value={automation.timezone} />
    </div>
  );

  if (!canManage) {
    return <RailSection label="Schedule">{display}</RailSection>;
  }

  return (
    <RailSection label="Schedule">
      <Popover onOpenChange={handleOpenChange} open={open}>
        <PopoverTrigger asChild>
          <button
            className="-mx-1 w-full rounded-[9px] px-1 py-0.5 text-left transition-colors hover:bg-accent/50"
            type="button"
          >
            {display}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 space-y-4 p-4">
          <Tabs onValueChange={(v) => setKind(v as ScheduleKind)} value={kind}>
            <TabsList variant="underline">
              {SCHEDULE_KINDS.map((option) => (
                <TabsTrigger
                  key={option.value}
                  value={option.value}
                  variant="underline"
                >
                  {option.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="min-h-[30px]">
            {kind === "manual" && (
              <p className="font-mono text-[10.5px] text-muted-foreground">
                Runs only when triggered — no automatic schedule.
              </p>
            )}

            {kind === "hourly" && (
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-[10.5px] text-muted-foreground">
                  Every
                </span>
                <Input
                  className="w-14 text-center font-mono"
                  max={24}
                  min={1}
                  onChange={(e) => setIntervalHours(e.target.value)}
                  size="lf"
                  type="number"
                  value={intervalHours}
                  variant="lf"
                />
                <span className="font-mono text-[10.5px] text-muted-foreground">
                  hours
                </span>
              </div>
            )}

            {(kind === "daily" || kind === "weekdays") && (
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-[10.5px] text-muted-foreground">
                  At
                </span>
                <Input
                  className="w-[7rem] font-mono [&::-webkit-calendar-picker-indicator]:hidden"
                  onChange={(e) => setTime(e.target.value)}
                  size="lf"
                  type="time"
                  value={time}
                  variant="lf"
                />
                {kind === "weekdays" && (
                  <span className="rounded-md border border-border px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                    Mon–Fri
                  </span>
                )}
              </div>
            )}

            {kind === "weekly" && (
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-mono text-[10.5px] text-muted-foreground">
                  On
                </span>
                <Select
                  onValueChange={(v) => setDayOfWeek(Number(v))}
                  value={String(dayOfWeek)}
                >
                  <SelectTrigger className="w-32" variant="lf">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKDAY_OPTIONS.map((day) => (
                      <SelectItem key={day.value} value={String(day.value)}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="font-mono text-[10.5px] text-muted-foreground">
                  at
                </span>
                <Input
                  className="w-[7rem] font-mono [&::-webkit-calendar-picker-indicator]:hidden"
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
              <p className="font-mono text-[11px] text-muted-foreground">
                Timezone
              </p>
              <Select onValueChange={setTimezone} value={timezone}>
                <SelectTrigger className="w-full" variant="lf">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end gap-2.5">
            <Button
              className="h-[30px] rounded-[9px]"
              onClick={() => setOpen(false)}
              size="sm"
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              className="h-[30px] rounded-[9px]"
              disabled={isSaveDisabled}
              onClick={handleSave}
              size="sm"
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
    </RailSection>
  );
}
