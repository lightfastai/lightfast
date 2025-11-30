"use client";

import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@repo/ui/components/ui/form";
import { earlyAccessFormSchema } from "./early-access-form.schema";
import type { EarlyAccessFormValues } from "./early-access-form.schema";

/**
 * Early Access Form Provider
 * Manages form state with react-hook-form and Zod validation
 *
 * Features:
 * - Real-time validation with mode: "onChange"
 * - Form state shared across all child components
 * - Automatic validation on field changes
 * - Initial values from URL parameters
 */
export function EarlyAccessFormProvider({
  children,
  initialEmail,
  initialCompanySize,
  initialSources,
}: {
  children: ReactNode;
  initialEmail?: string;
  initialCompanySize?: string;
  initialSources?: string[];
}) {
  // react-hook-form for validated fields
  const form = useForm<EarlyAccessFormValues>({
    resolver: zodResolver(earlyAccessFormSchema),
    defaultValues: {
      email: initialEmail ?? "",
      companySize: initialCompanySize ?? "",
      sources: initialSources ?? [],
    },
    mode: "onChange", // Validate on change for real-time feedback
  });

  return <Form {...form}>{children}</Form>;
}
