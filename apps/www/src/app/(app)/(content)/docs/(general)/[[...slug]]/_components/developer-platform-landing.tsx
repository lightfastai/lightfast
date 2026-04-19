import {
  ArrowRight,
  Bot,
  Building2,
  Code2,
  Cpu,
  Layers,
  Zap,
} from "lucide-react";
import type { Route } from "next";
import Image from "next/image";
import type { ComponentType, SVGProps } from "react";
import { AlphaBanner } from "~/app/(app)/(content)/docs/_components/alpha-banner";
import { ContentLink } from "~/components/content-link";
import { NavLink } from "~/components/nav-link";

function GithubIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

interface NavCard {
  action: string;
  description: string;
  // Routes pass through fumadocs [[...slug]] catch-all — not statically enumerable
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
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
    href: "/docs/connectors/github",
    icon: GithubIcon,
    title: "Connect GitHub",
    description:
      "Index your repositories, PRs, issues, and code reviews automatically.",
    action: "Read guide",
  },
];

function SectionBadge({ label }: { label: string }) {
  return (
    <div className="mb-6">
      <span className="inline-flex h-7 items-center rounded-md border border-border px-3 text-muted-foreground text-xs">
        {label}
      </span>
    </div>
  );
}

function UseCaseCard({ card }: { card: NavCard }) {
  return (
    <ContentLink className="group" href={card.href}>
      <div className="flex h-full flex-col rounded-md border border-border/50 bg-card/40 p-6 transition-all duration-200 hover:border-border hover:bg-card/60">
        <h3 className="font-medium text-base text-foreground">{card.title}</h3>
        <p className="mt-2 flex-1 text-muted-foreground text-sm leading-relaxed">
          {card.description}
        </p>
        <span className="mt-6 flex items-center gap-1 text-muted-foreground text-sm">
          {card.action} <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </ContentLink>
  );
}

function NavCard({ card }: { card: NavCard }) {
  const Icon = card.icon;
  return (
    <ContentLink className="group" href={card.href}>
      <div className="flex h-full flex-col rounded-md border border-border p-6 transition-all duration-200 hover:border-muted-foreground/20 hover:bg-accent/10">
        <div className="mb-24">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="mb-2 font-medium text-base text-foreground">
          {card.title}
        </h3>
        <p className="flex-1 text-muted-foreground text-sm leading-relaxed">
          {card.description}
        </p>
        <span className="mt-6 flex items-center gap-1 text-muted-foreground text-sm transition-colors group-hover:text-foreground">
          {card.action} <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </ContentLink>
  );
}

export function DeveloperPlatformLanding() {
  return (
    <div className="mx-auto space-y-16">
      {/* Header + Banner */}
      <div className="space-y-4">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <h1 className="text-balance font-light font-pp text-2xl leading-[1.1] tracking-[-0.02em] sm:text-3xl md:text-4xl">
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Quickstart — featured, 2/3 width */}
          <NavLink
            className="group md:col-span-2"
            href={"/docs/get-started/quickstart" as Route}
          >
            <div className="relative h-72 overflow-hidden rounded-md">
              <Image
                alt="Quickstart"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                fill
                src="/images/nascent_remix.webp"
              />
              <div className="absolute inset-0 flex flex-col justify-between p-8">
                <div>
                  <p className="font-medium text-white/60 text-xs uppercase tracking-wide">
                    Quickstart
                  </p>
                  <h3 className="mt-3 font-medium text-2xl text-white leading-tight">
                    Start searching in 5 minutes
                  </h3>
                </div>
                <span className="flex items-center gap-1 text-sm text-white/70">
                  Get started <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          </NavLink>
        </div>
      </section>

      {/* Use Cases */}
      <section>
        <SectionBadge label="Use cases" />
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {useCaseCards.map((card) => (
            <UseCaseCard card={card} key={card.href} />
          ))}
        </div>
      </section>

      {/* Guides */}
      <section>
        <SectionBadge label="Guides" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {guideCards.map((card) => (
            <NavCard card={card} key={card.href} />
          ))}
        </div>
      </section>
    </div>
  );
}
