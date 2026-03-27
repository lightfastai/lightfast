import { cn } from "@repo/ui/lib/utils";
import { FileText, Layers, Terminal, Timer } from "lucide-react";
import Image from "next/image";
import { ContentLink } from "~/components/content-link";

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
      <h2 className="mb-6 text-center font-medium text-4xl tracking-tight sm:text-4xl">
        Next steps
      </h2>

      <div
        className={cn(
          "grid grid-cols-1 gap-6 sm:grid-cols-2",
          steps.length >= 4 && "lg:grid-cols-4",
          steps.length === 3 && "lg:grid-cols-3"
        )}
      >
        {steps.map((step, _index) => {
          const Icon = iconMap[step.icon];

          return (
            <ContentLink
              className="group block"
              href={step.href}
              key={step.href}
            >
              <div className="space-y-4">
                {/* Card with image and icon */}
                <div
                  className={cn(
                    "relative h-40 overflow-hidden rounded-xs transition-all",
                    !step.image && "border border-border/50 bg-card/80"
                  )}
                >
                  {step.image && (
                    <Image
                      alt={step.title}
                      className="object-cover"
                      fill
                      priority
                      quality={60}
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      src={step.image}
                    />
                  )}

                  {/* Icon overlay - centered */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xs bg-foreground/10 backdrop-blur-sm">
                      <Icon
                        className="h-5 w-5 text-white drop-shadow-lg"
                        strokeWidth={1.5}
                      />
                    </div>
                  </div>
                </div>

                {/* Title and description below card */}
                <div className="space-y-2">
                  <h3 className="font-medium text-foreground text-lg">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            </ContentLink>
          );
        })}
      </div>
    </div>
  );
}
