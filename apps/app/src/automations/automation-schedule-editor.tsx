import { useAuth } from "@clerk/tanstack-react-start";
import { ChevronDownIcon as ChevronDown } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
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
} from "@repo/ui-v2/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Automation } from "./automations-cache";
import { automationUpdateMutationOptions } from "./automations-mutations";
import { RailRow } from "./detail-sections";
import {
  getScheduleKindLabel,
  getWeekdayLabel,
  isTimeBasedKind,
  SCHEDULE_KINDS,
  type ScheduleKind,
  WEEKDAY_OPTIONS,
} from "./schedule-options";

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
      return { kind: "manual", config: {} };
    case "hourly":
      return {
        kind: "hourly",
        config: { intervalHours: state.parsedHours },
      };
    case "daily":
      return { kind: "daily", config: { time: state.time } };
    case "weekdays":
      return { kind: "weekdays", config: { time: state.time } };
    case "weekly":
      return {
        kind: "weekly",
        config: { dayOfWeek: state.dayOfWeek, time: state.time },
      };
    default:
      return { kind: "manual", config: {} };
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
  const id = automation.publicId;

  const update = useMutation(
    automationUpdateMutationOptions(qc, id, {
      errorTitle: "Failed to update schedule",
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
      setTimezone(fresh.timezone);
    }
  }

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
        {serverTimeBased ? (
          <RailRow label="Timezone">
            <span className="text-foreground text-sm">
              {automation.timezone}
            </span>
          </RailRow>
        ) : null}
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
              <HugeiconsIcon
                className="size-3.5 text-muted-foreground"
                icon={ChevronDown}
              />
            </Button>
          </PopoverTrigger>
        </RailRow>
        <PopoverContent
          align="end"
          className="w-56 space-y-1 rounded-[13px] p-[5px]"
        >
          <Select
            onValueChange={(value) => {
              if (value !== null) {
                handleKindChange(value);
              }
            }}
            value={kind}
          >
            <SelectTrigger aria-label="Schedule kind">
              <SelectValue>{getScheduleKindLabel(kind)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SCHEDULE_KINDS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {kind === "hourly" ? (
            <div className="flex items-center gap-2.5">
              <span className="text-muted-foreground text-xs">Every</span>
              <Input
                className="w-16 text-center"
                max={24}
                min={1}
                onBlur={() => commit({})}
                onChange={(event) => setIntervalHours(event.target.value)}
                size="lf"
                type="number"
                value={intervalHours}
                variant="lf"
              />
              <span className="text-muted-foreground text-xs">hours</span>
            </div>
          ) : null}

          {kind === "weekly" ? (
            <Select
              onValueChange={(value) => {
                if (value !== null) {
                  handleDayChange(value);
                }
              }}
              value={String(dayOfWeek)}
            >
              <SelectTrigger aria-label="Day of week">
                <SelectValue>{getWeekdayLabel(dayOfWeek)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {WEEKDAY_OPTIONS.map((day) => (
                  <SelectItem key={day.value} value={String(day.value)}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          {kind === "daily" || kind === "weekdays" || kind === "weekly" ? (
            <Input
              className="w-full [&::-webkit-calendar-picker-indicator]:opacity-70 dark:[&::-webkit-calendar-picker-indicator]:invert"
              onChange={(event) => handleTimeChange(event.target.value)}
              size="lf"
              type="time"
              value={time}
              variant="lf"
            />
          ) : null}
        </PopoverContent>
      </Popover>
      {serverTimeBased ? (
        <RailRow label="Timezone">
          <span className="text-foreground text-sm">{automation.timezone}</span>
        </RailRow>
      ) : null}
    </>
  );
}
