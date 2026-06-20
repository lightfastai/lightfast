import { Button } from "@repo/ui-v2/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@repo/ui-v2/components/ui/sheet";
import type { ReactElement, ReactNode } from "react";

const introParagraphs = [
  [
    "Lightfast is building the operating layer",
    "for AI work that needs memory, review,",
    "and human trust.",
  ],
  [
    "We care about the space between the",
    "prompt and the outcome: what happened,",
    "what changed, and who needs to decide.",
  ],
  [
    "For teams coordinating agent work across",
    "handoffs, retries, and long-running tasks,",
    "context should stay visible as work moves.",
  ],
];

const mediaWords = ["Observe", "Remember", "Review", "Ship"];

const principles = [
  {
    label: "Context before speed",
    text: "A shared system for understanding what happened, what is happening, and what needs attention next.",
  },
  {
    label: "Durability as a default",
    text: "Work should survive handoffs, resumes, retries, and long-running tasks.",
  },
  {
    label: "Control stays visible",
    text: "Clear state, review points, and reversible decisions keep people in control.",
  },
];

export function About({
  children = "About",
  trigger,
}: {
  children?: ReactNode;
  trigger?: ReactElement;
}) {
  return (
    <Sheet>
      <SheetTrigger
        data-about-trigger
        render={trigger ?? <Button className="px-0" variant="link" />}
      >
        {children}
      </SheetTrigger>
      <SheetContent
        className="group/about-sheet z-[60] overflow-y-auto"
        motion="slide"
        size="wide"
      >
        <div className="flex min-h-full flex-col px-6 pt-7 pb-10">
          <div className="flex items-center gap-3 pr-12">
            <span className="size-2 rounded-full bg-foreground" />
            <SheetTitle className="text-sm tracking-normal">
              About Lightfast
            </SheetTitle>
          </div>
          <SheetDescription className="sr-only">
            Lightfast is building the operating layer between AI agents, apps,
            and the teams responsible for real work.
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
                        className="group-data-starting-style/about-sheet:!translate-y-[150%] group-data-starting-style/about-sheet:!opacity-0 block translate-y-[150%] opacity-0 transition-[opacity,translate] duration-[1250ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-data-open/about-sheet:translate-y-0 group-data-open/about-sheet:opacity-100"
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
              <span>EST 2026</span>
              <span>Agent operations</span>
            </div>
            <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-border bg-primary text-primary-foreground">
              <div className="flex h-full scale-[1.05] flex-col justify-between p-5 transition-[scale] duration-[1075ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-data-open/about-sheet:scale-100">
                {mediaWords.map((word) => (
                  <span
                    className="block font-medium text-4xl leading-none tracking-normal sm:text-5xl"
                    key={word}
                  >
                    {word}
                  </span>
                ))}
              </div>
              <div className="absolute inset-0 bg-secondary transition-opacity duration-[1075ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-data-open/about-sheet:opacity-0" />
            </div>
          </section>

          <section className="mt-[38px] grid gap-y-[38px] border-border border-t pt-[38px] sm:grid-cols-2 sm:gap-x-0">
            <div className="flex items-center gap-3 self-start">
              <span className="size-2 rounded-full bg-foreground" />
              <h3 className="font-medium text-foreground text-xl leading-none tracking-normal sm:text-2xl">
                Principles
              </h3>
            </div>
            <dl className="grid">
              {principles.map((item) => (
                <div
                  className="mb-[38px] grid gap-[23px] border-border border-b pb-[38px] last:mb-0 last:border-b-0"
                  key={item.label}
                >
                  <dt className="font-medium text-base text-foreground leading-none tracking-normal sm:text-[17.5px]">
                    {item.label}
                  </dt>
                  <dd className="text-base text-foreground leading-[1.3] tracking-normal sm:text-[17.5px]">
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
