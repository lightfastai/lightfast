import type { Metadata, Route } from "next";
import Link from "next/link";
import { getBlogPages } from "~/app/(v1)/(content)/_lib/source";
import { createMetadata } from "~/lib/content-seo";

export const dynamic = "force-static";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

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
  const blogPosts = getBlogPages()
    .map((page) => ({
      date: dateFormatter.format(new Date(page.data.publishedAt)),
      datetime: page.data.publishedAt,
      href: `/v2/blog/${page.slugs.join("/")}` as Route,
      title: page.data.title,
    }))
    .sort(
      (a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime()
    );

  return (
    <main className="bg-background text-foreground">
      <section className="px-6 pt-32 pb-20 sm:px-10 sm:pt-32 md:pb-16">
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
          {blogPosts.map((post) => (
            <li key={post.href} className="border-border border-b">
              <Link
                className="group/blog grid gap-5 bg-transparent py-4 outline-none transition-[background-color,color] duration-[650ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-primary hover:text-primary-foreground hover:duration-300 focus-visible:bg-primary focus-visible:text-primary-foreground focus-visible:duration-300 sm:grid-cols-[minmax(10rem,0.34fr)_minmax(0,1fr)] sm:py-6"
                href={post.href}
              >
                <time
                  className="self-center translate-x-0 text-muted-foreground text-sm leading-6 transition-[color,transform,translate,scale,rotate] duration-[650ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/blog:translate-x-2 group-hover/blog:text-primary-foreground group-focus-visible/blog:translate-x-2 group-focus-visible/blog:text-primary-foreground sm:text-base"
                  dateTime={post.datetime}
                >
                  {post.date}
                </time>
                <span className="pr-4 sm:pr-10">
                  <span className="inline-block translate-x-0 font-medium text-xl leading-tight tracking-normal transition-transform duration-[650ms] ease-[cubic-bezier(0.16,1,0.35,1)] group-hover/blog:translate-x-2 group-focus-visible/blog:translate-x-2 sm:text-2xl lg:text-3xl">
                    {post.title}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
