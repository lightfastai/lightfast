import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { toast } from "sonner";
import { parseError } from "@vendor/observability/error";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const handleError = (error: unknown, withToast = true): string => {
  const message = parseError(error);
  
  if (withToast) {
    toast.error(message);
  }
  
  return message;
};
