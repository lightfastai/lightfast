import { Button } from "@repo/ui-v2/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/ui-v2/components/ui/sheet";

const aboutItems = [
  {
    label: "Operating layer",
    text: "A shared system for understanding what happened, what is happening, and what needs attention next.",
  },
  {
    label: "Durable context",
    text: "Work should survive handoffs, resumes, retries, and long-running tasks.",
  },
  {
    label: "Human control",
    text: "Clear state, review points, and reversible decisions keep people in control.",
  },
];

export function About() {
  return (
    <Sheet>
      <SheetTrigger render={<Button className="px-0" variant="link" />}>
        About
      </SheetTrigger>
      <SheetContent
        className="z-[60] w-full overflow-y-auto sm:max-w-md"
        motion="slide"
      >
        <SheetHeader className="border-border border-b px-6 py-7">
          <SheetTitle className="text-2xl tracking-normal">
            About Lightfast
          </SheetTitle>
          <SheetDescription className="max-w-sm text-base leading-7">
            Lightfast is building the operating layer between AI agents, apps,
            and the teams responsible for real work.
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-6 px-6 py-6">
          <section className="grid gap-3">
            <h3 className="font-medium text-foreground text-sm">
              What we believe
            </h3>
            <p className="text-muted-foreground text-sm leading-7">
              Agents are becoming part of everyday operations. The missing layer
              is memory, coordination, and observability that helps people trust
              the work enough to keep moving.
            </p>
          </section>

          <section className="grid gap-4">
            <h3 className="font-medium text-foreground text-sm">
              What we are designing for
            </h3>
            <dl className="grid gap-4">
              {aboutItems.map((item) => (
                <div className="grid gap-1.5" key={item.label}>
                  <dt className="font-medium text-foreground text-sm">
                    {item.label}
                  </dt>
                  <dd className="text-muted-foreground text-sm leading-6">
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
