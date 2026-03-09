"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/ui/components/ui/command";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/ui/form";
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
import { cn } from "@repo/ui/lib/utils";
import { captureException } from "@sentry/nextjs";
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { EarlyAccessState } from "../_actions/early-access";
import { joinEarlyAccessAction } from "../_actions/early-access";
import { ConfettiWrapper } from "./confetti-wrapper";
import type { EarlyAccessFormValues } from "./early-access-form.schema";
import { earlyAccessFormSchema } from "./early-access-form.schema";

const COMPANY_SIZES = [
  { value: "1-10", label: "1-10 employees" },
  { value: "11-50", label: "11-50 employees" },
  { value: "51-200", label: "51-200 employees" },
  { value: "201-500", label: "201-500 employees" },
  { value: "501-1000", label: "501-1000 employees" },
  { value: "1001+", label: "1001+ employees" },
];

const EMPTY_SOURCES: string[] = [];

const DATA_SOURCES = [
  { value: "github", label: "GitHub" },
  { value: "gitlab", label: "GitLab" },
  { value: "slack", label: "Slack" },
  { value: "notion", label: "Notion" },
  { value: "linear", label: "Linear" },
  { value: "jira", label: "Jira" },
  { value: "confluence", label: "Confluence" },
  { value: "google-drive", label: "Google Drive" },
  { value: "microsoft-teams", label: "Microsoft Teams" },
  { value: "discord", label: "Discord" },
];

const DATA_SOURCES_MAP = new Map(DATA_SOURCES.map((s) => [s.value, s]));

export function EarlyAccessForm({
  initialEmail = "",
  initialCompanySize = "",
  initialSources = EMPTY_SOURCES,
}: {
  initialEmail?: string;
  initialCompanySize?: string;
  initialSources?: string[];
}) {
  const form = useForm<EarlyAccessFormValues>({
    resolver: zodResolver(earlyAccessFormSchema),
    defaultValues: {
      email: initialEmail,
      companySize: initialCompanySize,
      sources: initialSources,
    },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const [state, setState] = useState<EarlyAccessState>({ status: "idle" });
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [sourcesPopoverOpen, setSourcesPopoverOpen] = useState(false);

  // Subscribe to form values for validation using useWatch (React Compiler compatible)
  const email = useWatch({ control: form.control, name: "email" });
  const companySize = useWatch({ control: form.control, name: "companySize" });
  const sources = useWatch({
    control: form.control,
    name: "sources",
    defaultValue: EMPTY_SOURCES,
  });

  // Track client-side errors
  useEffect(() => {
    if (state.status === "error") {
      // Report to Sentry when an error occurs on the client
      captureException(new Error(`Early access form error: ${state.error}`), {
        tags: {
          component: "early-access-form",
          error_type: state.isRateLimit ? "rate_limit" : "form_error",
        },
        extra: {
          errorMessage: state.error,
          isRateLimit: state.isRateLimit,
          timestamp: new Date().toISOString(),
        },
        level: state.isRateLimit ? "warning" : "error",
      });
    }
  }, [state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate entire form
    const isValid = await form.trigger();
    if (!isValid) {
      return;
    }

    setState({ status: "pending" });

    try {
      const values = form.getValues();
      const formData = new FormData();
      formData.append("email", values.email);
      formData.append("companySize", values.companySize);
      formData.append("sources", values.sources.join(","));

      const result = await joinEarlyAccessAction(null, formData);

      setState(result);

      if (result.status === "success") {
        // Capture email before reset so the success message can display it
        setSubmittedEmail(values.email);
        form.reset();
      }
    } catch (error) {
      console.error("Early access submission error:", error);
      captureException(error, {
        tags: {
          component: "early-access-form",
          error_type: "action_error",
        },
      });
      setState({
        status: "error",
        error: "An unexpected error occurred. Please try again.",
      });
    }
  };

  // Show success state if submission succeeded
  if (state.status === "success") {
    return (
      <>
        <ConfettiWrapper />
        <div className="w-full">
          <div className="fade-in slide-in-from-bottom-4 animate-in space-y-4 duration-300">
            <div className="space-y-2">
              <h2 className="font-semibold text-2xl text-foreground">
                You're in!
              </h2>
              <p className="text-muted-foreground text-sm">{state.message}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-muted-foreground text-sm">
                We'll send updates to{" "}
                <span className="font-medium text-foreground">
                  {submittedEmail}
                </span>
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  const isPending = state.status === "pending";
  const isFormValid = email && companySize && sources.length > 0;

  return (
    <Form {...form}>
      <div className="w-full">
        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* Email Field */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-medium text-muted-foreground text-xs">
                  Email address
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="name@company.com"
                    type="email"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Company Size Field */}
          <FormField
            control={form.control}
            name="companySize"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-medium text-muted-foreground text-xs">
                  Company size
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select company size" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {COMPANY_SIZES.map((size) => (
                      <SelectItem key={size.value} value={size.value}>
                        {size.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Data Sources Field */}
          <FormField
            control={form.control}
            name="sources"
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel className="font-medium text-muted-foreground text-xs">
                    Tools your team uses
                  </FormLabel>
                  <Popover
                    onOpenChange={setSourcesPopoverOpen}
                    open={sourcesPopoverOpen}
                  >
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          aria-controls="sources-listbox"
                          aria-expanded={sourcesPopoverOpen}
                          className={cn(
                            "h-auto min-h-8 w-full justify-start px-2 py-1 font-normal",
                            !field.value.length && "text-muted-foreground"
                          )}
                          role="combobox"
                          variant="outline"
                        >
                          <div className="flex w-full items-center justify-between gap-2">
                            <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                              {field.value.length > 0 ? (
                                field.value.map((value) => {
                                  const source = DATA_SOURCES_MAP.get(value);
                                  return (
                                    <Badge
                                      className="gap-1 pr-1"
                                      key={value}
                                      variant="secondary"
                                    >
                                      {source?.label}
                                      <span
                                        className="ml-1 cursor-pointer rounded-sm opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          field.onChange(
                                            field.value.filter(
                                              (s) => s !== value
                                            )
                                          );
                                        }}
                                        onKeyDown={(e) => {
                                          if (
                                            e.key === "Enter" ||
                                            e.key === " "
                                          ) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            field.onChange(
                                              field.value.filter(
                                                (s) => s !== value
                                              )
                                            );
                                          }
                                        }}
                                        role="button"
                                        tabIndex={0}
                                      >
                                        <X className="h-3 w-3" />
                                      </span>
                                    </Badge>
                                  );
                                })
                              ) : (
                                <span>Select tools</span>
                              )}
                            </div>
                            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                          </div>
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-full p-0">
                      <Command id="sources-listbox">
                        <CommandInput placeholder="Search tools..." />
                        <CommandList>
                          <CommandEmpty>No tools found.</CommandEmpty>
                          <CommandGroup>
                            {DATA_SOURCES.map((source) => {
                              const isSelected = field.value.includes(
                                source.value
                              );
                              return (
                                <CommandItem
                                  key={source.value}
                                  onSelect={() => {
                                    const newValue = isSelected
                                      ? field.value.filter(
                                          (s) => s !== source.value
                                        )
                                      : [...field.value, source.value];
                                    field.onChange(newValue);
                                  }}
                                  value={source.value}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      isSelected ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {source.label}
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          {/* Submit Button and Errors */}
          <div className="space-y-3">
            <Button
              className="w-full"
              disabled={!isFormValid || isPending}
              type="submit"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Get Early Access"
              )}
            </Button>

            {state.status === "validation_error" &&
              state.fieldErrors.sources && (
                <p className="text-destructive text-sm">
                  {state.fieldErrors.sources[0]}
                </p>
              )}
            {state.status === "error" && (
              <div className="space-y-1">
                <p
                  className={`text-sm ${state.isRateLimit ? "text-yellow-600 dark:text-yellow-500" : "text-destructive"}`}
                >
                  {state.error}
                </p>
                {state.isRateLimit && (
                  <p className="text-muted-foreground text-sm">
                    Please wait a moment before trying again.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Terms and Privacy */}
          <p className="text-muted-foreground text-xs">
            By continuing you acknowledge that you understand and agree to our{" "}
            <Link
              className="underline transition-colors hover:text-foreground"
              href="/legal/terms"
            >
              Terms and Conditions
            </Link>{" "}
            and{" "}
            <Link
              className="underline transition-colors hover:text-foreground"
              href="/legal/privacy"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </form>
      </div>
    </Form>
  );
}
