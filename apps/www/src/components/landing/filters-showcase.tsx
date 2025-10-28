"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@repo/ui/components/ui/button";

const filterCategories = [
  { id: "sources", label: "Sources" },
  { id: "types", label: "Types" },
  { id: "authors", label: "Authors" },
  { id: "states", label: "States" },
  { id: "labels", label: "Labels" },
  { id: "temporal", label: "Published date" },
];

const filterOptions = {
  sources: [
    { icon: "📁", label: "GitHub" },
    { icon: "📝", label: "Notion" },
    { icon: "💬", label: "Slack" },
    { icon: "📊", label: "Linear" },
  ],
  types: [
    { icon: "🔀", label: "Pull requests" },
    { icon: "🐛", label: "Issues" },
    { icon: "📄", label: "Documents" },
    { icon: "💬", label: "Messages" },
  ],
  authors: [
    { icon: "👤", label: "alice@example.com" },
    { icon: "👤", label: "bob@example.com" },
  ],
  states: [
    { icon: "✅", label: "Open" },
    { icon: "🔒", label: "Closed" },
    { icon: "🔀", label: "Merged" },
  ],
  labels: [
    { icon: "🏷", label: "incident" },
    { icon: "🏷", label: "billing" },
    { icon: "🏷", label: "feature" },
  ],
  temporal: [
    { icon: "📅", label: "Last week" },
    { icon: "📅", label: "Last month" },
    { icon: "📅", label: "Last quarter" },
  ],
};

export function FiltersShowcase() {
  const [activeCategory, setActiveCategory] = useState("sources");

  return (
    <div className="max-w-3xl text-foreground mx-auto border border-border bg-background rounded-md overflow-hidden">
      <div className="flex flex-col lg:flex-row">
        {/* Left Column: Filter Categories */}
        <div className="lg:w-1/3 p-3">
          <div className="space-y-1">
            {filterCategories.map((category) => (
              <Button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                variant={activeCategory === category.id ? "secondary" : "ghost"}
                className="w-full justify-start"
              >
                {category.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Right Column: Filter Options with Background */}
        <div className="lg:w-2/3 relative flex items-center justify-center">
          {/* Background Image */}
          <div className="absolute inset-4 rounded-sm overflow-hidden">
            <Image
              src="/images/playground-placeholder-1.webp"
              alt="Background"
              fill
              className="object-cover"
              priority
            />
          </div>

          {/* Content Overlay - Centered in two rows */}
          <div className="relative z-10 p-8 lg:p-12 w-full">
            <div className="space-y-8">
              {/* First Row: Filter options */}
              <div className="flex flex-wrap gap-2 justify-center">
                {filterOptions[
                  activeCategory as keyof typeof filterOptions
                ].map((option, index) => (
                  <div
                    key={index}
                    className="inline-flex items-center gap-2 px-4 py-2 font-semibold bg-primary border border-border rounded-sm text-sm text-secondary"
                  >
                    <span>{option.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
