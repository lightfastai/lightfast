import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { toast } from "sonner";
import { captureException } from "@sentry/nextjs";
import { parseError } from "@vendor/observability/error";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * @deprecated Use domain-specific error handlers for better context
 * This generic handler will be refactored in the next iteration
 */
export const handleError = (error: unknown, withToast = true): string => {
  const message = parseError(error);
  
  // Capture to Sentry since parseError no longer does this
  try {
    captureException(error);
  } catch {
    // Ignore capture errors in production
  }
  
  if (withToast) {
    toast.error(message);
  }
  
  return message;
};
