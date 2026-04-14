import { Button } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import type { Route } from "next";
import type { ComponentType, SVGProps } from "react";
import { NavLink } from "~/components/nav-link";
import type {
  IntegrationCategory,
  IntegrationStatus,
} from "~/lib/content-schemas";
import { CATEGORY_LABEL } from "./integration-labels";

interface IntegrationSidebarProps {
  category: IntegrationCategory;
  docsUrl?: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  status: NonNullable<IntegrationStatus> | "live";
  title: string;
}

export function IntegrationSidebar({
  icon: Icon,
  title,
  category,
  status,
  docsUrl,
}: IntegrationSidebarProps) {
  const ctaLabel =
    status === "coming-soon" ? "Join waitlist" : "Connect in workspace";

  return (
    <aside className="flex w-full flex-col gap-6 lg:w-[280px]">
      <div className="flex items-center gap-4">
        {Icon && (
          <div className="flex size-12 items-center justify-center rounded-lg bg-white">
            <Icon aria-hidden className="size-7 text-black" />
          </div>
        )}
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{title}</span>
          <span className="text-muted-foreground text-sm">By Lightfast</span>
        </div>
      </div>

      <Separator className="bg-border/50" />

      <dl className="flex flex-col gap-5">
        <Row label="Category" value={CATEGORY_LABEL[category]} />
        {docsUrl && (
          <Row
            label="Documentation"
            value={
              <NavLink
                className="text-muted-foreground hover:text-foreground"
                href={docsUrl as Route}
                prefetch
              >
                Connector docs
              </NavLink>
            }
          />
        )}
      </dl>

      <Button asChild className="w-full" variant="default">
        <NavLink href={"/" as Route}>{ctaLabel}</NavLink>
      </Button>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-medium text-foreground text-sm">{label}</dt>
      <dd className="text-muted-foreground text-sm">{value}</dd>
    </div>
  );
}
