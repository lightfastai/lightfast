# Automations Visual-Language Seed + UI Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seed Lightfast's Linear-informed visual language as **opt-in variants** on the shared `packages/ui` primitives (zero change to existing screens), then rebuild the three automations surfaces — create form, list, detail editors — on that language with the expanded 5-kind schedule control.

**Architecture:** The language ships as additive cva/prop variants (`Input variant="lf"`, `Textarea variant="lf"`, `Tabs variant="underline"`, `Select variant="lf"`) whose `defaultVariants` keep every current call site byte-identical — so the look is scoped to whatever opts in (only automations). The 9px radius / 30px height / inset-hairline focus ring live **inside** the `lf` variant class strings, so no global token or `--radius` change is needed. Automations components then pass these variants and add mono labels / underline schedule tabs / native styled time input inline.

**Tech Stack:** React 19, Next.js 16, Tailwind CSS v4, class-variance-authority, Radix UI, react-hook-form (`useFormCompat`), tRPC.

**Depends on:** `2026-06-01-automations-schedule-model-backend.md` MUST be merged first — this plan's create form and schedule editor emit `manual`/`weekdays`/`weekly` schedules that the backend validation/calc only accept after that plan lands.

**Locked token reuse (no new globals):** existing dark tokens already match the mockup — `--card` `oklch(0.2435)` = mockup `surface-1`; `--background` `oklch(0.2178)` = mockup `background`; `--ring` `oklch(0.7058)` ≈ `0.72`; `--input` `oklch(0.3092)` ≈ hairline `0.305`. The `lf` variants therefore use `bg-card` (rest fill), `focus-visible:bg-background` (focus fill), `border-input` (hairline border), and `var(--ring)` (inset ring). The only literal values are `rounded-[9px]`, `h-[30px]`, `text-[12.5px]`, `text-[11px]` — all scoped to the variant.

**`lf` focus ring (uniform across all controls):** resting border unchanged; on focus the fill becomes `background` and a 1px ring is drawn *inside* the edge — `focus-visible:bg-background focus-visible:shadow-[inset_0_0_0_1px_var(--ring)]` with the outer halo ring suppressed. No layout shift; doubles as the `:focus-visible` keyboard outline.

---

## Phase A — Visual-language seed (`packages/ui`)

Each variant is additive. After each task, run `pnpm --filter @repo/ui typecheck` (if `@repo/ui` has no `typecheck` script, run `pnpm typecheck` from the repo root). There are no unit tests for these primitives; correctness is `defaultVariants` preserving the current output exactly + the new variant compiling.

### Task A1: Add the `lf` Input variant + size

**Files:**
- Modify: `packages/ui/src/components/ui/input.tsx:7-32`

- [ ] **Step 1: Add the variant and size**

Replace the `cva` call (lines 7-32) with:

```tsx
const inputVariants = cva(
  "file:text-foreground selection:bg-primary selection:text-primary-foreground flex w-full min-w-0 bg-transparent outline-none transition-[color,box-shadow] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: [
          "placeholder:text-muted-foreground dark:bg-background border-input rounded-md border text-sm shadow-xs",
          "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:ring-offset-0",
          "aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        ],
        underline: [
          "text-foreground placeholder:text-foreground/50 border-0 border-b border-foreground/20 px-0 rounded-none dark:bg-transparent",
          "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-foreground",
        ],
        lf: [
          "placeholder:text-muted-foreground bg-card border-input rounded-[9px] border text-[12.5px] shadow-none transition-[color,box-shadow,background-color]",
          "focus-visible:bg-background focus-visible:border-input focus-visible:shadow-[inset_0_0_0_1px_var(--ring)] focus-visible:ring-0",
          "aria-invalid:border-destructive aria-invalid:shadow-[inset_0_0_0_1px_var(--destructive)]",
        ],
      },
      size: {
        default: "h-8 px-3 py-1",
        lg: "h-10 px-4 py-2",
        lf: "h-[30px] px-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
```

No change to `InputProps` or the component body — `variant`/`size` are already threaded.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @repo/ui typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/ui/input.tsx
git commit -m "feat(ui): add lf Input variant and size (Lightfast language seed)"
```

### Task A2: Convert Textarea to cva with an `lf` variant

**Files:**
- Modify: `packages/ui/src/components/ui/textarea.tsx` (whole file)

- [ ] **Step 1: Rewrite the file**

Replace the entire contents of `packages/ui/src/components/ui/textarea.tsx` with:

```tsx
import * as React from "react"
import { cva } from "class-variance-authority"
import type { VariantProps } from "class-variance-authority"

import { cn } from "@repo/ui/lib/utils"

const textareaVariants = cva(
  "flex field-sizing-content w-full bg-transparent transition-[color,box-shadow] outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 min-h-16 rounded-md border px-3 py-2 text-base shadow-xs focus-visible:ring-[3px] md:text-sm",
        lf: "bg-card border-input min-h-[92px] rounded-[9px] border px-3 py-2 text-[12.5px] leading-relaxed shadow-none focus-visible:bg-background focus-visible:border-input focus-visible:shadow-[inset_0_0_0_1px_var(--ring)] aria-invalid:border-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface TextareaProps
  extends React.ComponentProps<"textarea">,
    VariantProps<typeof textareaVariants> {}

function Textarea({ className, variant, ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(textareaVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Textarea }
```

The `default` variant reproduces the original single class string exactly (verified token-for-token), so the four existing `<Textarea>` call sites render identically. `ref` continues to flow through `{...props}` (React 19 treats it as a regular prop).

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @repo/ui typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/ui/textarea.tsx
git commit -m "feat(ui): add lf Textarea variant (Lightfast language seed)"
```

### Task A3: Add the underline Tabs variant

**Files:**
- Modify: `packages/ui/src/components/ui/tabs.tsx` (whole file)

- [ ] **Step 1: Rewrite the file**

Replace the entire contents of `packages/ui/src/components/ui/tabs.tsx` with:

```tsx
"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@repo/ui/lib/utils"

type TabsVariant = "default" | "underline"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
    variant?: TabsVariant
  }
>(({ className, variant = "default", ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    data-variant={variant}
    className={cn(
      variant === "underline"
        ? "inline-flex items-center gap-5 border-b border-border text-muted-foreground"
        : "inline-flex items-center justify-center rounded-md bg-card/40 backdrop-blur-md border border-border/50 p-0.5 text-muted-foreground",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & {
    variant?: TabsVariant
  }
>(({ className, variant = "default", ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    data-variant={variant}
    className={cn(
      variant === "underline"
        ? "inline-flex items-center justify-center whitespace-nowrap -mb-px border-b-2 border-transparent px-0.5 py-[7px] text-[11.5px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground data-[state=active]:border-foreground"
        : "inline-flex items-center justify-center whitespace-nowrap rounded-md h-7 px-3 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
```

The `default` branch is the original class string verbatim, so existing pill-style tabs elsewhere are unchanged.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @repo/ui typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/ui/tabs.tsx
git commit -m "feat(ui): add underline Tabs variant (Lightfast language seed)"
```

### Task A4: Add the `lf` Select trigger variant

**Files:**
- Modify: `packages/ui/src/components/ui/select.tsx:27-51`

- [ ] **Step 1: Add the variant prop and class branch**

Replace the `SelectTrigger` function (lines 27-51) with:

```tsx
function SelectTrigger({
  className,
  size = "default",
  variant = "default",
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: "sm" | "default";
  variant?: "default" | "lf";
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      data-variant={variant}
      className={cn(
        "border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-transparent dark:hover:bg-input/50 flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-8 data-[size=sm]:h-7 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        variant === "lf" &&
          "bg-card dark:bg-card border-input rounded-[9px] text-[12.5px] shadow-none data-[size=default]:h-[30px] focus-visible:bg-background focus-visible:ring-0 focus-visible:border-input focus-visible:shadow-[inset_0_0_0_1px_var(--ring)]",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="size-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}
```

The `lf` classes come after the base string in `cn`, so `tailwind-merge` keeps them (height, radius, fill, inset focus all override the defaults). Omitting `variant` leaves every existing `SelectTrigger` untouched.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @repo/ui typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/ui/select.tsx
git commit -m "feat(ui): add lf SelectTrigger variant (Lightfast language seed)"
```

---

## Phase B — Shared schedule options + create form

### Task B1: Create the shared schedule-options module

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/_components/schedule-options.ts`

- [ ] **Step 1: Write the module**

```ts
export const SCHEDULE_KINDS = [
  { value: "manual", label: "Manual" },
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekly", label: "Weekly" },
] as const;

export type ScheduleKind = (typeof SCHEDULE_KINDS)[number]["value"];

export const TIME_BASED_KINDS: ScheduleKind[] = ["daily", "weekdays", "weekly"];

export function isTimeBasedKind(kind: ScheduleKind): boolean {
  return TIME_BASED_KINDS.includes(kind);
}

// dayOfWeek follows the JS Date.getDay() convention (0 = Sunday … 6 = Saturday).
export const WEEKDAY_OPTIONS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
] as const;

export const TIMEZONES = [
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
] as const;
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @lightfast/app typecheck`
Expected: PASS (module is unused so far — no errors).

- [ ] **Step 3: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/_components/schedule-options.ts"
git commit -m "feat(app): shared automation schedule options (kinds, weekdays, timezones)"
```

### Task B2: Rebuild the create form on the new language with 5 schedule kinds

**Files:**
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/new/_components/automation-create-form.tsx` (whole file)

- [ ] **Step 1: Replace the file**

Replace the entire contents with:

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AUTOMATION_NAME_MAX_LENGTH,
  AUTOMATION_PROMPT_MAX_LENGTH,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { toast } from "@repo/ui/components/ui/sonner";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/ui/tabs";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@vendor/clerk";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { z } from "zod";
import { useTRPC } from "~/trpc/react";
import { upsertInList } from "../../_components/automations-cache";
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

function buildSchedule(values: FormValues) {
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
        <Link
          className="-ml-0.5 mb-8 inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          href={listHref}
        >
          <ArrowLeft className="size-3.5" />
          automations
        </Link>

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
                  <FormLabel className="font-mono text-[11px] font-normal tracking-normal text-muted-foreground">
                    Name{" "}
                    <span className="text-muted-foreground">*</span>
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
                  <FormLabel className="font-mono text-[11px] font-normal tracking-normal text-muted-foreground">
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
              <FormLabel className="font-mono text-[11px] font-normal tracking-normal text-muted-foreground">
                Schedule
              </FormLabel>
              <Tabs
                onValueChange={(value) =>
                  form.setValue("scheduleKind", value as ScheduleKind, {
                    shouldValidate: true,
                  })
                }
                value={scheduleKind}
              >
                <TabsList variant="underline">
                  {SCHEDULE_KINDS.map((kind) => (
                    <TabsTrigger
                      key={kind.value}
                      value={kind.value}
                      variant="underline"
                    >
                      {kind.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              <div className="pt-3">
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
                          <Select
                            onValueChange={(value) =>
                              form.setValue("dayOfWeek", Number(value), {
                                shouldValidate: true,
                              })
                            }
                            value={String(dayOfWeek)}
                          >
                            <SelectTrigger className="w-36" variant="lf">
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
                <FormLabel className="font-mono text-[11px] font-normal tracking-normal text-muted-foreground">
                  Timezone
                </FormLabel>
                <Select
                  onValueChange={(value) =>
                    form.setValue("timezone", value, { shouldValidate: true })
                  }
                  value={timezone}
                >
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
```

Key points: `scheduleKind` and the day/timezone selects are driven via `form.watch`/`form.setValue` (not native inputs); `time` is reused across daily/weekdays/weekly; `buildSchedule` maps flat fields → the discriminated union; the timezone block only renders for time-based kinds; the native time input hides the webkit picker indicator and uses mono digits; Create is gated on `form.formState.isValid`.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @lightfast/app typecheck`
Expected: PASS — `buildSchedule`'s return type unifies to the `createAutomationSchema` input the mutation expects.

- [ ] **Step 3: Visual + behavior check in the running app**

With `pnpm dev` running, open `https://[<wt>.]lightfast.localhost/<slug>/automations/new`. Verify: underline tabs switch Manual/Hourly/Daily/Weekdays/Weekly; each sub-control renders (manual note, hourly number, daily/weekdays time, weekly day+time); timezone hides for Manual/Hourly; inputs show the 30px height, 9px radius, and inset-hairline focus ring; creating a Weekly automation succeeds and redirects to the list showing "Weekly on Monday at 9:00 AM".

- [ ] **Step 4: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/new/_components/automation-create-form.tsx"
git commit -m "feat(app): rebuild automation create form on the Lightfast language with 5 schedule kinds"
```

---

## Phase C — Detail editors

### Task C1: Extract a shared `RailSection` and reskin its label to mono

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/[automationId]/_components/rail-section.tsx`
- Modify: `automation-detail-client.tsx` (import + remove local copy), `automation-schedule-editor.tsx` (import + remove local copy)

`RailSection` is currently duplicated in four files (`automation-detail-client.tsx:96-110`, `automation-schedule-editor.tsx:60-75`, `automation-runs-list.tsx`, `automation-status-chip.tsx`). This task creates one shared component and switches the two files this plan already rebuilds; the runs-list and status-chip copies are switched in Task C4.

- [ ] **Step 1: Create the shared component**

```tsx
import type { ReactNode } from "react";

export function RailSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="border-border border-t pt-4">
      <p className="mb-2 font-mono text-[11px] font-normal text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}
```

(The label changes from `text-xs uppercase tracking-wide` to mono, no-caps, no-tracking — the locked label style.)

- [ ] **Step 2: Switch `automation-detail-client.tsx`**

In `automation-detail-client.tsx`: add the import near the other `./` imports (after line 15):

```tsx
import { RailSection } from "./rail-section";
```

Then delete the local `RailSection` definition (lines 96-111).

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @lightfast/app typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/[automationId]/_components/rail-section.tsx" "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/[automationId]/_components/automation-detail-client.tsx"
git commit -m "refactor(app): extract shared RailSection with mono label"
```

### Task C2: Rebuild the schedule editor for 5 kinds on the new language

**Files:**
- Modify: `automation-schedule-editor.tsx` (whole file)

- [ ] **Step 1: Replace the file**

Replace the entire contents of `automation-schedule-editor.tsx` with:

```tsx
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
}) {
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
```

Note: the previous `isUnchanged` save-gating is dropped in favor of `fieldValid` only — switching kinds is always a valid save. The mutation's optimistic-free `onSuccess` cache write is unchanged.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @lightfast/app typecheck`
Expected: PASS.

- [ ] **Step 3: Visual + behavior check**

In the running app, open an automation detail page, click the Schedule rail section, switch among all five kinds, change a weekly day + time, Save, and confirm the "Repeats" row re-renders (e.g. "Weekly on Wednesday at 8:15 AM"). Switch to Manual and Save → "Repeats" shows "Manual" and the "Next run" rail shows "—".

- [ ] **Step 4: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/[automationId]/_components/automation-schedule-editor.tsx"
git commit -m "feat(app): rebuild automation schedule editor for 5 kinds on the Lightfast language"
```

### Task C3: Reskin the name + prompt editors to the `lf` primitives

**Files:**
- Modify: `automation-name-editor.tsx:113-118`
- Modify: `automation-prompt-editor.tsx:97-108`

- [ ] **Step 1: Name editor input**

In `automation-name-editor.tsx`, replace the `<Input>` (lines 113-118) with:

```tsx
          <Input
            autoFocus
            maxLength={AUTOMATION_NAME_MAX_LENGTH + 1}
            onChange={(e) => setValue(e.target.value)}
            size="lf"
            value={value}
            variant="lf"
          />
```

- [ ] **Step 2: Prompt editor textarea + counter**

In `automation-prompt-editor.tsx`, replace the `<Textarea>` (lines 97-103) and the counter `<p>` (lines 104-108) with:

```tsx
      <Textarea
        onChange={(e) => setValue(e.target.value)}
        ref={textareaRef}
        rows={6}
        value={value}
        variant="lf"
      />
      <p
        className={`font-mono text-[9.5px] ${isTooLong ? "text-destructive" : "text-muted-foreground"}`}
      >
        {trimmed.length} / {AUTOMATION_PROMPT_MAX_LENGTH}
      </p>
```

(The `min-h-32` override is dropped — the `lf` Textarea variant already sets `min-h-[92px]`; `rows={6}` keeps it taller in edit mode.)

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @lightfast/app typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/[automationId]/_components/automation-name-editor.tsx" "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/[automationId]/_components/automation-prompt-editor.tsx"
git commit -m "feat(app): reskin automation name and prompt editors to the lf primitives"
```

### Task C4: Switch the remaining `RailSection` copies to the shared one

**Files:**
- Modify: `automation-runs-list.tsx`, `automation-status-chip.tsx`

- [ ] **Step 1: Switch runs-list**

In `automation-runs-list.tsx`: add `import { RailSection } from "./rail-section";` near the other `./` imports and delete its local `RailSection` definition (the `function RailSection(...)` block).

- [ ] **Step 2: Switch status-chip**

In `automation-status-chip.tsx`: add `import { RailSection } from "./rail-section";` near the other `./` imports and delete its local `RailSection` definition.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @lightfast/app typecheck`
Expected: PASS — no duplicate-identifier or unused warnings.

- [ ] **Step 4: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/[automationId]/_components/automation-runs-list.tsx" "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/[automationId]/_components/automation-status-chip.tsx"
git commit -m "refactor(app): use shared RailSection across automation detail rail"
```

---

## Phase D — List page + verification

### Task D1: Reskin the automations list to the new language

**Files:**
- Modify: `automations-client.tsx:42-155`

- [ ] **Step 1: Restyle section labels, rows, and empty state**

In `automations-client.tsx`, apply these className changes (text content and data flow unchanged — only styling):

Replace the header block (lines 43-60) heading + lede:

```tsx
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-semibold text-[20px] text-foreground tracking-[-0.02em]">
            Automations
          </h1>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Cloud schedules that record scaffold runs.
          </p>
        </div>
        {canManageAutomations && (
          <Button
            asChild
            className="h-[30px] rounded-[9px]"
            size="sm"
            variant="secondary"
          >
            <Link href={`/${workspaceSlug}/automations/new` as Route}>
              <Plus className="size-4" />
              New automation
            </Link>
          </Button>
        )}
      </div>
```

Replace the empty-state `<p>` labels (lines 64-69) to use mono:

```tsx
          <p className="font-mono text-[11px] text-foreground">
            No automations yet
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Create a cloud schedule to start recording scaffold runs.
          </p>
```

Replace the `AutomationSection` heading (line 106):

```tsx
      <h2 className="font-mono text-[11px] font-normal text-muted-foreground">{title}</h2>
```

Replace the `AutomationRow` `<Link>` className (line 132) and the name/schedule text sizes (lines 142-152):

```tsx
    <Link
      className="-mx-3 flex min-h-12 items-center justify-between gap-4 rounded-[9px] border-border border-b px-3 py-3 transition-colors hover:bg-muted/40"
      href={`/${workspaceSlug}/automations/${automation.publicId}` as Route}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Icon
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
          strokeWidth={2}
        />
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <p className="truncate font-medium text-[13px] text-foreground">
            {automation.name}
          </p>
          <p className="shrink-0 font-mono text-[10px] text-muted-foreground">
            {workspaceSlug}
          </p>
        </div>
      </div>
      <p className="shrink-0 font-mono text-[11px] text-muted-foreground">
        {formatAutomationSchedule(automation)}
      </p>
    </Link>
```

- [ ] **Step 2: Run the existing client test**

Run: `pnpm --filter @lightfast/app test automations-client`
Expected: PASS — the test asserts rendered names and `formatAutomationSchedule` labels, which are unchanged. If it queries by a class/role that changed, update the selector (not the assertion).

- [ ] **Step 3: Typecheck + visual check**

Run: `pnpm --filter @lightfast/app typecheck`
Expected: PASS. In the running app, confirm the list reads in the new language (mono section labels + schedule labels, soft hover).

- [ ] **Step 4: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/_components/automations-client.tsx"
git commit -m "feat(app): reskin automations list to the Lightfast language"
```

### Task D2: Full-surface verification

- [ ] **Step 1: Typecheck the whole affected graph**

Run: `pnpm --filter @repo/ui typecheck && pnpm --filter @lightfast/app typecheck`
Expected: PASS.

- [ ] **Step 2: Run the app test suite**

Run: `pnpm --filter @lightfast/app test`
Expected: PASS.

- [ ] **Step 3: Lint/format**

Run: `pnpm check`
Expected: PASS (or apply autofixes and re-run).

- [ ] **Step 4: End-to-end visual pass in the running app**

Walk all three surfaces with `pnpm dev` running (auth via the seeded `lightfast` org per the e2e testing memory): create form (all 5 kinds), list (current + paused), detail (name/prompt/schedule/status/runs). Confirm a consistent 30px height, 9px radius, mono no-caps labels, inset-hairline focus ring, and underline schedule tabs across every control, and that no OTHER app screen changed (open one non-automations form to confirm the shared primitives still render their defaults).

- [ ] **Step 5: No extra commit** — prior task commits cover the work. If `pnpm check` applied formatting, commit it:

```bash
git add -A
git commit -m "chore(app): formatting for automations language rework"
```

---

## Self-Review

**Spec coverage** (against `2026-06-01-automations-visual-language-design.md` §1 and §3):
- Visual seed — Input (A1), Textarea (A2), Tabs underline (A3), Select (A4); Label mono + Button height handled inline at usage (per the inline-classes preference); focus ring = inset hairline baked into every `lf`/`underline` variant. ✅
- Create form — full-page route kept, 5-kind underline tabs + per-kind sub-controls + timezone (time-based only) + mono counter + lf primitives → B2. ✅
- List — mono section labels, hairline dividers, soft hover, restyled empty state → D1. ✅
- Detail editors — schedule editor rebuilt for 5 kinds + underline tabs + timezone (C2); name/prompt reskinned (C3); `RailSection` deduped into one shared component with the mono-no-caps label (C1, C4). ✅
- Scoped, not global — every `packages/ui` change is an additive variant with `defaultVariants` preserving current output; the 9px radius / 30px height live inside the `lf` variants; no `--radius` or token edit → D2 step 4 verifies other screens are untouched. ✅

**Placeholder scan:** No TBD/TODO; every code step is complete. ✅

**Type consistency:** `ScheduleKind` is defined once in `schedule-options.ts` and imported by the create form (B2) and schedule editor (C2). `buildSchedule` exists in both forms with the same five-branch shape returning the `createAutomationSchema`/`updateAutomationSchema` union. The `lf` variant names (`variant="lf"`, `size="lf"`, `variant="underline"`) match exactly between the primitive definitions (Phase A) and every call site (Phases B–D). `dayOfWeek` uses 0–6 (JS `getDay`) consistently with the backend plan. ✅

**Cross-plan dependency:** B2 and C2 emit `manual`/`weekdays`/`weekly` — gated on the backend plan (`2026-06-01-automations-schedule-model-backend.md`) landing first, as stated in the header. ✅
