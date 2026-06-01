"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AUTOMATION_NAME_MAX_LENGTH,
  AUTOMATION_PROMPT_MAX_LENGTH,
  type AutomationScheduleInput,
} from "@repo/app-validation/schemas";
import { Button } from "@repo/ui/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormCompat,
} from "@repo/ui/components/ui/form";
import { Input } from "@repo/ui/components/ui/input";
import { toast } from "@repo/ui/components/ui/sonner";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@vendor/clerk";
import { Loader2 } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { z } from "zod";
import { useTRPC } from "~/trpc/react";
import { upsertInList } from "../../_components/automations-cache";
import { LfSelect } from "../../_components/lf-select";
import {
  isTimeBasedKind,
  SCHEDULE_KINDS,
  type ScheduleKind,
  TIMEZONES,
  WEEKDAY_OPTIONS,
} from "../../_components/schedule-options";

const formSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(AUTOMATION_NAME_MAX_LENGTH),
  prompt: z
    .string()
    .trim()
    .min(1, "Instructions are required")
    .max(AUTOMATION_PROMPT_MAX_LENGTH),
  scheduleKind: z.enum(["manual", "hourly", "daily", "weekdays", "weekly"]),
  intervalHours: z.number().int().min(1).max(24),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm"),
  dayOfWeek: z.number().int().min(0).max(6),
  timezone: z.string().min(1),
});

type FormValues = z.infer<typeof formSchema>;

function buildSchedule(values: FormValues): AutomationScheduleInput {
  switch (values.scheduleKind) {
    case "manual":
      return { kind: "manual" as const, config: {} };
    case "hourly":
      return {
        kind: "hourly" as const,
        config: { intervalHours: values.intervalHours },
      };
    case "daily":
      return { kind: "daily" as const, config: { time: values.time } };
    case "weekdays":
      return { kind: "weekdays" as const, config: { time: values.time } };
    case "weekly":
      return {
        kind: "weekly" as const,
        config: { dayOfWeek: values.dayOfWeek, time: values.time },
      };
    default:
      return { kind: "manual" as const, config: {} };
  }
}

export function AutomationCreateForm({ slug }: { slug: string }) {
  const router = useRouter();
  const { has, isLoaded } = useAuth();
  const canManageAutomations = isLoaded && !!has?.({ role: "org:admin" });
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const listHref = `/${slug}/automations` as Route;

  useEffect(() => {
    if (isLoaded && !canManageAutomations) {
      router.replace(listHref);
    }
  }, [canManageAutomations, isLoaded, listHref, router]);

  const form = useFormCompat<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      prompt: "",
      scheduleKind: "daily",
      intervalHours: 1,
      time: "09:00",
      dayOfWeek: 1,
      timezone: "UTC",
    },
    mode: "onChange",
  });

  const scheduleKind = form.watch("scheduleKind") as ScheduleKind;
  const dayOfWeek = form.watch("dayOfWeek");
  const timezone = form.watch("timezone");
  const promptValue = form.watch("prompt");

  const createMutation = useMutation(
    trpc.org.workspace.automations.create.mutationOptions({
      meta: { errorTitle: "Failed to create automation" },
      onSuccess: (automation) => {
        upsertInList(queryClient, trpc, automation.publicId, () => automation);
        queryClient.setQueryData(
          trpc.org.workspace.automations.get.queryOptions({
            id: automation.publicId,
          }).queryKey,
          automation
        );
        toast.success("Automation created", {
          description: `"${automation.name}" is now scheduled.`,
        });
        router.push(listHref);
      },
    })
  );

  const onSubmit = (values: FormValues) => {
    createMutation.mutate({
      name: values.name,
      prompt: values.prompt,
      schedule: buildSchedule(values),
      timezone: values.timezone,
    });
  };

  const isSubmitting = createMutation.isPending;

  if (!(isLoaded && canManageAutomations)) {
    return null;
  }

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="mx-auto w-full max-w-xl px-6 py-12">
        <h1 className="font-semibold text-[20px] tracking-[-0.02em]">
          New automation
        </h1>
        <p className="mt-1 mb-8 text-[12px] text-muted-foreground">
          A cloud schedule that runs your agent and records each run.
        </p>

        <Form {...form}>
          <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="gap-2">
                  <FormLabel className="font-mono font-normal text-[11px] text-muted-foreground tracking-normal">
                    Name <span className="text-muted-foreground">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      autoFocus
                      placeholder="Daily code review"
                      size="lf"
                      variant="lf"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="prompt"
              render={({ field }) => (
                <FormItem className="gap-2">
                  <FormLabel className="font-mono font-normal text-[11px] text-muted-foreground tracking-normal">
                    Instructions{" "}
                    <span className="text-muted-foreground">*</span>
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Textarea
                        {...field}
                        maxLength={AUTOMATION_PROMPT_MAX_LENGTH}
                        placeholder="Describe what the agent should do in each run."
                        variant="lf"
                      />
                      <span className="pointer-events-none absolute right-2.5 bottom-2 font-mono text-[9.5px] text-muted-foreground">
                        {promptValue.length}/{AUTOMATION_PROMPT_MAX_LENGTH}
                      </span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel className="font-mono font-normal text-[11px] text-muted-foreground tracking-normal">
                Schedule
              </FormLabel>
              <div className="flex flex-wrap items-center gap-2.5">
                <LfSelect
                  className="w-36"
                  onValueChange={(value) =>
                    form.setValue("scheduleKind", value as ScheduleKind, {
                      shouldValidate: true,
                    })
                  }
                  options={SCHEDULE_KINDS}
                  value={scheduleKind}
                />
                {scheduleKind === "manual" && (
                  <p className="font-mono text-[10.5px] text-muted-foreground">
                    Runs only when triggered — no automatic schedule.
                  </p>
                )}

                {scheduleKind === "hourly" && (
                  <FormField
                    control={form.control}
                    name="intervalHours"
                    render={({ field }) => (
                      <FormItem className="gap-0">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-[10.5px] text-muted-foreground">
                            Every
                          </span>
                          <Input
                            className="w-14 text-center font-mono"
                            max={24}
                            min={1}
                            name={field.name}
                            onBlur={field.onBlur}
                            onChange={(event) =>
                              field.onChange(
                                Number.parseInt(event.target.value, 10) || 1
                              )
                            }
                            ref={field.ref}
                            size="lf"
                            type="number"
                            value={field.value}
                            variant="lf"
                          />
                          <span className="font-mono text-[10.5px] text-muted-foreground">
                            hours
                          </span>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {(scheduleKind === "daily" || scheduleKind === "weekdays") && (
                  <FormField
                    control={form.control}
                    name="time"
                    render={({ field }) => (
                      <FormItem className="gap-0">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-[10.5px] text-muted-foreground">
                            At
                          </span>
                          <Input
                            {...field}
                            className="w-[7rem] font-mono [&::-webkit-calendar-picker-indicator]:hidden"
                            size="lf"
                            type="time"
                            variant="lf"
                          />
                          {scheduleKind === "weekdays" && (
                            <span className="rounded-md border border-border px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                              Mon–Fri
                            </span>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {scheduleKind === "weekly" && (
                  <FormField
                    control={form.control}
                    name="time"
                    render={({ field }) => (
                      <FormItem className="gap-0">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-mono text-[10.5px] text-muted-foreground">
                            On
                          </span>
                          <LfSelect
                            className="w-36"
                            onValueChange={(value) =>
                              form.setValue("dayOfWeek", Number(value), {
                                shouldValidate: true,
                              })
                            }
                            options={WEEKDAY_OPTIONS.map((day) => ({
                              label: day.label,
                              value: String(day.value),
                            }))}
                            value={String(dayOfWeek)}
                          />
                          <span className="font-mono text-[10.5px] text-muted-foreground">
                            at
                          </span>
                          <Input
                            {...field}
                            className="w-[7rem] font-mono [&::-webkit-calendar-picker-indicator]:hidden"
                            size="lf"
                            type="time"
                            variant="lf"
                          />
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </div>

            {isTimeBasedKind(scheduleKind) && (
              <div className="space-y-2">
                <FormLabel className="font-mono font-normal text-[11px] text-muted-foreground tracking-normal">
                  Timezone
                </FormLabel>
                <LfSelect
                  className="w-full"
                  onValueChange={(value) =>
                    form.setValue("timezone", value, { shouldValidate: true })
                  }
                  options={TIMEZONES.map((tz) => ({ label: tz, value: tz }))}
                  value={timezone}
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 border-border border-t pt-5">
              <Button
                asChild
                className="h-[30px] rounded-[9px]"
                type="button"
                variant="ghost"
              >
                <Link href={listHref}>Cancel</Link>
              </Button>
              <Button
                className="h-[30px] rounded-[9px]"
                disabled={isSubmitting || !form.formState.isValid}
                type="submit"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Creating
                  </>
                ) : (
                  "Create"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
