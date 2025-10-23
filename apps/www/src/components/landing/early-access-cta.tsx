"use client";

import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { Button } from "@repo/ui/components/ui/button";
import Link from "next/link";

/**
 * EarlyAccessCTA - Simple card for early access signup
 *
 * Features:
 * - Static card with early access information
 * - Sticky positioning at bottom left
 * - Uses shadcn Card component
 *
 * @example
 * ```tsx
 * <EarlyAccessCTA />
 * ```
 */
export function EarlyAccessCTA() {
  return (
    <div className="w-full -mx-4">
      <Card className="backdrop-blur-xl p-0 rounded-sm border-none shadow-2xl">
        <CardContent className="p-4">
          <div className="space-y-4">
            <div>
              <h3 className="text-card-foreground text-base font-medium mb-2">
                Join Early Access
              </h3>
              <p className="text-muted-foreground text-sm font-light leading-relaxed">
                We are currently accepting new early access users. Get started
                with Lightfast today.
              </p>
            </div>

            <Button asChild size="sm" className="w-full">
              <Link
                href="/early-access"
                className="flex items-center justify-center gap-2"
              >
                Apply Now
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
