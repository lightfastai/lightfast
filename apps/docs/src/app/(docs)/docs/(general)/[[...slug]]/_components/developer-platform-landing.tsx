import Image from "next/image";
import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import { Zap, Package, BookOpen, type LucideIcon } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

type CardVariant = "glass" | "muted" | "red";

interface NavCard {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
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

const navCards: NavCard[] = [
  {
    href: "/docs/get-started/quickstart",
    icon: Zap,
    title: "Quickstart",
    description:
      "Index your team's knowledge and start searching in 5 minutes.",
    variant: "glass",
  },
  {
    href: "/api/overview",
    icon: Package,
    title: "API Reference",
    description: "Three routes for search, contents, and similar content.",
    variant: "muted",
  },
  {
    href: "/docs/integrate/sdk",
    icon: BookOpen,
    title: "SDK & MCP",
    description: "Integrate anywhere with the TypeScript SDK and MCP tools.",
    variant: "red",
  },
];

export function DeveloperPlatformLanding() {
  return (
    <div className="mx-auto pt-16">
      {/* Value prop + image */}
      <div className="h-fit grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
        {/* Left: text */}
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-light leading-[1.1] tracking-[-0.02em] text-balance font-[family-name:var(--font-exposure-plus)]">
            Memory built for teams
          </h1>
          <p className="mt-2 text-md text-foreground/70">
            Search everything your team knows. Get answers with sources.
          </p>

          <p className="mt-8 text-md text-foreground/90">
            Lightfast is the memory layer for software teams. It indexes code,
            docs, tickets, and conversations from across your organization so
            people and AI agents can find what they need. It can help you:
          </p>

          <ul className="mt-3 space-y-4 list-disc pl-5">
            <li className="text-md text-foreground/90">
              <span className="text-foreground font-semibold">
                Search by meaning
              </span>
              : Ask questions in natural language and Lightfast finds relevant
              results even when exact keywords don&apos;t match, connecting PRs,
              issues, docs, and discussions across your entire organization.
            </li>
            <li className="text-md text-foreground/90">
              <span className="text-foreground font-semibold">
                Get answers with citations
              </span>
              : Every answer includes sources showing where information came
              from. No black-box responses — trace any claim back to a specific
              document, PR, or conversation.
            </li>
            <li className="text-md text-foreground/90">
              <span className="text-foreground font-semibold">
                Trace decisions
              </span>
              : See who owns what, what depends on what, and why decisions were
              made. Lightfast maintains relationships between content so you can
              follow context across tools and teams.
            </li>
            <li className="text-md text-foreground/90">
              <span className="text-foreground font-semibold">
                Connect your tools
              </span>
              : Index content from GitHub, Linear, Notion, Slack, and Discord.
              Lightfast continuously syncs and respects source permissions so
              your data stays secure.
            </li>
            <li className="text-md text-foreground/90">
              <span className="text-foreground font-semibold">
                Integrate anywhere
              </span>
              : Three API routes and an MCP server handle everything. Search,
              get full documents, and find similar content — works with any
              agent framework or application in minutes.
            </li>
          </ul>

          <div className="mt-8">
            <Button asChild size="lg" className="rounded-full">
              <Link href="/docs/get-started/quickstart">Join Early Access</Link>
            </Button>
          </div>
        </div>

        {/* Right: image */}
        <div className="flex items-center h-3/4 justify-center">
          <div className="relative rounded-xl overflow-hidden border border-border aspect-[16/9]">
            <Image
              src="/images/cloud-preview.webp"
              alt="Lightfast cloud preview"
              width={800}
              height={450}
              className="w-full h-full object-cover"
              priority
            />
          </div>
        </div>
      </div>

      {/* Routing cards */}
      <div className="section-gap-b grid grid-cols-1 md:grid-cols-12 gap-4 pt-12">
        {navCards.map((card) => {
          const Icon = card.icon;
          const styles = variantStyles[card.variant];

          return (
            <Link
              key={card.href}
              href={card.href}
              className={cn("group", styles.colSpan)}
            >
              <div
                className={cn(
                  "relative h-full rounded-xs border p-6 transition-all duration-200",
                  styles.card,
                )}
              >
                <div className="mb-20">
                  <Icon className={cn("h-6 w-6", styles.icon)} />
                </div>
                <h3 className={cn("mb-2 text-xl font-medium", styles.title)}>
                  {card.title}
                </h3>
                <p
                  className={cn("text-sm leading-relaxed", styles.description)}
                >
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
