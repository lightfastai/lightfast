"use client";

import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@repo/ui/components/ui/form";
import { teamFormSchema, type TeamFormValues } from "@repo/console-validation/forms";

/**
 * Team Form Provider
 * Manages form state with react-hook-form and Zod validation
 *
 * Features:
 * - Real-time validation with mode: "onChange"
 * - Form state shared across all child components
 * - Automatic validation on field changes
 */
export function TeamFormProvider({
  children,
  initialTeamName,
}: {
  children: ReactNode;
  initialTeamName?: string;
}) {
  // react-hook-form for validated fields
  const form = useForm<TeamFormValues>({
    resolver: zodResolver(teamFormSchema),
    defaultValues: {
      teamName: initialTeamName ?? "",
    },
    mode: "onChange", // Validate on change for real-time feedback
  });

  return <Form {...form}>{children}</Form>;
}
