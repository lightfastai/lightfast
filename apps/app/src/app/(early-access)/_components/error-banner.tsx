interface EarlyAccessErrorBannerProps {
  isRateLimit: boolean;
  message: string;
}

export function EarlyAccessErrorBanner({
  isRateLimit,
  message,
}: EarlyAccessErrorBannerProps) {
  return (
    <div className="space-y-1">
      <div
        className={`rounded-lg border p-3 ${
          isRateLimit
            ? "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950"
            : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
        }`}
      >
        <p
          className={`text-sm ${
            isRateLimit
              ? "text-yellow-800 dark:text-yellow-200"
              : "text-red-800 dark:text-red-200"
          }`}
        >
          {message}
        </p>
      </div>
      {isRateLimit && (
        <p className="text-muted-foreground text-sm">
          Please wait a moment before trying again.
        </p>
      )}
    </div>
  );
}
