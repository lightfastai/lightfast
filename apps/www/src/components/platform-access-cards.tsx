import Link from "next/link";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import { CheckCircle, Package, BookOpen, type LucideIcon } from "lucide-react";
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
    card: "bg-gradient-to-br from-muted/80 via-muted/50 to-card/30 backdrop-blur-xl border-border/30 shadow-inner hover:from-muted/90 hover:via-muted/60 hover:to-card/40",
    icon: "text-foreground",
    title: "text-foreground",
    description: "text-muted-foreground",
    colSpan: "md:col-span-5",
  },
  muted: {
    card: "bg-muted border-border hover:bg-accent/10 hover:border-muted-foreground/20",
    icon: "text-foreground",
    title: "text-foreground",
    description: "text-muted-foreground",
    colSpan: "md:col-span-4",
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
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
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
                "relative h-full rounded-xs border p-8 transition-all duration-200",
                styles.card,
              )}
            >
              <div className="mb-32">
                <Icon className={cn("h-5 w-5", styles.icon)} />
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
