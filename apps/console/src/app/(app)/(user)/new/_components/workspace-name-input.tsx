"use client";

import { useEffect, useRef } from "react";
import { useFormContext } from "@repo/ui/components/ui/form";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/ui/form";
import { Input } from "@repo/ui/components/ui/input";
import { useWorkspaceSearchParams } from "./use-workspace-search-params";
import type { WorkspaceFormValues } from "@repo/console-validation/forms";

/**
 * Workspace Name Input
 * Client island for workspace name input field with URL persistence and validation
 *
 * Features:
 * - Reads initial value from URL on mount
 * - Debounces URL updates (500ms) while typing
 * - Updates URL immediately on blur
 * - Persists across page refreshes
 * - Real-time validation with Zod schema
 * - Inline error messages
 */
export function WorkspaceNameInput() {
  const form = useFormContext<WorkspaceFormValues>();
  const { workspaceName: urlWorkspaceName, setWorkspaceName: setUrlWorkspaceName } = useWorkspaceSearchParams();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const workspaceName = form.watch("workspaceName");

  // Initialize from URL on mount
  useEffect(() => {
    if (urlWorkspaceName && !workspaceName) {
      form.setValue("workspaceName", urlWorkspaceName, { shouldValidate: true });
    }
  }, [urlWorkspaceName, workspaceName, form]);

  // Handle debounced URL update
  const syncToUrl = (value: string) => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce URL update (500ms)
    debounceTimerRef.current = setTimeout(() => {
      void setUrlWorkspaceName(value || null);
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
    void setUrlWorkspaceName(workspaceName || null);
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
      name="workspaceName"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Workspace name</FormLabel>
          <FormControl>
            <Input
              {...field}
              onChange={(e) => {
                field.onChange(e);
                syncToUrl(e.target.value);
              }}
              onBlur={() => {
                field.onBlur();
                handleBlur();
              }}
              placeholder="My-Awesome-Workspace"
            />
          </FormControl>
          <FormDescription>
            Use letters, numbers, and hyphens. No spaces or special characters.
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
