import { z } from "zod";
import type { CloudRouterOutputs } from "@api/cloud";

// Use tRPC router output types
export type ApiKey = CloudRouterOutputs["apiKey"]["list"][number];
export type CreatedApiKey = CloudRouterOutputs["apiKey"]["create"];

// Filter and sort types
export type FilterStatus = "all" | "active" | "expired" | "revoked";
export type SortOption = "created" | "lastUsed" | "name";

// Creation form types
export const EXPIRATION_OPTIONS = [
  { value: "never", label: "Never" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "1y", label: "1 year" },
  { value: "custom", label: "Custom date" },
] as const;

export type ExpirationOption = (typeof EXPIRATION_OPTIONS)[number]["value"];

export const createApiKeySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less")
    .regex(
      /^[a-zA-Z0-9\s\-_\.]+$/,
      "Name can only contain letters, numbers, spaces, hyphens, underscores, and periods"
    )
    .transform((val) => val.trim()),
  
  expiration: z.enum(["never", "30d", "90d", "1y", "custom"]),
  
  customExpirationDate: z
    .string()
    .optional(),
}).superRefine((data, ctx) => {
  if (data.expiration === "custom") {
    if (!data.customExpirationDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Custom expiration date is required",
        path: ["customExpirationDate"],
      });
      return;
    }
    
    const selectedDate = new Date(data.customExpirationDate);
    const now = new Date();
    const maxDate = new Date();
    maxDate.setFullYear(now.getFullYear() + 5);
    
    if (isNaN(selectedDate.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid date format",
        path: ["customExpirationDate"],
      });
      return;
    }
    
    if (selectedDate <= now) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Expiration date must be in the future",
        path: ["customExpirationDate"],
      });
      return;
    }
    
    if (selectedDate > maxDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Expiration date cannot be more than 5 years in the future",
        path: ["customExpirationDate"],
      });
      return;
    }
  }
});

export type CreateApiKeyFormData = z.infer<typeof createApiKeySchema>;

// Security constraints
export const SECURITY_CONSTRAINTS = {
  MIN_NAME_LENGTH: 1,
  MAX_NAME_LENGTH: 100,
  MAX_EXPIRATION_YEARS: 5,
  ALLOWED_NAME_PATTERN: /^[a-zA-Z0-9\s\-_\.]+$/,
} as const;

// Component state types
export type DialogStep = "form" | "display";
export type CopyState = "idle" | "copying" | "copied" | "error";