import Image from "next/image";
import Link from "next/link";
import { Code2, Cpu, Bot, Building2, Github, ArrowRight, Zap, Layers } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AlphaBanner } from "@/src/components/alpha-banner";

interface NavCard {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  action: string;
}

const useCaseCards: NavCard[] = [
  {
    href: "/use-cases/agent-builders",
    icon: Bot,
    title: "Agent Builders",
    description:
      "Build agents that understand your team's full context — code, history, and decisions.",
    action: "Explore",
  },
  {
    href: "/use-cases/engineering-leaders",
    icon: Building2,
    title: "Engineering Leaders",
    description:
      "Understand velocity, team health, and knowledge distribution at a glance.",
    action: "Explore",
  },
  {
    href: "/use-cases/technical-founders",
    icon: Zap,
    title: "Technical Founders",
    description:
      "Trace decisions from idea to implementation and measure engineering ROI.",
    action: "Explore",
  },
  {
    href: "/use-cases/platform-engineers",
    icon: Cpu,
    title: "Platform Engineers",
    description:
      "Monitor dependencies, predict incidents, and keep infrastructure healthy.",
    action: "Explore",
  },
];

const guideCards: NavCard[] = [
  {
    href: "/docs/integrate/sdk",
    icon: Code2,
    title: "TypeScript SDK",
    description: "Integrate Lightfast into your app with a typed, minimal SDK.",
    action: "Read guide",
  },
  {
    href: "/docs/integrate/mcp",
    icon: Layers,
    title: "MCP Server",
    description:
      "Expose Lightfast as an MCP tool for use with Claude, Cursor, and other AI agents.",
    action: "Read guide",
  },
  {
    href: "/docs/integrate/github",
    icon: Github,
    title: "Connect GitHub",
    description:
      "Index your repositories, PRs, issues, and code reviews automatically.",
    action: "Read guide",
  },
];

function SectionBadge({ label }: { label: string }) {
  return (
    <div className="mb-6">
      <span className="inline-flex items-center h-7 px-3 rounded-md border border-border text-xs text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function UseCaseCard({ card }: { card: NavCard }) {
  return (
    <Link href={card.href} className="group">
      <div className="h-full bg-card/40 border border-border/50 rounded-md p-6 transition-all duration-200 hover:bg-card/60 hover:border-border flex flex-col">
        <h3 className="text-base font-medium text-foreground">{card.title}</h3>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed flex-1">
          {card.description}
        </p>
        <span className="mt-6 flex items-center gap-1 text-sm text-muted-foreground">
          {card.action} <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}

function NavCard({ card }: { card: NavCard }) {
  const Icon = card.icon;
  return (
    <Link href={card.href} className="group">
      <div className="h-full border border-border rounded-md p-6 transition-all duration-200 hover:border-muted-foreground/20 hover:bg-accent/10 flex flex-col">
        <div className="mb-24">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="mb-2 text-base font-medium text-foreground">
          {card.title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed flex-1">
          {card.description}
        </p>
        <span className="mt-6 flex items-center gap-1 text-sm text-muted-foreground transition-colors group-hover:text-foreground">
          {card.action} <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}

export function DeveloperPlatformLanding() {
  return (
    <div className="mx-auto space-y-16">
      {/* Header + Banner */}
      <div className="space-y-4">
        <div className="flex flex-col items-center text-center max-w-2xl mx-auto">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-light leading-[1.1] tracking-[-0.02em] text-balance font-[family-name:var(--font-exposure-plus)]">
            Lightfast
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            Memory built for teams. Index everything your engineering org knows.
          </p>
        </div>

        <AlphaBanner />
      </div>

      {/* Get Started */}
      <section>
        <SectionBadge label="Get started" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Quickstart — featured, 2/3 width */}
          <Link href="/docs/get-started/quickstart" className="group md:col-span-2">
            <div className="relative h-72 overflow-hidden rounded-md">
              <Image
                src="/images/nascent_remix.webp"
                alt="Quickstart"
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 flex flex-col justify-between p-8">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-white/60">
                    Quickstart
                  </p>
                  <h3 className="mt-3 text-2xl font-medium leading-tight text-white">
                    Start searching in 5 minutes
                  </h3>
                </div>
                <span className="flex items-center gap-1 text-sm text-white/70">
                  Get started <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          </Link>

          {/* Features Overview */}
          <Link href="/docs/features" className="group">
            <div className="relative h-72 overflow-hidden rounded-md border border-border transition-all duration-200 hover:border-muted-foreground/40 hover:bg-muted/10">
              <div className="absolute inset-0 flex flex-col justify-between p-8">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-foreground/60">
                    Learn more
                  </p>
                  <h3 className="mt-3 text-2xl font-medium leading-tight text-foreground">
                    Features Overview
                  </h3>
                </div>
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  Explore features <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* Use Cases */}
      <section>
        <SectionBadge label="Use cases" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {useCaseCards.map((card) => (
            <UseCaseCard key={card.href} card={card} />
          ))}
        </div>
      </section>

      {/* Guides */}
      <section>
        <SectionBadge label="Guides" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {guideCards.map((card) => (
            <NavCard key={card.href} card={card} />
          ))}
        </div>
      </section>
    </div>
  );
}
