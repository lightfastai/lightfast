import Link from "next/link";
import Image from "next/image";
import { FileText, Terminal, Layers, Timer } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

const iconMap = {
  "file-text": FileText,
  terminal: Terminal,
  layers: Layers,
  timer: Timer,
};

interface NextStepsProps {
  steps?: {
    icon: keyof typeof iconMap;
    image?: string;
    title: string;
    description: string;
    href: string;
  }[];
}

const defaultSteps: {
  icon: keyof typeof iconMap;
  image?: string;
  title: string;
  description: string;
  href: string;
}[] = [
  {
    icon: "file-text",
    image:
      "https://imagedelivery.net/UEsH3Cp6PfMQ5nCsxDnDxQ/3932e2f7-ef96-4b98-852c-3d281e468d00/public",
    title: "Use AGENTS.md files",
    description:
      "Give Codex additional instructions and context for your project.",
    href: "/docs/guides/agents",
  },
  {
    icon: "terminal",
    image:
      "https://imagedelivery.net/UEsH3Cp6PfMQ5nCsxDnDxQ/3932e2f7-ef96-4b98-852c-3d281e468d00/public",
    title: "Slash commands",
    description:
      "Learn how to use slash commands to use built-in Codex functionality or create your own for common prompts.",
    href: "/docs/guides/slash-commands",
  },
  {
    icon: "layers",
    image:
      "https://imagedelivery.net/UEsH3Cp6PfMQ5nCsxDnDxQ/3932e2f7-ef96-4b98-852c-3d281e468d00/public",
    title: "Model Context Protocol",
    description:
      "Connect Codex to third-party tools and extended context using MCP.",
    href: "/docs/guides/mcp",
  },
  {
    icon: "timer",
    image:
      "https://imagedelivery.net/UEsH3Cp6PfMQ5nCsxDnDxQ/3932e2f7-ef96-4b98-852c-3d281e468d00/public",
    title: "Automate fixes in CI",
    description:
      "Use Codex Autofix to review diffs and ship clean builds automatically.",
    href: "/docs/guides/ci",
  },
];

export function NextSteps({ steps = defaultSteps }: NextStepsProps) {
  return (
    <div className="my-16">
      {/* Centered heading */}
      <h2 className="text-center text-4xl sm:text-4xl font-medium tracking-tight mb-6">
        Next steps
      </h2>

      <div
        className={cn(
          "grid grid-cols-1 sm:grid-cols-2 gap-6",
          steps.length >= 4 && "lg:grid-cols-4",
          steps.length === 3 && "lg:grid-cols-3",
        )}
      >
        {steps.map((step, _index) => {
          const Icon = iconMap[step.icon];

          return (
            <Link key={step.href} href={step.href} className="group block">
              <div className="space-y-4">
                {/* Card with image and icon */}
                <div
                  className={cn(
                    "relative rounded-xs overflow-hidden transition-all h-40",
                    !step.image && "bg-card/80 border border-border/50",
                  )}
                >
                  {step.image && (
                    <Image
                      src={step.image}
                      alt={step.title}
                      fill
                      priority
                      quality={60}
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      className="object-cover"
                    />
                  )}

                  {/* Icon overlay - centered */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex h-8 w-8 items-center justify-center bg-foreground/10 backdrop-blur-sm rounded-xs">
                      <Icon
                        className="h-5 w-5 text-white drop-shadow-lg"
                        strokeWidth={1.5}
                      />
                    </div>
                  </div>
                </div>

                {/* Title and description below card */}
                <div className="space-y-2">
                  <h3 className="text-lg font-medium text-foreground">
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
