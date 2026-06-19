import { listConnectors } from "@api/app/tanstack/connectors";
import { useAuth } from "@clerk/tanstack-react-start";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ChevronLeftIcon as ChevronLeft,
  Loading03Icon as Loader2,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { connectableConnectorProviderSchema } from "@lightfast/connector-core";
import {
  AUTOMATION_NAME_MAX_LENGTH,
  AUTOMATION_PROMPT_MAX_LENGTH,
  type AutomationScheduleInput,
} from "@repo/app-validation/schemas";
import { Badge } from "@repo/ui/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui-v2/components/ui/select";
import { SidebarTrigger } from "@repo/ui-v2/components/ui/sidebar";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { z } from "zod";
import { connectorQueryKeys } from "~/connectors/connectors-cache";
import { automationCreateMutationOptions } from "./automations-queries";
import {
  isTimeBasedKind,
  SCHEDULE_KINDS,
  type ScheduleKind,
  TIMEZONES,
  WEEKDAY_OPTIONS,
} from "./schedule-options";

const formSchema = z.object({
  connectorProvider: connectableConnectorProviderSchema.nullable(),
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

const NO_CONNECTOR_VALUE = "__none__";

function buildSchedule(values: FormValues): AutomationScheduleInput {
  switch (values.scheduleKind) {
    case "manual":
      return { kind: "manual", config: {} };
    case "hourly":
      return {
        kind: "hourly",
        config: { intervalHours: values.intervalHours },
      };
    case "daily":
      return { kind: "daily", config: { time: values.time } };
    case "weekdays":
      return { kind: "weekdays", config: { time: values.time } };
    case "weekly":
      return {
        kind: "weekly",
        config: { dayOfWeek: values.dayOfWeek, time: values.time },
      };
    default:
      return { kind: "manual", config: {} };
  }
}

export function AutomationCreateForm({ slug }: { slug: string }) {
  const navigate = useNavigate();
  const { has, isLoaded } = useAuth();
  const canManageAutomations = isLoaded && !!has?.({ role: "org:admin" });
  const queryClient = useQueryClient();
  const { data: connectors = [] } = useQuery({
    enabled: typeof window !== "undefined",
    queryFn: () => listConnectors(),
    queryKey: connectorQueryKeys.list(),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (isLoaded && !canManageAutomations) {
      void navigate({
        params: { slug },
        replace: true,
        to: "/$slug/automations",
      });
    }
  }, [canManageAutomations, isLoaded, navigate, slug]);

  const form = useFormCompat<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      connectorProvider: null,
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
  const connectorProvider = form.watch("connectorProvider");
  const dayOfWeek = form.watch("dayOfWeek");
  const timezone = form.watch("timezone");
  const promptValue = form.watch("prompt");

  const enabledConnectorOptions = useMemo(
    () =>
      connectors
        .filter((connector) => connector.availableForAutomations)
        .map((connector) => ({
          label: connector.displayName,
          value: connector.provider,
        })),
    [connectors]
  );
  const connectorOptions = useMemo(
    () => [
      { label: "No connector", value: NO_CONNECTOR_VALUE },
      ...enabledConnectorOptions,
    ],
    [enabledConnectorOptions]
  );

  useEffect(() => {
    if (
      connectorProvider &&
      !enabledConnectorOptions.some(
        (option) => option.value === connectorProvider
      )
    ) {
      form.setValue("connectorProvider", null, { shouldValidate: true });
    }
  }, [connectorProvider, enabledConnectorOptions, form]);

  const createMutation = useMutation(
    automationCreateMutationOptions({
      onSuccess: (automation) => {
        toast.success("Automation created", {
          description: `"${automation.name}" is now scheduled.`,
        });
        void navigate({ params: { slug }, to: "/$slug/automations" });
      },
      queryClient,
    })
  );

  const onSubmit = (values: FormValues) => {
    createMutation.mutate({
      connectorProvider: values.connectorProvider ?? null,
      name: values.name,
      prompt: values.prompt,
      schedule: buildSchedule(values),
      timezone: values.timezone,
    });
  };

  if (!(isLoaded && canManageAutomations)) {
    return null;
  }

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="mx-auto w-full max-w-xl px-6 py-12">
        <div className="mb-6 flex items-center gap-2">
          <SidebarTrigger className="size-6 rounded-lg border border-border/70 bg-muted/30 p-0 text-muted-foreground hover:bg-muted/60 hover:text-foreground md:hidden" />
          <Button
            asChild
            className="-ml-1 h-6 gap-1 rounded-lg px-2 font-normal text-muted-foreground text-sm hover:bg-muted/60 hover:text-foreground"
            size="sm"
            variant="ghost"
          >
            <Link params={{ slug }} preload="intent" to="/$slug/automations">
              <HugeiconsIcon className="size-3" icon={ChevronLeft} />
              Automations
            </Link>
          </Button>
        </div>
        <h1 className="font-semibold text-2xl tracking-[-0.02em]">
          New automation
        </h1>
        <p className="mt-1 mb-8 text-muted-foreground text-sm">
          A cloud schedule that runs your agent and records each run.
        </p>

        <Form {...form}>
          <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="gap-2">
                  <FormLabel className="font-normal text-muted-foreground text-sm">
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
                  <FormLabel className="font-normal text-muted-foreground text-sm">
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
                      <span className="pointer-events-none absolute right-2.5 bottom-2 text-muted-foreground text-xs">
                        {promptValue.length}/{AUTOMATION_PROMPT_MAX_LENGTH}
                      </span>
                    </div>
                  </FormControl>
                  <p className="text-muted-foreground text-xs">
                    Markdown supported.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel className="font-normal text-muted-foreground text-sm">
                Schedule
              </FormLabel>
              <div className="flex flex-wrap items-center gap-2.5">
                <Select
                  onValueChange={(value) => {
                    if (value !== null) {
                      form.setValue("scheduleKind", value as ScheduleKind, {
                        shouldValidate: true,
                      });
                    }
                  }}
                  value={scheduleKind}
                >
                  <SelectTrigger aria-label="Schedule">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCHEDULE_KINDS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {scheduleKind === "manual" ? (
                  <p className="text-muted-foreground text-xs">
                    Runs only when triggered - no automatic schedule.
                  </p>
                ) : null}

                {scheduleKind === "hourly" ? (
                  <FormField
                    control={form.control}
                    name="intervalHours"
                    render={({ field }) => (
                      <FormItem className="gap-0">
                        <div className="flex items-center gap-2.5">
                          <span className="text-muted-foreground text-xs">
                            Every
                          </span>
                          <Input
                            className="w-14 text-center"
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
                          <span className="text-muted-foreground text-xs">
                            hours
                          </span>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}

                {scheduleKind === "daily" || scheduleKind === "weekdays" ? (
                  <FormField
                    control={form.control}
                    name="time"
                    render={({ field }) => (
                      <FormItem className="gap-0">
                        <div className="flex items-center gap-2.5">
                          <span className="text-muted-foreground text-xs">
                            At
                          </span>
                          <Input
                            {...field}
                            className="w-[7rem] [&::-webkit-calendar-picker-indicator]:hidden"
                            size="lf"
                            type="time"
                            variant="lf"
                          />
                          {scheduleKind === "weekdays" ? (
                            <Badge
                              className="text-muted-foreground"
                              variant="outline"
                            >
                              Mon-Fri
                            </Badge>
                          ) : null}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}

                {scheduleKind === "weekly" ? (
                  <FormField
                    control={form.control}
                    name="time"
                    render={({ field }) => (
                      <FormItem className="gap-0">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="text-muted-foreground text-xs">
                            On
                          </span>
                          <Select
                            onValueChange={(value) => {
                              if (value !== null) {
                                form.setValue("dayOfWeek", Number(value), {
                                  shouldValidate: true,
                                });
                              }
                            }}
                            value={String(dayOfWeek)}
                          >
                            <SelectTrigger aria-label="Day of week">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {WEEKDAY_OPTIONS.map((day) => (
                                <SelectItem
                                  key={day.value}
                                  value={String(day.value)}
                                >
                                  {day.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-muted-foreground text-xs">
                            at
                          </span>
                          <Input
                            {...field}
                            className="w-[7rem] [&::-webkit-calendar-picker-indicator]:hidden"
                            size="lf"
                            type="time"
                            variant="lf"
                          />
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}
              </div>
            </div>

            {isTimeBasedKind(scheduleKind) ? (
              <div className="space-y-2">
                <FormLabel className="font-normal text-muted-foreground text-sm">
                  Timezone
                </FormLabel>
                <Select
                  onValueChange={(value) => {
                    if (value !== null) {
                      form.setValue("timezone", value, {
                        shouldValidate: true,
                      });
                    }
                  }}
                  value={timezone}
                >
                  <SelectTrigger aria-label="Timezone">
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
            ) : null}

            <div className="space-y-2">
              <FormLabel className="font-normal text-muted-foreground text-sm">
                Connector
              </FormLabel>
              <Select
                onValueChange={(value) => {
                  if (value !== null) {
                    const nextProvider =
                      value === NO_CONNECTOR_VALUE
                        ? null
                        : connectableConnectorProviderSchema.parse(value);
                    form.setValue("connectorProvider", nextProvider, {
                      shouldValidate: true,
                    });
                  }
                }}
                value={connectorProvider ?? NO_CONNECTOR_VALUE}
              >
                <SelectTrigger aria-label="Connector">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {connectorOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-end gap-2.5 border-border border-t pt-5">
              <Button asChild size="lf" type="button" variant="ghost">
                <Link params={{ slug }} to="/$slug/automations">
                  Cancel
                </Link>
              </Button>
              <Button
                disabled={createMutation.isPending || !form.formState.isValid}
                size="lf"
                type="submit"
              >
                {createMutation.isPending ? (
                  <>
                    <HugeiconsIcon
                      className="size-3.5 animate-spin"
                      icon={Loader2}
                    />
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
