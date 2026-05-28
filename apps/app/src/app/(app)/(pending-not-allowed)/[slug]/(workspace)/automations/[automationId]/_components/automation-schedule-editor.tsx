"use client";

import type { AppRouterOutputs } from "@api/app";
import { formatAutomationSchedule } from "@repo/app-validation/schemas";
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
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/ui/components/ui/toggle-group";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@vendor/clerk";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useTRPC } from "~/trpc/react";
import { setOne, upsertInList } from "../../_components/automations-cache";

type Automation = AppRouterOutputs["org"]["workspace"]["automations"]["get"];

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Australia/Sydney",
];

function extractFormState(automation: Automation) {
  const kind = automation.scheduleKind as "hourly" | "daily";
  const config = automation.scheduleConfig as
    | { intervalHours: number }
    | { time: string };
  return {
    kind,
    intervalHours:
      "intervalHours" in config ? String(config.intervalHours) : "1",
    time: "time" in config ? config.time : "09:00",
  };
}

function RailSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border border-t pt-4">
      <p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {label}
      </p>
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-foreground text-sm">{value}</span>
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
  const [kind, setKind] = useState<"hourly" | "daily">(initial.kind);
  const [intervalHours, setIntervalHours] = useState(initial.intervalHours);
  const [time, setTime] = useState(initial.time);
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
      setTimezone(automation.timezone);
    }
  }

  const parsedHours = Number.parseInt(intervalHours, 10);
  const hoursValid =
    Number.isInteger(parsedHours) && parsedHours >= 1 && parsedHours <= 24;
  const timeValid = /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  const fieldValid = kind === "hourly" ? hoursValid : timeValid;

  const currentConfig = automation.scheduleConfig as
    | { intervalHours: number }
    | { time: string };
  const isUnchanged =
    kind === automation.scheduleKind &&
    timezone === automation.timezone &&
    (kind === "hourly"
      ? "intervalHours" in currentConfig &&
        parsedHours === currentConfig.intervalHours
      : "time" in currentConfig && time === currentConfig.time);

  const isSaveDisabled = update.isPending || isUnchanged || !fieldValid;

  function handleSave() {
    if (isSaveDisabled) {
      return;
    }
    const schedule =
      kind === "hourly"
        ? { kind: "hourly" as const, config: { intervalHours: parsedHours } }
        : { kind: "daily" as const, config: { time } };
    update.mutate({ id, schedule, timezone });
  }

  const display = (
    <div className="space-y-1">
      <DetailRow label="Repeats" value={formatAutomationSchedule(automation)} />
      <DetailRow label="Timezone" value={automation.timezone} />
    </div>
  );

  if (!canManage) {
    return <RailSection label="Details">{display}</RailSection>;
  }

  return (
    <RailSection label="Details">
      <Popover onOpenChange={handleOpenChange} open={open}>
        <PopoverTrigger asChild>
          <button
            className="-mx-1 w-full rounded px-1 text-left transition-colors hover:bg-accent/50"
            type="button"
          >
            {display}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 space-y-4 p-4">
          <div className="space-y-2">
            <p className="font-medium text-sm">Schedule</p>
            <ToggleGroup
              onValueChange={(v) => {
                if (v === "hourly" || v === "daily") {
                  setKind(v);
                }
              }}
              type="single"
              value={kind}
              variant="outline"
            >
              <ToggleGroupItem value="daily">Daily</ToggleGroupItem>
              <ToggleGroupItem value="hourly">Hourly</ToggleGroupItem>
            </ToggleGroup>

            {kind === "daily" ? (
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs">At (UTC)</p>
                <Input
                  className="w-36"
                  onChange={(e) => setTime(e.target.value)}
                  type="time"
                  value={time}
                />
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs">Every (hours)</p>
                <Input
                  className="w-24"
                  max={24}
                  min={1}
                  onChange={(e) => setIntervalHours(e.target.value)}
                  type="number"
                  value={intervalHours}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="font-medium text-sm">Timezone</p>
            <Select onValueChange={setTimezone} value={timezone}>
              <SelectTrigger className="w-full">
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
        </PopoverContent>
      </Popover>
    </RailSection>
  );
}
