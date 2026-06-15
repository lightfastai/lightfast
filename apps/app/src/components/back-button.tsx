import { Button } from "@repo/ui/components/ui/button";
import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

export function BackButton({
  label,
  params,
  to,
}: {
  label: string;
  params: { slug: string };
  to: "/$slug/automations";
}) {
  return (
    <Button
      asChild
      className="-ml-1 h-6 gap-1 rounded-lg px-2 font-normal text-muted-foreground text-sm hover:bg-muted/60 hover:text-foreground"
      size="sm"
      variant="ghost"
    >
      <Link params={params} preload="intent" to={to}>
        <ChevronLeft className="size-3" />
        {label}
      </Link>
    </Button>
  );
}
