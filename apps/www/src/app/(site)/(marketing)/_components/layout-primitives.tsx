import { cn } from "@repo/ui-v2/lib/utils";
import type { ComponentPropsWithoutRef } from "react";

export const marketingLayout = {
  chromeInset: "px-6 py-4 sm:px-10 lg:px-4 lg:py-4",
  companyShift:
    "transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform group-has-[[data-company-trigger][data-popup-open]]/company:-translate-x-8 group-has-[[data-company-trigger][data-popup-open]]/company:duration-1000",
  content: "mx-auto w-full max-w-4xl px-6 sm:px-10 lg:px-32",
  contentBleed: "marketing-content-bleed",
  contentBleedWide: "marketing-content-bleed-wide",
  contentStartX: "px-6 sm:px-10 lg:pl-[calc(50vw_-_20rem)] lg:pr-8",
  edgeX: "px-6 sm:px-10 lg:px-8",
  pageTop: "pt-28 sm:pt-32 lg:pt-20",
} as const;

export function MarketingContent({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return <div className={cn(marketingLayout.content, className)} {...props} />;
}

export function MarketingContentBleed({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cn(marketingLayout.contentBleed, className)} {...props} />
  );
}

export function MarketingContentBleedWide({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(marketingLayout.contentBleedWide, className)}
      {...props}
    />
  );
}
