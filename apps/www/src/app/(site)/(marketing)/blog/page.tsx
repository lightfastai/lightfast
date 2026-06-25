import { JsonLd } from "@vendor/seo/json-ld";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { getBlogIndexPublication } from "~/lib/publishing";
import { marketingLayout } from "../_components/layout-primitives";

export const dynamic = "force-static";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

export function generateMetadata(): Metadata {
  return getBlogIndexPublication().metadata;
}

export default function BlogPage() {
  const publication = getBlogIndexPublication();
  const blogPosts = publication.posts.map((post) => ({
    date: dateFormatter.format(new Date(post.publishedAt)),
    datetime: post.publishedAt,
    href: post.pathname as Route,
    title: post.title,
  }));

  return (
    <main className="bg-background text-foreground">
      <JsonLd code={publication.jsonLd} />

      <section className={` ${marketingLayout.pageTop}`} />

      <section aria-labelledby="blog-posts-heading">
        <h2 className="sr-only" id="blog-posts-heading">
          Latest blog posts
        </h2>
        <ol className="border-border border-t">
          {blogPosts.map((post) => (
            <li className="border-border border-b" key={post.href}>
              <Link
                className="group/blog grid gap-5 bg-transparent py-4 outline-none transition-colors duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-primary hover:text-primary-foreground hover:duration-300 focus-visible:bg-primary focus-visible:text-primary-foreground focus-visible:duration-300 sm:grid-cols-3 sm:py-6"
                href={post.href}
              >
                <time
                  className="translate-x-0 self-center text-muted-foreground text-xs leading-6 transition duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/blog:translate-x-2 group-hover/blog:text-primary-foreground group-focus-visible/blog:translate-x-2 group-focus-visible/blog:text-primary-foreground sm:col-span-1 sm:text-sm"
                  dateTime={post.datetime}
                >
                  {post.date}
                </time>
                <span className="pr-4 sm:col-span-2 sm:pr-10">
                  <span className="inline-block translate-x-0 font-medium text-lg leading-tight tracking-normal transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.35,1)] group-hover/blog:translate-x-2 group-focus-visible/blog:translate-x-2 sm:text-xl lg:text-lg">
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
