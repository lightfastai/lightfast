import { z } from "zod";

// Expiration options for the dropdown
export const EXPIRATION_OPTIONS = [
  { value: "never", label: "Never" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "1y", label: "1 year" },
  { value: "custom", label: "Custom date" },
] as const;

export type ExpirationOption = (typeof EXPIRATION_OPTIONS)[number]["value"];

// API Key creation form schema
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
  // Only validate custom date if expiration is "custom"
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
    maxDate.setFullYear(now.getFullYear() + 5); // Max 5 years from now
    
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

// Helper function to calculate expiration date from option
export function calculateExpirationDate(
  option: ExpirationOption,
  customDate?: string
): Date | null {
  const now = new Date();
  
  switch (option) {
    case "never":
      return null;
    case "30d":
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    case "90d":
      return new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    case "1y":
      return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    case "custom":
      return customDate ? new Date(customDate) : null;
    default:
      return null;
  }
}

// Helper function to format expiration date for display
export function formatExpirationDate(date: Date | null): string {
  if (!date) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

// Security validation helpers
export const SECURITY_CONSTRAINTS = {
  MIN_NAME_LENGTH: 1,
  MAX_NAME_LENGTH: 100,
  MAX_EXPIRATION_YEARS: 5,
  ALLOWED_NAME_PATTERN: /^[a-zA-Z0-9\s\-_\.]+$/,
} as const;