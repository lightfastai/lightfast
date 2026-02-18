import { cn } from "@repo/ui/lib/utils";
import { AlertCircle, XCircle, CheckCircle2 } from "lucide-react";
import type React from "react";

interface ValidationErrorProps {
	children: React.ReactNode;
	title?: string;
	className?: string;
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
				"bg-card border border-transparent p-6 rounded-xs my-10 flex gap-3",
				"[&_*]:text-xs [&_p]:leading-relaxed [&_p]:mt-0",
				className,
			)}
		>
			{isError ? (
				<XCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
			) : (
				<AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
			)}

			<div className="flex-1 space-y-2">
				{title && <div className="font-semibold">{title}</div>}
				<div className="leading-relaxed">{children}</div>
			</div>
		</div>
	);
}

interface ValidationErrorListProps {
	errors: string[];
	title?: string;
	type?: "error" | "warning";
	className?: string;
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
		<ValidationError title={title} type={type} className={className}>
			<ul className="space-y-1.5 list-none pl-0 m-0">
				{errors.map((error, index) => (
					<li key={`${error}-${index}`} className="flex items-start gap-2">
						<span className="text-current opacity-70 select-none">•</span>
						<code className="flex-1">{error}</code>
					</li>
				))}
			</ul>
		</ValidationError>
	);
}

interface ValidationExampleProps {
	good?: string | string[];
	bad?: string | string[];
	title?: string;
	className?: string;
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
				<div className="text-sm font-semibold text-foreground">{title}</div>
			)}

			{/* Valid examples */}
			{goodArray.length > 0 && (
				<div className="bg-card border border-transparent p-6 rounded-xs">
					<div className="text-xs font-semibold mb-3 opacity-60">Valid</div>
					<div className="space-y-2">
						{goodArray.map((example, index) => (
							<div key={`${example}-${index}`} className="flex items-start gap-3">
								<CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
								<code className="text-xs font-mono break-all">{example}</code>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Invalid examples */}
			{badArray.length > 0 && (
				<div className="bg-card border border-transparent p-6 rounded-xs">
					<div className="text-xs font-semibold mb-3 opacity-60">Invalid</div>
					<div className="space-y-2">
						{badArray.map((example, index) => (
							<div key={`${example}-${index}`} className="flex items-start gap-3">
								<XCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
								<code className="text-xs font-mono break-all opacity-70">
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
