"use client";

import { Button } from "@repo/ui-v2/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@repo/ui-v2/components/ui/sheet";

const introParagraphs = [
  [
    "Lightfast studies how people, machines,",
    "and artificial intelligence can work",
    "together.",
  ],
  [
    "We focus on scientific and engineering",
    "teams developing consequential",
    "physical technologies.",
  ],
  [
    "We study human–machine interaction",
    "alongside teams in real research and",
    "development environments.",
  ],
];

const mediaWords = ["People", "Machines", "AI", "Physical systems"];

const principles = [
  {
    label: "Human direction",
    text: "People bring purpose, domain knowledge, and judgment, and retain responsibility for decisions and consequences.",
  },
  {
    label: "Research in context",
    text: "We study specific human–machine interactions alongside teams working in real scientific and engineering environments.",
  },
  {
    label: "Useful results",
    text: "What generalizes may become research, tooling, infrastructure, or products suited to related teams.",
  },
];

export default function Company() {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            className="h-auto cursor-pointer justify-start px-0 py-0 font-normal text-muted-foreground text-sm leading-none transition-colors hover:text-foreground hover:no-underline"
            data-company-trigger
            type="button"
            variant="link"
          />
        }
      >
        Company
      </SheetTrigger>
      <SheetContent
        className="group/company-sheet z-50 overflow-y-auto"
        motion="slide"
        size="wide"
      >
        <div className="flex min-h-full flex-col px-6 pt-7 pb-10">
          <div className="flex items-center gap-3 pr-12">
            <span className="size-2 rounded-full bg-foreground" />
            <SheetTitle className="text-sm tracking-normal">Company</SheetTitle>
          </div>
          <SheetDescription className="sr-only">
            Lightfast studies how people, machines, and artificial intelligence
            can work together to develop consequential physical technologies.
          </SheetDescription>

          <div className="mt-8 w-full text-pretty font-medium text-foreground text-xl leading-snug tracking-normal sm:text-2xl">
            {introParagraphs.map((paragraph, paragraphIndex) => {
              const lineOffset = introParagraphs
                .slice(0, paragraphIndex)
                .reduce((total, current) => total + current.length, 0);

              return (
                <p className="mb-6 last:mb-0" key={paragraph.join(" ")}>
                  {paragraph.map((line, index) => (
                    <span className="block overflow-hidden" key={line}>
                      <span
                        className="block translate-y-full opacity-0 transition duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] group-data-open/company-sheet:translate-y-0 group-data-starting-style/company-sheet:translate-y-full! group-data-open/company-sheet:opacity-100 group-data-starting-style/company-sheet:opacity-0!"
                        style={{
                          transitionDelay: `${(lineOffset + index) * 30 + 20}ms`,
                        }}
                      >
                        {line}
                      </span>
                    </span>
                  ))}
                </p>
              );
            })}
          </div>

          <section className="mt-16">
            <div className="mb-4 flex items-center justify-between gap-4 text-muted-foreground text-xs leading-5">
              <span>Research &amp; development</span>
              <span>Applied AI lab</span>
            </div>
            <div className="relative aspect-4/5 overflow-hidden rounded-xl border border-border bg-primary text-primary-foreground">
              <div className="flex h-full scale-105 flex-col justify-between p-5 transition-transform duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] group-data-open/company-sheet:scale-100">
                {mediaWords.map((word) => (
                  <span
                    className="block font-medium text-4xl leading-none tracking-normal sm:text-5xl"
                    key={word}
                  >
                    {word}
                  </span>
                ))}
              </div>
              <div className="absolute inset-0 bg-secondary transition-opacity duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] group-data-open/company-sheet:opacity-0" />
            </div>
          </section>

          <section className="mt-10 grid gap-y-10 border-border border-t pt-10 sm:grid-cols-2 sm:gap-x-0">
            <div className="flex items-center gap-3 self-start">
              <span className="size-2 rounded-full bg-foreground" />
              <h3 className="font-medium text-foreground text-xl leading-none tracking-normal sm:text-2xl">
                Principles
              </h3>
            </div>
            <dl className="grid">
              {principles.map((item) => (
                <div
                  className="mb-10 grid gap-6 border-border border-b pb-10 last:mb-0 last:border-b-0"
                  key={item.label}
                >
                  <dt className="font-medium text-base text-foreground leading-none tracking-normal sm:text-lg">
                    {item.label}
                  </dt>
                  <dd className="text-base text-foreground leading-tight tracking-normal sm:text-lg">
                    {item.text}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
