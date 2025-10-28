"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";

interface SectionContent {
  id: string;
  label: string;
  title: string;
  description: string;
  features: {
    title: string;
    description: string;
  }[];
}

const sections: SectionContent[] = [
  {
    id: "documents",
    label: "Documents & Code",
    title: "Pull requests, issues, docs, and discussions",
    description: "",
    features: [
      {
        title: "GitHub repositories",
        description:
          "Commits, pull requests, code reviews, and issue discussions automatically indexed and searchable.",
      },
      {
        title: "Linear issues",
        description:
          "Project updates, decisions, and context from your issue tracker—all connected to code changes.",
      },
      {
        title: "Notion & Slack",
        description:
          "Documentation, discussions, and decisions from your team's workspace, unified with code context.",
      },
    ],
  },
  {
    id: "decisions",
    label: "Decisions & Context",
    title: "Capture why decisions were made",
    description: "",
    features: [
      {
        title: "Decision history",
        description:
          "Never lose why a choice was made. See the discussion, who was involved, and what alternatives were considered.",
      },
      {
        title: "Context preservation",
        description:
          "Automatically capture important moments—decisions, incidents, launches—so nothing gets lost in chat history.",
      },
      {
        title: "Timeline tracking",
        description:
          "Understand how decisions evolved over time. See what changed, when, and why.",
      },
    ],
  },
  {
    id: "ownership",
    label: "People & Ownership",
    title: "Know who owns what and who has context",
    description: "",
    features: [
      {
        title: "Ownership mapping",
        description:
          "Automatically track who owns which features, services, and areas of the codebase.",
      },
      {
        title: "Expertise discovery",
        description:
          "Find who has worked on what, who reviewed changes, and who has deep context on any topic.",
      },
      {
        title: "Team knowledge",
        description:
          "Onboard new teammates faster. They can search and find context instead of asking 10 people.",
      },
    ],
  },
];

export function WhatWeRememberSection() {
  const [activeSection, setActiveSection] = useState(0);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const handleScroll = () => {
      const windowHeight = window.innerHeight;
      const triggerPoint = windowHeight * 0.4;

      for (let i = sectionRefs.current.length - 1; i >= 0; i--) {
        const section = sectionRefs.current[i];
        if (section) {
          const rect = section.getBoundingClientRect();
          if (rect.top <= triggerPoint) {
            setActiveSection(i);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <section className="pb-16">
      <div className="grid lg:grid-cols-2 gap-16">
        {/* Left Column - Scrolling Content */}
        <div className="space-y-32 lg:space-y-48">
          {sections.map((section, index) => (
            <div
              key={section.id}
              ref={(el) => {
                sectionRefs.current[index] = el;
              }}
              className="scroll-mt-24"
            >
              <div className="space-y-6">
                <p className="text-xs uppercase tracking-widest font-mono text-muted-foreground">
                  {section.label}
                </p>
                <h3 className="text-2xl font-base leading-tight sm:text-3xl lg:text-2xl max-w-sm text-foreground">
                  {section.title}
                </h3>
                <div className="space-y-6 mt-8">
                  {section.features.map((feature, featureIndex) => (
                    <div key={featureIndex}>
                      <h4 className="text-md font-semibold mb-2 text-foreground">
                        {feature.title}
                      </h4>
                      <p className="text-sm text-muted-foreground max-w-sm">
                        {feature.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Right Column - Sticky Panel */}
        <div className="hidden lg:block">
          <div className="sticky top-24">
            <div className="relative overflow-hidden rounded-sm border border-border bg-card">
              {/* Background Image */}
              <div className="absolute inset-0">
                <Image
                  src={`/images/playground-placeholder-${activeSection + 1}.webp`}
                  alt={sections[activeSection]?.label ?? ""}
                  fill
                  className="object-cover"
                />
              </div>

              <div className="relative p-8 h-[600px] flex items-center justify-center">
                <div className="text-center space-y-4">
                  <p className="text-xl font-semibold text-foreground">
                    {sections[activeSection]?.label}
                  </p>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                    {activeSection === 0 &&
                      "From GitHub, Linear, Notion, Slack, and more"}
                    {activeSection === 1 &&
                      "Never lose why a choice was made"}
                    {activeSection === 2 &&
                      "Find experts and ownership instantly"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
