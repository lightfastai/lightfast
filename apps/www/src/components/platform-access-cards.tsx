import Link from "next/link";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import { CheckCircle, Package, BookOpen  } from "lucide-react";
import type {LucideIcon} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

type CardVariant = "glass" | "muted" | "red";

interface AccessCard {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  external?: boolean;
  microfrontend?: boolean;
  variant: CardVariant;
}

const variantStyles: Record<
  CardVariant,
  {
    card: string;
    icon: string;
    title: string;
    description: string;
    colSpan: string;
  }
> = {
  glass: {
    card: "bg-muted-foreground/20 backdrop-blur-md border-border hover:bg-muted/60",
    icon: "text-foreground",
    title: "text-foreground",
    description: "text-muted-foreground",
    colSpan: "md:col-span-6",
  },
  muted: {
    card: "bg-muted border-border hover:bg-accent/10 hover:border-muted-foreground/20",
    icon: "text-foreground",
    title: "text-foreground",
    description: "text-muted-foreground",
    colSpan: "md:col-span-3",
  },
  red: {
    card: "bg-[var(--pitch-deck-red)] hover:bg-[var(--pitch-deck-red-overlay)]",
    icon: "text-primary",
    title: "text-primary",
    description: "text-primary",
    colSpan: "md:col-span-3",
  },
};

const accessCards: AccessCard[] = [
  {
    href: "/sign-in",
    icon: CheckCircle,
    title: "Have Access?",
    description:
      "Go to App and start searching your software team's knowledge base.",
    microfrontend: true,
    variant: "glass",
  },
  {
    href: "/docs/api-reference/overview",
    icon: Package,
    title: "API Platform",
    description: "Use our APIs and models to build your own AI experiences.",
    external: true,
    variant: "muted",
  },
  {
    href: "/docs/get-started/overview",
    icon: BookOpen,
    title: "Docs",
    description:
      "Learn how to integrate and use Lightfast in your applications.",
    external: true,
    variant: "red",
  },
];

export function PlatformAccessCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
      {accessCards.map((card) => {
        const Icon = card.icon;
        const LinkComponent = card.microfrontend ? MicrofrontendLink : Link;
        const linkProps = card.external
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {};
        const styles = variantStyles[card.variant];

        return (
          <LinkComponent
            key={card.href}
            href={card.href}
            className={cn("group", styles.colSpan)}
            {...linkProps}
          >
            <div
              className={cn(
                "relative h-full rounded-xs border p-10 transition-all duration-200",
                styles.card,
              )}
            >
              <div className="mb-40">
                <Icon className={cn("h-6 w-6", styles.icon)} />
              </div>
              <h3 className={cn("mb-2 text-xl font-medium", styles.title)}>
                {card.title}
              </h3>
              <p className={cn("text-sm leading-relaxed", styles.description)}>
                {card.description}
              </p>
            </div>
          </LinkComponent>
        );
      })}
    </div>
  );
}
