import { notFound } from "next/navigation";
import { allLegals } from "contentlayer/generated";
import { ChevronRight } from "lucide-react";

import { cn } from "@repo/ui/lib/utils";

import { Mdx } from "~/components/mdx-components";

interface LegalPageProps {
  params: {
    slug: string[];
  };
}

function getLegalFromParams({ params }: LegalPageProps) {
  const slug = params.slug?.join("/") || "";
  const legal = allLegals.find((legal) => legal.slugAsParams === slug);

  if (!legal) {
    return null;
  }

  return legal;
}

export function generateStaticParams(): LegalPageProps["params"][] {
  return allLegals.map((legal) => ({
    slug: legal.slugAsParams.split("/"),
  }));
}

export default function LegalPage({ params }: LegalPageProps) {
  const legal = getLegalFromParams({ params });

  if (!legal) {
    notFound();
  }

  return (
    <main className="relative w-full py-6">
      <div className="w-full min-w-0">
        <div className="mb-4 flex items-center space-x-1 text-sm leading-none text-muted-foreground">
          <div className="truncate">Legal</div>
          <ChevronRight className="h-3.5 w-3.5" />
          <div className="text-foreground">{legal.title}</div>
        </div>
        <div className="space-y-2">
          <h1
            className={cn(
              "scroll-m-20 text-sm font-bold italic tracking-tight text-muted-foreground",
            )}
          >
            Last updated on {legal.lastUpdated}
          </h1>
        </div>
        <div className="pb-12 pt-8">
          <Mdx code={legal.body.code} />
        </div>
      </div>
    </main>
  );
}
