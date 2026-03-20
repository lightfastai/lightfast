import { cn } from "@repo/ui/lib/utils";
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import type React from "react";

interface ValidationErrorProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  type?: "error" | "warning";
}

/**
 * ValidationError Component
 *
 * Displays validation errors and warnings in a minimal callout.
 * Matches the Alert component aesthetic - clean bg-card with colored icon only.
 *
 * @example
 * ```tsx
 * <ValidationError title="Invalid Store Name">
 *   Error: Store name must be 20 characters or less
 * </ValidationError>
 * ```
 */
export function ValidationError({
  children,
  title,
  className,
  type = "error",
}: ValidationErrorProps) {
  const isError = type === "error";

  return (
    <div
      className={cn(
        "my-10 flex gap-3 rounded-xs border border-transparent bg-card p-6",
        "[&_*]:text-xs [&_p]:mt-0 [&_p]:leading-relaxed",
        className
      )}
    >
      {isError ? (
        <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-400" />
      ) : (
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
      )}

      <div className="flex-1 space-y-2">
        {title && <div className="font-semibold">{title}</div>}
        <div className="leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

interface ValidationErrorListProps {
  className?: string;
  errors: string[];
  title?: string;
  type?: "error" | "warning";
}

/**
 * ValidationErrorList Component
 *
 * Displays a list of validation errors in a compact format.
 * Perfect for showing multiple related error messages.
 *
 * @example
 * ```tsx
 * <ValidationErrorList
 *   title="Invalid Store Name"
 *   errors={[
 *     "Store name must be 20 characters or less",
 *     "Store name must be lowercase alphanumeric with hyphens only"
 *   ]}
 * />
 * ```
 */
export function ValidationErrorList({
  errors,
  title,
  type = "error",
  className,
}: ValidationErrorListProps) {
  return (
    <ValidationError className={className} title={title} type={type}>
      <ul className="m-0 list-none space-y-1.5 pl-0">
        {errors.map((error, index) => (
          <li className="flex items-start gap-2" key={`${error}-${index}`}>
            <span className="select-none text-current opacity-70">•</span>
            <code className="flex-1">{error}</code>
          </li>
        ))}
      </ul>
    </ValidationError>
  );
}

interface ValidationExampleProps {
  bad?: string | string[];
  className?: string;
  good?: string | string[];
  title?: string;
}

/**
 * ValidationExample Component
 *
 * Shows good vs bad examples in a clean, minimal style.
 * Matches Alert component aesthetic - bg-card with colored icons only.
 *
 * @example
 * ```tsx
 * <ValidationExample
 *   good={["docs-site", "api-reference"]}
 *   bad={["-invalid", "invalid-", "Invalid_Name"]}
 * />
 * ```
 */
export function ValidationExample({
  good,
  bad,
  title,
  className,
}: ValidationExampleProps) {
  const goodArray = Array.isArray(good) ? good : good ? [good] : [];
  const badArray = Array.isArray(bad) ? bad : bad ? [bad] : [];

  return (
    <div className={cn("my-10 space-y-3", className)}>
      {title && (
        <div className="font-semibold text-foreground text-sm">{title}</div>
      )}

      {/* Valid examples */}
      {goodArray.length > 0 && (
        <div className="rounded-xs border border-transparent bg-card p-6">
          <div className="mb-3 font-semibold text-xs opacity-60">Valid</div>
          <div className="space-y-2">
            {goodArray.map((example, index) => (
              <div
                className="flex items-start gap-3"
                key={`${example}-${index}`}
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                <code className="break-all font-mono text-xs">{example}</code>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invalid examples */}
      {badArray.length > 0 && (
        <div className="rounded-xs border border-transparent bg-card p-6">
          <div className="mb-3 font-semibold text-xs opacity-60">Invalid</div>
          <div className="space-y-2">
            {badArray.map((example, index) => (
              <div
                className="flex items-start gap-3"
                key={`${example}-${index}`}
              >
                <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-400" />
                <code className="break-all font-mono text-xs opacity-70">
                  {example}
                </code>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
