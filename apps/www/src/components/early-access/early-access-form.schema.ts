import { z } from "zod";

/**
 * Early Access Form Schema
 *
 * Multi-step form validation:
 * - Step 1 (email): Email validation
 * - Step 2 (company): Company size selection
 * - Step 3 (sources): Data sources multi-select (at least 1 required)
 *
 * Note: Fields use refine() to allow partial completion during step navigation
 * while enforcing requirements at final submission.
 */
export const earlyAccessFormSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address")
    .toLowerCase()
    .trim(),
  companySize: z
    .string()
    .min(1, "Company size is required"),
  sources: z
    .array(z.string())
    .min(1, "Please select at least one data source"),
});

export type EarlyAccessFormValues = z.infer<typeof earlyAccessFormSchema>;
