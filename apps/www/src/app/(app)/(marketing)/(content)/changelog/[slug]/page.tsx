import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { changelog, type ChangelogEntryQueryResponse } from "@vendor/cms";
import { Body } from "@vendor/cms/components/body";
import { Feed } from "@vendor/cms/components/feed";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";

type ChangelogPageProps = {
  params: Promise<{ slug: string }>;
};

export const revalidate = 300;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const entries = await changelog.getEntries().catch(() => []);
  return entries
    .filter((entry) => !!entry.slug)
    .map((entry) => ({ slug: entry.slug as string }));
}

export async function generateMetadata({
  params,
}: ChangelogPageProps): Promise<Metadata> {
  const { slug } = await params;
  const entry = await changelog.getEntryBySlug(slug);

  if (!entry) return {};

  const description = entry.body?.plainText
    ? entry.body.plainText.slice(0, 160)
    : `${entry._title} - Lightfast changelog update`;

  return {
    title: entry._title ?? undefined,
    description: description ?? undefined,
    openGraph: {
      title: entry._title ?? "Changelog",
      description,
      type: "article",
      publishedTime: entry._sys?.createdAt ?? undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: entry._title ?? "Changelog",
      description,
    },
  } satisfies Metadata;
}

// Helper to parse bullet points from markdown text
function parseBulletPoints(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("-") || line.startsWith("•"))
    .map((line) => line.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);
}

export default async function ChangelogEntryPage({
  params,
}: ChangelogPageProps) {
  const { slug } = await params;

  return (
    <Feed queries={[changelog.entryBySlugQuery(slug)]}>
      {async ([data]) => {
        "use server";

        const response = data as ChangelogEntryQueryResponse;
        const entry = response.changelogPages?.item;
        if (!entry) notFound();

        const created = entry._sys?.createdAt
          ? new Date(entry._sys.createdAt)
          : null;
        const dateStr = created
          ? created.toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "";

        const sections = [
          {
            key: "improvements",
            title: "Improvements",
            content: entry.improvements,
          },
          {
            key: "infrastructure",
            title: "Infrastructure",
            content: entry.infrastructure,
          },
          { key: "fixes", title: "Fixes", content: entry.fixes },
          { key: "patches", title: "Patches", content: entry.patches },
        ].filter((section) => section.content);

        return (
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              <div className="md:col-span-2 flex items-center gap-2">
                {entry.slug && (
                  <span className="inline-block border rounded-full px-3 py-1 text-xs text-muted-foreground w-fit">
                    {entry.slug}
                  </span>
                )}
                <time className="text-sm text-muted-foreground whitespace-nowrap">
                  {dateStr}
                </time>
              </div>

              <article className="md:col-span-8 md:col-start-3 lg:col-span-6 lg:col-start-4 space-y-8">
                <div>
                  <h1 className="text-3xl text-foreground font-semibold tracking-tight">
                    {entry._title}
                  </h1>
                  {entry.body?.json?.content ? (
                    <div className="prose max-w-none mt-6 prose-headings:text-foreground prose-p:text-foreground/80 prose-strong:text-foreground prose-a:text-foreground hover:prose-a:text-foreground/80 prose-ul:text-foreground/80 prose-li:text-foreground/80">
                      <Body content={entry.body.json.content} />
                    </div>
                  ) : null}
                </div>

                {sections.length > 0 && (
                  <div className="space-y-4">
                    {sections.map((section) => {
                      const items = parseBulletPoints(section.content);
                      const count = items.length;

                      return (
                        <div
                          key={section.key}
                          className="border rounded-sm overflow-hidden"
                        >
                          <Accordion type="multiple" className="w-full">
                            <AccordionItem value={section.key} className="border-none">
                              <AccordionTrigger className="text-base font-semibold px-4 py-3">
                                {section.title} ({count})
                              </AccordionTrigger>
                              <AccordionContent className="px-4">
                                <ul className="space-y-2 text-foreground/80">
                                  {items.map((item, idx) => (
                                    <li key={idx} className="leading-relaxed">
                                      • {item}
                                    </li>
                                  ))}
                                </ul>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </div>
                      );
                    })}
                  </div>
                )}

                {entry.body?.readingTime ? (
                  <div className="text-xs text-muted-foreground">
                    {entry.body.readingTime} min read
                  </div>
                ) : null}
              </article>
            </div>
          </div>
        );
      }}
    </Feed>
  );
}
