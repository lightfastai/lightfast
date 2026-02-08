"use client";

import { IntegrationIcons } from "@repo/ui/integration-icons";
import { cn } from "@repo/ui/lib/utils";
import { Check } from "lucide-react";
import type { Provider } from "./use-connect-params";
import { useConnectParams } from "./use-connect-params";

interface ProviderOption {
  id: Provider | "coming_soon";
  name: string;
  description: string;
  icon: keyof typeof IntegrationIcons;
  status: "available" | "coming_soon";
}

const providers: ProviderOption[] = [
  {
    id: "github",
    name: "GitHub",
    description: "Connect repositories",
    icon: "github",
    status: "available",
  },
  {
    id: "vercel",
    name: "Vercel",
    description: "Connect projects",
    icon: "vercel",
    status: "available",
  },
  {
    id: "linear",
    name: "Linear",
    description: "Connect issues & projects",
    icon: "linear",
    status: "available",
  },
  {
    id: "sentry",
    name: "Sentry",
    description: "Connect error tracking",
    icon: "sentry",
    status: "available",
  },
];

const comingSoon: ProviderOption[] = [
  {
    id: "coming_soon",
    name: "Slack",
    description: "Coming soon",
    icon: "slack",
    status: "coming_soon",
  },
  {
    id: "coming_soon",
    name: "Notion",
    description: "Coming soon",
    icon: "notion",
    status: "coming_soon",
  },
];

export function ProviderSelector() {
  const { provider, setProvider } = useConnectParams();

  return (
    <div className="flex flex-wrap gap-3">
      {providers.map((option) => {
        const Icon = IntegrationIcons[option.icon];
        const isSelected = provider === option.id;

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => setProvider(option.id as Provider)}
            className={cn(
              "relative flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all min-w-[120px]",
              isSelected
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/50"
            )}
          >
            {isSelected && (
              <div className="absolute top-2 right-2">
                <Check className="h-4 w-4 text-primary" />
              </div>
            )}
            <Icon className="h-8 w-8 mb-2" />
            <span className="font-medium text-sm">{option.name}</span>
            <span className="text-xs text-muted-foreground">
              {option.description}
            </span>
          </button>
        );
      })}

      {/* Coming Soon */}
      {comingSoon.map((option, index) => {
        const Icon = IntegrationIcons[option.icon];

        return (
          <div
            key={`${option.name}-${index}`}
            className="relative flex flex-col items-center justify-center p-4 rounded-lg border-2 border-dashed border-border/50 min-w-[120px] opacity-50 cursor-not-allowed"
          >
            <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              Soon
            </span>
            <Icon className="h-8 w-8 mb-2" />
            <span className="font-medium text-sm">{option.name}</span>
            <span className="text-xs text-muted-foreground">
              {option.description}
            </span>
          </div>
        );
      })}
    </div>
  );
}
