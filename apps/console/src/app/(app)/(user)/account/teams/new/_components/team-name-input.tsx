"use client";

import { useEffect, useRef } from "react";
import { useFormContext } from "react-hook-form";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/ui/form";
import { Input } from "@repo/ui/components/ui/input";
import { useTeamSearchParams } from "./use-team-search-params";
import type { TeamFormValues } from "@repo/console-validation/forms";

/**
 * Team Name Input
 * Client island for team name input field with URL persistence and validation
 *
 * Features:
 * - Reads initial value from URL on mount
 * - Debounces URL updates (500ms) while typing
 * - Updates URL immediately on blur
 * - Persists across page refreshes
 * - Real-time validation with Zod schema
 * - Auto-normalization (lowercase, alphanumeric + hyphens)
 * - Inline error messages
 */
export function TeamNameInput() {
  const form = useFormContext<TeamFormValues>();
  const { teamName: urlTeamName, setTeamName: setUrlTeamName } = useTeamSearchParams();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const teamName = form.watch("teamName");

  // Initialize from URL on mount
  useEffect(() => {
    if (urlTeamName && !teamName) {
      form.setValue("teamName", urlTeamName, { shouldValidate: true });
    }
  }, [urlTeamName, teamName, form]);

  // Handle debounced URL update
  const syncToUrl = (value: string) => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce URL update (500ms)
    debounceTimerRef.current = setTimeout(() => {
      void setUrlTeamName(value || null);
    }, 500);
  };

  // Handle blur - update URL immediately
  const handleBlur = () => {
    // Clear any pending debounced update
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // Update URL immediately
    void setUrlTeamName(teamName || null);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <FormField
      control={form.control}
      name="teamName"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Your Team Name</FormLabel>
          <FormControl>
            <Input
              {...field}
              onChange={(e) => {
                // Normalize slug: lowercase, alphanumeric + hyphens only
                const normalized = e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9-]/g, "")
                  .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens

                field.onChange(normalized);
                syncToUrl(normalized);
              }}
              onBlur={() => {
                field.onBlur();
                handleBlur();
              }}
              placeholder="acme-inc"
              className="h-12 text-base font-mono"
              autoFocus
            />
          </FormControl>
          <FormDescription>
            Great team names are short and memorable
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
