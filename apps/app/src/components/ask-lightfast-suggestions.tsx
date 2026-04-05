"use client";

import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { Activity, GitBranch, Search, X } from "lucide-react";
import { useState } from "react";

interface PromptCategory {
  icon: React.ReactNode;
  id: string;
  label: string;
  prompts: string[];
}

const categories: PromptCategory[] = [
  {
    id: "explore",
    label: "Explore",
    icon: <Search className="h-3 w-3" />,
    prompts: [
      "What are the main topics in this organization?",
      "Summarize the most recent documents",
      "What are the key themes across all sources?",
      "Find the most referenced concepts",
    ],
  },
  {
    id: "activity",
    label: "Activity",
    icon: <Activity className="h-3 w-3" />,
    prompts: [
      "What changed in the last 24 hours?",
      "Show me recent pull requests and their status",
      "What are the latest commits across all repos?",
      "Summarize this week's activity",
    ],
  },
  {
    id: "connections",
    label: "Connections",
    icon: <GitBranch className="h-3 w-3" />,
    prompts: [
      "How are the recent changes connected?",
      "What dependencies exist between components?",
      "Show relationships between recent PRs",
      "Find related documents across sources",
    ],
  },
];

interface AskLightfastSuggestionsProps {
  onSelectPrompt: (prompt: string) => void;
}

export function AskLightfastSuggestions({
  onSelectPrompt,
}: AskLightfastSuggestionsProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [visiblePrompts, setVisiblePrompts] = useState<number>(0);

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setVisiblePrompts(0);

    const category = categories.find((c) => c.id === categoryId);
    if (category) {
      category.prompts.forEach((_, index) => {
        setTimeout(() => {
          setVisiblePrompts((prev) => prev + 1);
        }, index * 100);
      });
    }
  };

  const handlePromptClick = (prompt: string) => {
    onSelectPrompt(prompt);
    setSelectedCategory(null);
    setVisiblePrompts(0);
  };

  const selectedCategoryData = categories.find(
    (c) => c.id === selectedCategory
  );

  return (
    <div className="mx-auto w-full">
      {selectedCategory ? (
        <div className="rounded-md border border-border/50 bg-card/40 p-2 shadow-sm backdrop-blur-md">
          <div className="flex items-center justify-between px-2 pb-2">
            <div className="flex items-center gap-2 px-2 text-muted-foreground text-sm">
              {selectedCategoryData?.icon}
              <span>{selectedCategoryData?.label}</span>
            </div>
            <Button
              className="h-6 w-6 rounded-full"
              onClick={() => {
                setSelectedCategory(null);
                setVisiblePrompts(0);
              }}
              size="icon"
              variant="ghost"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div className="grid gap-1">
            {selectedCategoryData?.prompts.map((prompt, index) => (
              <div
                className={cn(
                  "translate-y-4 opacity-0 transition-all duration-500 ease-out",
                  index < visiblePrompts && "translate-y-0 opacity-100"
                )}
                key={`${selectedCategory}-${prompt}`}
                style={{
                  transitionDelay: `${index * 150}ms`,
                }}
              >
                <Button
                  className="w-full justify-start whitespace-normal text-left hover:bg-transparent dark:hover:bg-muted/30"
                  onClick={() => handlePromptClick(prompt)}
                  variant="ghost"
                >
                  <span className="font-base text-sm">{prompt}</span>
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-3">
          {categories.map((category) => (
            <Button
              className="rounded-md hover:border-border/50 hover:bg-transparent active:bg-transparent dark:border-border/50 dark:bg-card/40 dark:backdrop-blur-md dark:hover:bg-transparent"
              key={category.id}
              onClick={() => handleCategoryClick(category.id)}
              size="lg"
              variant="outline"
            >
              {category.icon}
              <span className="text-sm">{category.label}</span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
