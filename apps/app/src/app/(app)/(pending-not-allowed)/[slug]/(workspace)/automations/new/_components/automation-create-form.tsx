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
import { toast } from "@repo/ui/components/ui/sonner";
import { Textarea } from "@repo/ui/components/ui/textarea";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/ui/components/ui/toggle-group";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@vendor/clerk";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { z } from "zod";
import { upsertInList } from "../../_components/automations-cache";
import { useTRPC } from "~/trpc/react";

const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(AUTOMATION_NAME_MAX_LENGTH),
  prompt: z
    .string()
    .trim()
    .min(1, "Instructions are required")
    .max(AUTOMATION_PROMPT_MAX_LENGTH),
  scheduleKind: z.enum(["hourly", "daily"]),
  intervalHours: z.number().int().min(1).max(24),
  dailyTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm"),
});

type FormValues = z.infer<typeof formSchema>;

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
      dailyTime: "09:00",
    },
    mode: "onChange",
  });

  const scheduleKind = form.watch("scheduleKind");

  const createMutation = useMutation(
    trpc.org.workspace.automations.create.mutationOptions({
      meta: { errorTitle: "Failed to create automation" },
      onSuccess: (automation) => {
        upsertInList(queryClient, trpc, automation.publicId, () => automation);
        queryClient.setQueryData(
          trpc.org.workspace.automations.get.queryOptions({ id: automation.publicId }).queryKey,
          automation,
        );
        toast.success("Automation created", {
          description: `"${automation.name}" is now scheduled.`,
        });
        router.push(listHref);
      },
    })
  );

  const onSubmit = (values: FormValues) => {
    const schedule =
      values.scheduleKind === "hourly"
        ? {
            kind: "hourly" as const,
            config: { intervalHours: values.intervalHours },
          }
        : {
            kind: "daily" as const,
            config: { time: values.dailyTime },
          };
    createMutation.mutate({
      name: values.name,
      prompt: values.prompt,
      schedule,
      timezone: "UTC",
    });
  };

  const isSubmitting = createMutation.isPending;

  if (!isLoaded || !canManageAutomations) {
    return null;
  }

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        <Button asChild className="mb-8 -ml-2" size="sm" variant="ghost">
          <Link href={listHref}>
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </Button>

        <Form {...form}>
          <form
            className="space-y-8"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Name <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      autoFocus
                      placeholder="e.g., Daily code review"
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
                <FormItem>
                  <FormLabel>Instructions</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      className="min-h-48"
                      placeholder="Describe what Claude should do in each session"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <FormField
                control={form.control}
                name="scheduleKind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Schedule</FormLabel>
                    <FormControl>
                      <ToggleGroup
                        onValueChange={(value) => {
                          if (value === "hourly" || value === "daily") {
                            field.onChange(value);
                          }
                        }}
                        type="single"
                        value={field.value}
                        variant="outline"
                      >
                        <ToggleGroupItem value="daily">Daily</ToggleGroupItem>
                        <ToggleGroupItem value="hourly">Hourly</ToggleGroupItem>
                      </ToggleGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {scheduleKind === "daily" ? (
                <FormField
                  control={form.control}
                  name="dailyTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>At (UTC)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="w-40"
                          type="time"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={form.control}
                  name="intervalHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Every (hours)</FormLabel>
                      <FormControl>
                        <Input
                          className="w-40"
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
                          type="number"
                          value={field.value}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button asChild type="button" variant="ghost">
                <Link href={listHref}>Cancel</Link>
              </Button>
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
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
