import Link from "next/link";
import { CheckCircle, Package, BookOpen, type LucideIcon } from "lucide-react";

interface AccessCard {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
}

const accessCards: AccessCard[] = [
  {
    href: "/sign-in",
    icon: CheckCircle,
    title: "Have Access?",
    description: "Go to App and start searching your team's knowledge base.",
  },
  {
    href: "/docs/api-reference/overview",
    icon: Package,
    title: "API Platform",
    description: "Use our APIs and models to build your own AI experiences.",
  },
  {
    href: "/docs/get-started/overview",
    icon: BookOpen,
    title: "Docs",
    description:
      "Learn how to integrate and use Lightfast in your applications.",
  },
];

export function PlatformAccessCards() {
  return (
    <div className="max-w-6xl px-4 mx-auto w-full">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {accessCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href} className="group">
              <div className="relative h-full rounded-xs border border-transparent bg-card p-8 transition-all duration-200 hover:border-muted-foreground/20 hover:bg-accent/5">
                <div className="mb-22">
                  <Icon className="h-5 w-5 text-foreground" />
                </div>
                <h3 className="mb-2 text-xl font-medium text-foreground">
                  {card.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {card.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

