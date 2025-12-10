"use client";

import { useEffect, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@repo/ui/components/ui/radio-group";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/ui/form";
import { ArrowLeft, Loader2 } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { captureException } from "@sentry/nextjs";
import { useEarlyAccessParams } from "./use-early-access-params";
import { ConfettiWrapper } from "./confetti-wrapper";
import {
  joinEarlyAccessAction,
  type EarlyAccessState,
} from "./early-access-actions";
import type { EarlyAccessFormValues } from "./early-access-form.schema";

const COMPANY_SIZES = [
  { value: "1-10", label: "1-10 employees" },
  { value: "11-50", label: "11-50 employees" },
  { value: "51-200", label: "51-200 employees" },
  { value: "201-500", label: "201-500 employees" },
  { value: "501-1000", label: "501-1000 employees" },
  { value: "1001+", label: "1001+ employees" },
];

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

export function EarlyAccessForm() {
  const form = useFormContext<EarlyAccessFormValues>();
  const [urlParams, setUrlParams] = useEarlyAccessParams();
  const [state, setState] = useState<EarlyAccessState>({ status: "idle" });
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { step } = urlParams;
  const email = form.watch("email");
  const companySize = form.watch("companySize");
  const sources = form.watch("sources");

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

  // Initialize form from URL on mount
  useEffect(() => {
    if (urlParams.email && !email) {
      form.setValue("email", urlParams.email, { shouldValidate: true });
    }
    if (urlParams.companySize && !companySize) {
      form.setValue("companySize", urlParams.companySize, {
        shouldValidate: true,
      });
    }
    if (urlParams.sources.length > 0 && sources.length === 0) {
      form.setValue("sources", urlParams.sources, { shouldValidate: true });
    }
  }, [urlParams, email, companySize, sources, form]);

  // Debounced URL sync
  const syncToUrl = (updates: Partial<typeof urlParams>) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      void setUrlParams(updates);
    }, 500);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      void setUrlParams({ step: "company", email });
    }
  };

  const handleCompanySizeSubmit = () => {
    if (companySize) {
      void setUrlParams({ step: "sources", companySize });
    }
  };

  const handleFinalSubmit = async () => {
    if (sources.length === 0) return;

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

  const goBack = () => {
    if (step === "company") {
      void setUrlParams({ step: "email" });
    } else if (step === "sources") {
      void setUrlParams({ step: "company" });
    }
  };

  // Show success state if submission succeeded
  if (state.status === "success") {
    return (
      <>
        <ConfettiWrapper />
        <div className="w-full max-w-md">
          {/* Progress indicator */}
          <div className="mb-8 flex items-center gap-2">
            <div className="h-1 w-8 rounded-full bg-primary" />
            <div className="h-1 w-8 rounded-full bg-primary" />
            <div className="h-1 w-8 rounded-full bg-primary" />
          </div>

          <div className="flex flex-col h-[640px] justify-center space-y-4">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-foreground">
                You're in!
              </h1>
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

  return (
    <div className="w-full max-w-md">
      {/* Progress indicator */}
      <div className="mb-8 flex items-center gap-2">
        <div
          className={cn(
            "h-1 w-8 rounded-full transition-colors",
            step === "email" ? "bg-primary" : "bg-primary/20",
          )}
        />
        <div
          className={cn(
            "h-1 w-8 rounded-full transition-colors",
            step === "company" ? "bg-primary" : "bg-primary/20",
          )}
        />
        <div
          className={cn(
            "h-1 w-8 rounded-full transition-colors",
            step === "sources" ? "bg-primary" : "bg-primary/20",
          )}
        />
      </div>

      {/* Step 1: Email */}
      {step === "email" && (
        <form onSubmit={handleEmailSubmit} className="flex flex-col h-[640px]">
          {/* Header - fixed height */}
          <div className="flex-none">
            {/* Back button space - hidden but maintains layout */}
            <div className="h-[28px] mb-2" />

            {/* Title and description - consistent spacing */}
            <div className="space-y-2 mb-6">
              <h1 className="text-2xl font-semibold text-foreground">
                What's your email?
              </h1>
              <p className="text-sm text-muted-foreground">
                Create your account or sign in.
              </p>
            </div>
          </div>

          {/* Content - flexible with scroll */}
          <div className="flex-1 overflow-y-auto mb-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Work email</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="name@company.com"
                      className="h-12 rounded-xs"
                      autoFocus
                      onChange={(e) => {
                        field.onChange(e);
                        syncToUrl({ email: e.target.value });
                      }}
                      onBlur={() => {
                        field.onBlur();
                        if (debounceTimerRef.current) {
                          clearTimeout(debounceTimerRef.current);
                        }
                        void setUrlParams({ email: field.value });
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Footer - fixed height */}
          <div className="flex-none space-y-3">
            <Button
              type="submit"
              size="xl"
              className="w-full rounded-xs"
              disabled={!email || !!form.formState.errors.email}
            >
              Continue
            </Button>

            {/* Error space to match other steps */}
            <div className="min-h-[40px]" />
          </div>
        </form>
      )}

      {/* Step 2: Company Size */}
      {step === "company" && (
        <div className="flex flex-col h-[640px]">
          {/* Header - fixed height */}
          <div className="flex-none">
            {/* Back button - consistent height */}
            <div className="h-[28px] mb-2">
              <button
                onClick={goBack}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3 w-3" />
                Back
              </button>
            </div>

            {/* Title and description - consistent spacing */}
            <div className="space-y-2 mb-6">
              <h1 className="text-2xl font-semibold text-foreground">
                Company size
              </h1>
              <p className="text-sm text-muted-foreground">
                How many people work at your company?
              </p>
            </div>
          </div>

          {/* Content - flexible with scroll */}
          <div className="flex-1 overflow-y-auto mb-6">
            <FormField
              control={form.control}
              name="companySize"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        syncToUrl({ companySize: value });
                      }}
                      onBlur={() => {
                        field.onBlur();
                        if (debounceTimerRef.current) {
                          clearTimeout(debounceTimerRef.current);
                        }
                        void setUrlParams({ companySize: field.value });
                      }}
                    >
                      {COMPANY_SIZES.map((size) => (
                        <label
                          key={size.value}
                          htmlFor={size.value}
                          className="flex items-center space-x-3 rounded-xs border border-border p-3 hover:bg-accent transition-colors cursor-pointer"
                        >
                          <RadioGroupItem
                            value={size.value}
                            id={size.value}
                            className="text-primary"
                          />
                          <span className="flex-1 text-sm text-foreground">
                            {size.label}
                          </span>
                        </label>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Footer - fixed height */}
          <div className="flex-none space-y-3">
            <Button
              onClick={handleCompanySizeSubmit}
              size="xl"
              className="w-full rounded-xs"
              disabled={!companySize}
            >
              Continue
            </Button>

            {/* Error space to match other steps */}
            <div className="min-h-[40px]" />
          </div>
        </div>
      )}

      {/* Step 3: Data Sources */}
      {step === "sources" && (
        <div className="flex flex-col h-[640px]">
          {/* Header - fixed height */}
          <div className="flex-none">
            {/* Back button - consistent height */}
            <div className="h-[28px] mb-2">
              <button
                onClick={goBack}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3 w-3" />
                Back
              </button>
            </div>

            {/* Title and description - consistent spacing */}
            <div className="space-y-2 mb-6">
              <h1 className="text-2xl font-semibold text-foreground">
                Where does your software team work?
              </h1>
              <p className="text-sm text-muted-foreground">
                Select all the tools your software team uses (you can add more later).
              </p>
            </div>
          </div>

          {/* Content - flexible with scroll */}
          <div className="flex-1 overflow-y-auto mb-6">
            <FormField
              control={form.control}
              name="sources"
              render={({ field }) => (
                <FormItem>
                  <div className="grid grid-cols-2 gap-3">
                    {DATA_SOURCES.map((source) => {
                      const isChecked = field.value.includes(source.value);

                      return (
                        <label
                          key={source.value}
                          htmlFor={source.value}
                          className="flex items-center space-x-3 rounded-xs border border-border p-3 hover:bg-accent transition-colors cursor-pointer"
                        >
                          <Checkbox
                            id={source.value}
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              const newValue = checked
                                ? [...field.value, source.value]
                                : field.value.filter((s) => s !== source.value);
                              field.onChange(newValue);
                              syncToUrl({ sources: newValue });
                            }}
                            onBlur={() => {
                              field.onBlur();
                              if (debounceTimerRef.current) {
                                clearTimeout(debounceTimerRef.current);
                              }
                              void setUrlParams({ sources: field.value });
                            }}
                            className="text-primary"
                          />
                          <span className="flex-1 text-sm text-foreground">
                            {source.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Footer - fixed height */}
          <div className="flex-none space-y-3">
            <Button
              onClick={handleFinalSubmit}
              size="xl"
              className="w-full rounded-xs"
              disabled={sources.length === 0 || isPending}
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

            {/* Error messages - fixed height to prevent layout shift */}
            <div className="min-h-[40px]">
              {state.status === "validation_error" &&
                state.fieldErrors.sources && (
                  <p className="text-xs text-destructive">
                    {state.fieldErrors.sources[0]}
                  </p>
                )}
              {state.status === "error" && (
                <div className="space-y-1">
                  <p
                    className={`text-xs ${state.isRateLimit ? "text-yellow-600 dark:text-yellow-500" : "text-destructive"}`}
                  >
                    {state.error}
                  </p>
                  {state.isRateLimit && (
                    <p className="text-xs text-muted-foreground">
                      Please wait a moment before trying again.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
