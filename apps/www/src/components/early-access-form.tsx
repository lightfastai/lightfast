"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Badge } from "@repo/ui/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/ui/popover";
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
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import Link from "next/link";
import { cn } from "@repo/ui/lib/utils";
import { captureException } from "@sentry/nextjs";
import { ConfettiWrapper } from "./confetti-wrapper";
import {
  joinEarlyAccessAction
  
} from "./early-access-actions";
import type {EarlyAccessState} from "./early-access-actions";
import {
  earlyAccessFormSchema
  
} from "./early-access-form.schema";
import type {EarlyAccessFormValues} from "./early-access-form.schema";

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
  const [sourcesPopoverOpen, setSourcesPopoverOpen] = useState(false);

  // Subscribe to form values for validation using useWatch (React Compiler compatible)
  const email = useWatch({ control: form.control, name: "email" });
  const companySize = useWatch({ control: form.control, name: "companySize" });
  const sources = useWatch({ control: form.control, name: "sources" });

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
    if (!isValid) return;

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
        // Clear form on success
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
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-foreground">
                You're in!
              </h2>
              <p className="text-sm text-muted-foreground">{state.message}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">
                We'll send updates to{" "}
                <span className="font-medium text-foreground">{email}</span>
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
        <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email Field */}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-muted-foreground">
                Email address
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="email"
                  placeholder="name@company.com"
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
              <FormLabel className="text-xs font-medium text-muted-foreground">
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
                <FormLabel className="text-xs font-medium text-muted-foreground">
                  Tools your team uses
                </FormLabel>
                <Popover open={sourcesPopoverOpen} onOpenChange={setSourcesPopoverOpen}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={sourcesPopoverOpen}
                        aria-controls="sources-listbox"
                        className={cn(
                          "w-full justify-start font-normal px-2 min-h-8 h-auto py-1",
                          !field.value.length && "text-muted-foreground",
                        )}
                      >
                        <div className="flex items-center justify-between w-full gap-2">
                          <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                            {field.value.length > 0 ? (
                              field.value.map((value) => {
                                const source = DATA_SOURCES_MAP.get(value);
                                return (
                                  <Badge
                                    key={value}
                                    variant="secondary"
                                    className="gap-1 pr-1"
                                  >
                                    {source?.label}
                                    <span
                                      role="button"
                                      tabIndex={0}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        field.onChange(
                                          field.value.filter(
                                            (s) => s !== value,
                                          ),
                                        );
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          field.onChange(
                                            field.value.filter(
                                              (s) => s !== value,
                                            ),
                                          );
                                        }
                                      }}
                                      className="ml-1 rounded-sm opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
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
                  <PopoverContent className="w-full p-0" align="start">
                    <Command id="sources-listbox">
                      <CommandInput placeholder="Search tools..." />
                      <CommandList>
                        <CommandEmpty>No tools found.</CommandEmpty>
                        <CommandGroup>
                          {DATA_SOURCES.map((source) => {
                            const isSelected = field.value.includes(
                              source.value,
                            );
                            return (
                              <CommandItem
                                key={source.value}
                                value={source.value}
                                onSelect={() => {
                                  const newValue = isSelected
                                    ? field.value.filter(
                                        (s) => s !== source.value,
                                      )
                                    : [...field.value, source.value];
                                  field.onChange(newValue);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    isSelected ? "opacity-100" : "opacity-0",
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
            type="submit"
            className="w-full"
            disabled={!isFormValid || isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Submitting...
              </>
            ) : (
              "Get Early Access"
            )}
          </Button>

          {state.status === "validation_error" && state.fieldErrors.sources && (
            <p className="text-sm text-destructive">
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
                <p className="text-sm text-muted-foreground">
                  Please wait a moment before trying again.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Terms and Privacy */}
        <p className="text-xs text-muted-foreground">
          By continuing you acknowledge that you understand and agree to our{" "}
          <Link
            href="/legal/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground transition-colors"
          >
            Terms and Conditions
          </Link>{" "}
          and{" "}
          <Link
            href="/legal/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground transition-colors"
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
