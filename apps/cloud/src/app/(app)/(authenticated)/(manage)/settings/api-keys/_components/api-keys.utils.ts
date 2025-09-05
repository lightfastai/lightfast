import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import type { ExpirationOption } from "./api-keys.types";

// Date formatting utilities
export function formatDate(date: string | Date): string {
  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return formatDistanceToNow(dateObj, { addSuffix: true });
  } catch (error) {
    return "Unknown";
  }
}

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

// Expiration calculation
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

// Expiry status helpers
export function getExpiryInfo(expiresAt: string | Date | null) {
  if (!expiresAt) return null;
  
  const expiryDate = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  const now = new Date();
  const isExpired = expiryDate < now;
  
  if (isExpired) {
    return {
      text: `Expired ${formatDistanceToNow(expiryDate, { addSuffix: true })}`,
      className: "text-red-600 dark:text-red-400"
    };
  }
  
  const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntilExpiry <= 7) {
    return {
      text: `Expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}`,
      className: "text-orange-600 dark:text-orange-400"
    };
  }
  
  return {
    text: `Expires ${formatDistanceToNow(expiryDate, { addSuffix: true })}`,
    className: "text-muted-foreground"
  };
}

// Clipboard utilities
export async function copyToClipboard(text: string, successMessage?: string): Promise<boolean> {
  try {
    if (!navigator.clipboard) {
      throw new Error("Clipboard API not available");
    }

    await navigator.clipboard.writeText(text);
    
    toast.success(successMessage || "Copied to clipboard!", {
      description: "The content has been copied to your clipboard.",
    });
    
    return true;
  } catch (error) {
    // Fallback method
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      if (document.execCommand("copy")) {
        toast.success(successMessage || "Copied to clipboard!", {
          description: "The content has been copied to your clipboard.",
        });
        document.body.removeChild(textArea);
        return true;
      } else {
        throw new Error("Failed to copy using fallback method");
      }
    } catch (fallbackError) {
      toast.error("Copy failed", {
        description: "Unable to copy to clipboard. Please copy manually.",
      });
      return false;
    }
  }
}

// Status badge helpers
export function getStatusBadgeProps(isActive: boolean, isExpired?: boolean) {
  if (!isActive) {
    return {
      label: "Revoked",
      variant: "secondary" as const,
      className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
    };
  }
  
  if (isExpired) {
    return {
      label: "Expired",
      variant: "secondary" as const,
      className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300"
    };
  }
  
  return {
    label: "Active",
    variant: "secondary" as const,
    className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
  };
}