import type { Metadata } from "next";
import { createMetadata } from "~/lib/content-seo";

export const dynamic = "force-static";

interface MockBlogPost {
  date: string;
  datetime: string;
  href: string;
  title: string;
}

const mockBlogPosts: MockBlogPost[] = [
  {
    date: "June 18, 2026",
    datetime: "2026-06-18",
    href: "/v2/blog/workspace-memory-for-agent-teams",
    title: "Workspace memory for agent teams",
  },
  {
    date: "June 10, 2026",
    datetime: "2026-06-10",
    href: "/v2/blog/orchestrating-human-agent-handoffs",
    title: "Orchestrating human-agent handoffs",
  },
  {
    date: "May 28, 2026",
    datetime: "2026-05-28",
    href: "/v2/blog/durable-history-for-operational-ai",
    title: "Durable history for operational AI",
  },
  {
    date: "May 14, 2026",
    datetime: "2026-05-14",
    href: "/v2/blog/designing-readable-agent-runs",
    title: "Designing readable agent runs",
  },
  {
    date: "April 30, 2026",
    datetime: "2026-04-30",
    href: "/v2/blog/interfaces-for-trustworthy-automation",
    title: "Interfaces for trustworthy automation",
  },
  {
    date: "April 16, 2026",
    datetime: "2026-04-16",
    href: "/v2/blog/the-agent-operating-layer",
    title: "The agent operating layer",
  },
];

export const metadata: Metadata = createMetadata({
  title: "Blog | Lightfast",
  description:
    "Notes from Lightfast on agent infrastructure, workspace memory, and building reliable AI operations.",
  alternates: {
    canonical: "https://lightfast.ai/v2/blog",
  },
  openGraph: {
    title: "Blog | Lightfast",
    description:
      "Notes from Lightfast on agent infrastructure, workspace memory, and building reliable AI operations.",
    type: "website",
    url: "https://lightfast.ai/v2/blog",
    siteName: "Lightfast",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog | Lightfast",
    description:
      "Notes from Lightfast on agent infrastructure, workspace memory, and building reliable AI operations.",
    site: "@lightfastai",
    creator: "@lightfastai",
  },
});

export default function BlogPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="px-6 pt-32 pb-20 sm:px-10 sm:pt-36 md:pb-24">
        <div className="mx-auto max-w-[1960px]">
          <h1 className="font-medium font-title text-3xl tracking-normal sm:text-4xl">
            Blog
          </h1>
        </div>
      </section>

      <section aria-labelledby="blog-posts-heading" className="px-6 sm:px-10">
        <h2 className="sr-only" id="blog-posts-heading">
          Latest blog posts
        </h2>
        <ol className="mx-auto max-w-[1960px] border-border border-t">
          {mockBlogPosts.map((post) => (
            <li key={post.href} className="border-border border-b">
              <a
                className="group/blog grid gap-5 bg-transparent py-7 outline-none transition-[background-color,color] duration-[650ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-primary hover:text-primary-foreground hover:duration-300 focus-visible:bg-primary focus-visible:text-primary-foreground focus-visible:duration-300 sm:grid-cols-[minmax(10rem,0.34fr)_minmax(0,1fr)] sm:py-8"
                href={post.href}
              >
                <time
                  className="self-center pl-4 text-muted-foreground text-sm leading-6 transition-colors duration-[650ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/blog:text-primary-foreground group-focus-visible/blog:text-primary-foreground sm:pl-6 sm:text-base"
                  dateTime={post.datetime}
                >
                  {post.date}
                </time>
                <span className="pr-4 sm:pr-10">
                  <span className="inline-block translate-x-0 font-medium text-xl leading-tight tracking-normal transition-transform duration-[650ms] ease-[cubic-bezier(0.16,1,0.35,1)] group-hover/blog:translate-x-2 group-focus-visible/blog:translate-x-2 sm:text-2xl lg:text-3xl">
                    {post.title}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
