"use client";

import { ChevronDownIcon, CircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@repo/ui-v2/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui-v2/components/ui/collapsible";
import { cn } from "@repo/ui-v2/lib/utils";
import type { MotionProps } from "motion/react";
import { motion } from "motion/react";
import type { ComponentProps, ReactNode } from "react";
import { forwardRef, memo } from "react";
import { Shimmer } from "./shimmer";

export type ThinkingStepStatus = "complete" | "active" | "pending";

export type ThinkingStepsProps = ComponentProps<typeof Collapsible> & {
  defaultOpen?: boolean;
};

export const ThinkingSteps = memo(function ThinkingSteps({
  className,
  defaultOpen = true,
  ...props
}: ThinkingStepsProps) {
  return (
    <Collapsible
      className={cn("not-prose mb-4 w-full max-w-full", className)}
      defaultOpen={defaultOpen}
      {...props}
    />
  );
});

export const ThinkingStepsHeader = memo(function ThinkingStepsHeader({
  className,
  children = "Thinking",
  ...props
}: ComponentProps<typeof CollapsibleTrigger>) {
  return (
    <CollapsibleTrigger
      className={cn(
        "group flex w-fit items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground",
        className
      )}
      {...props}
    >
      <span>{children}</span>
      <HugeiconsIcon
        aria-hidden="true"
        className="size-3.5 transition-transform group-data-[panel-open]:rotate-180"
        icon={ChevronDownIcon}
        strokeWidth={2}
      />
    </CollapsibleTrigger>
  );
});

export const ThinkingStepsContent = memo(function ThinkingStepsContent({
  className,
  ...props
}: ComponentProps<typeof CollapsibleContent>) {
  return (
    <CollapsibleContent
      className={cn(
        "mt-2 flex flex-col outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
        className
      )}
      {...props}
    />
  );
});

export interface ThinkingStepProps extends MotionProps {
  children?: ReactNode;
  className?: string;
  label: string;
  description?: string;
  status?: ThinkingStepStatus;
  isLast?: boolean;
  icon?: ReactNode;
}

export const ThinkingStep = memo(function ThinkingStep({
  className,
  description,
  icon,
  isLast = false,
  label,
  status = "complete",
  children,
  ...props
}: ThinkingStepProps) {
  if (status === "pending") {
    return null;
  }

  return (
    <motion.div
      animate={{ height: "auto", opacity: 1 }}
      className={cn("relative overflow-hidden", className)}
      initial={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      {...props}
    >
      <div className="flex gap-2.5 px-1 py-1.5">
        <div className="flex w-[14px] shrink-0 flex-col items-center">
          <div className="grid size-3.5 place-items-center text-muted-foreground">
            {icon ?? (
              <HugeiconsIcon
                aria-hidden="true"
                className="size-3"
                icon={CircleIcon}
                strokeWidth={2}
              />
            )}
          </div>
          {!isLast ? <div className="mt-1 w-px flex-1 bg-border/60" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] leading-tight text-foreground">
            {status === "active" ? (
              <Shimmer as="span" duration={1}>
                {`${label}...`}
              </Shimmer>
            ) : (
              label
            )}
          </div>
          {description ? (
            <div className="mt-1 text-[13px] leading-snug text-muted-foreground">
              {description}
            </div>
          ) : null}
          {children}
        </div>
      </div>
    </motion.div>
  );
});

export interface ThinkingStepDetailsProps extends ComponentProps<"div"> {
  summary: string;
  details?: string[];
}

export function ThinkingStepDetails({
  className,
  details,
  summary,
  children,
  ...props
}: ThinkingStepDetailsProps) {
  return (
    <div className={cn("mt-1 text-muted-foreground text-xs", className)} {...props}>
      <div>{summary}</div>
      {details?.map((detail) => (
        <div key={detail}>{detail}</div>
      ))}
      {children}
    </div>
  );
}

export const ThinkingStepSources = forwardRef<
  HTMLDivElement,
  ComponentProps<"div">
>(function ThinkingStepSources({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn("mt-1 flex flex-wrap gap-1.5", className)}
      {...props}
    />
  );
});

export function ThinkingStepSource({
  className,
  ...props
}: ComponentProps<typeof Badge>) {
  return (
    <Badge
      className={cn("rounded-full", className)}
      variant="secondary"
      {...props}
    />
  );
}

export interface ThinkingStepImageProps extends ComponentProps<"img"> {
  caption?: string;
}

export function ThinkingStepImage({
  caption,
  className,
  ...props
}: ThinkingStepImageProps) {
  return (
    <figure className="mt-2">
      <img
        className={cn("max-w-[200px] rounded-md object-cover", className)}
        {...props}
      />
      {caption ? (
        <figcaption className="mt-1 text-muted-foreground text-xs">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
