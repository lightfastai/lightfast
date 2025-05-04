import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface StatusMessageProps {
  testResult: {
    success: boolean;
    message: string;
  } | null;
  onDismiss: () => void;
}

export function StatusMessage({ testResult, onDismiss }: StatusMessageProps) {
  if (!testResult) return null;

  return (
    <div
      className={cn(
        "mb-4 rounded-lg border p-4 text-sm",
        testResult.success
          ? "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/50 dark:text-green-400"
          : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400",
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "h-2 w-2 rounded-full",
            testResult.success ? "bg-green-500" : "bg-red-500",
          )}
        />
        <span className="flex-1">{testResult.message}</span>
        <button
          className="ring-offset-background focus:ring-ring ml-auto rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-none"
          onClick={onDismiss}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Dismiss</span>
        </button>
      </div>
    </div>
  );
}
