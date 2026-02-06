"use client";

import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { Search, Activity, GitBranch, X } from "lucide-react";
import { useState } from "react";

interface PromptCategory {
  id: string;
  label: string;
  icon: React.ReactNode;
  prompts: string[];
}

const categories: PromptCategory[] = [
  {
    id: "explore",
    label: "Explore",
    icon: <Search className="w-4 h-4" />,
    prompts: [
      "What are the main topics in this workspace?",
      "Summarize the most recent documents",
      "What are the key themes across all sources?",
      "Find the most referenced concepts",
    ],
  },
  {
    id: "activity",
    label: "Activity",
    icon: <Activity className="w-4 h-4" />,
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
    icon: <GitBranch className="w-4 h-4" />,
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
    (c) => c.id === selectedCategory,
  );

  return (
    <div className="w-full mx-auto">
      {!selectedCategory ? (
        <div className="flex flex-wrap justify-center gap-3">
          {categories.map((category) => (
            <Button
              key={category.id}
              variant="outline"
              size="lg"
              className="dark:bg-card dark:border-border/70 active:bg-transparent rounded-sm hover:bg-transparent dark:hover:bg-transparent hover:border-border/50"
              onClick={() => handleCategoryClick(category.id)}
            >
              {category.icon}
              <span>{category.label}</span>
            </Button>
          ))}
        </div>
      ) : (
        <div className="border border-border/50 p-2 rounded-sm bg-background backdrop-blur-2xl shadow-sm">
          <div className="flex items-center justify-between px-2 pb-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-2">
              {selectedCategoryData?.icon}
              <span>{selectedCategoryData?.label}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full"
              onClick={() => {
                setSelectedCategory(null);
                setVisiblePrompts(0);
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div className="grid gap-1">
            {selectedCategoryData?.prompts.map((prompt, index) => (
              <div
                key={`${selectedCategory}-${prompt}`}
                className={cn(
                  "opacity-0 translate-y-4 transition-all duration-500 ease-out",
                  index < visiblePrompts && "opacity-100 translate-y-0",
                )}
                style={{
                  transitionDelay: `${index * 150}ms`,
                }}
              >
                <Button
                  variant="ghost"
                  onClick={() => handlePromptClick(prompt)}
                  className="w-full text-left justify-start whitespace-normal hover:bg-transparent dark:hover:bg-muted/30"
                >
                  <span className="text-xs font-base">{prompt}</span>
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
