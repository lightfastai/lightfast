import { Button } from "@repo/ui/components/ui/button";
import { ChevronLeft } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

/**
 * General-purpose compact back affordance for the topbar `@actions` slot.
 * Ghost chrome (transparent at rest, fills on hover) sized to match the
 * signals toolbar controls: h-6 / rounded-lg / text-sm. The chevron implies
 * "back", so `label` is just the destination name (e.g. "Automations").
 */
export function BackButton({ href, label }: { href: Route; label: string }) {
  return (
    <Button
      asChild
      className="-ml-1 h-6 gap-1 rounded-lg px-2 font-normal text-muted-foreground text-sm hover:bg-muted/60 hover:text-foreground"
      size="sm"
      variant="ghost"
    >
      <Link href={href}>
        <ChevronLeft className="size-3" />
        {label}
      </Link>
    </Button>
  );
}
