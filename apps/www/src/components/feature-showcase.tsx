/**
 * Feature Showcase Component
 *
 * Two-column layout with text on one side and visual demo on the other.
 * Supports alternating layouts (text-left/right) for visual variety.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { exposureTrial } from "~/lib/fonts";
import { VisualShowcase } from "~/components/visual-showcase";

interface FeatureShowcaseProps {
  title: string;
  description: string;
  linkText: string;
  linkHref: string;
  children: ReactNode;
  reverse?: boolean;
}

export function FeatureShowcase({
  title,
  description,
  linkText,
  linkHref,
  children,
  reverse = false,
}: FeatureShowcaseProps) {
  return (
    <div className="rounded-xs bg-card border border-transparent p-6 lg:p-8">
      <div
        className={`grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12 items-center`}
      >
        {/* Text Content - 1/3 */}
        <div className={`flex flex-col gap-4 ${reverse ? "lg:order-2" : ""}`}>
          <h2
            className={`text-xl sm:text-2xl font-light leading-[1.2] tracking-[-0.02em] ${exposureTrial.className}`}
          >
            {title}
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed">
            {description}
          </p>
          <Link
            href={linkHref}
            className="group inline-flex items-center text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            <span>{linkText}</span>
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        {/* Visual Demo - 2/3 */}
        <div className={`lg:col-span-2 ${reverse ? "lg:order-1" : ""}`}>
          <VisualShowcase minHeight="400px" maxHeight="480px">
            {children}
          </VisualShowcase>
        </div>
      </div>
    </div>
  );
}
