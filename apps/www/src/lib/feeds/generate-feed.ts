import { blog } from "@vendor/cms";
import { Feed } from "feed";

export async function generateBlogFeed(): Promise<Feed> {
  const baseUrl = "https://lightfast.ai";
  const buildDate = new Date();

  // Create feed instance
  const feed = new Feed({
    title: "Lightfast Blog",
    description:
      "Insights on AI-powered memory layer for software teams, semantic search, and organizational knowledge management",
    id: baseUrl,
    link: baseUrl,
    language: "en",
    image: `${baseUrl}/android-chrome-512x512.png`,
    favicon: `${baseUrl}/favicon.ico`,
    copyright: `All rights reserved ${buildDate.getFullYear()}, Lightfast`,
    updated: buildDate,
    generator: "Lightfast Blog Generator",
    feedLinks: {
      rss: `${baseUrl}/blog/rss.xml`,
      atom: `${baseUrl}/blog/atom.xml`,
    },
    author: {
      name: "Lightfast",
      email: "hello@lightfast.ai",
      link: baseUrl,
    },
  });

  try {
    const posts = await blog.getPosts();

    // Add posts to the feed
    posts
      .filter((post) => post.publishedAt) // Only published posts
      .sort((a, b) => {
        const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return dateB - dateA; // Most recent first
      })
      .slice(0, 50) // Limit to 50 most recent posts
      .forEach((post) => {
        const url = `${baseUrl}/blog/${post.slug || post._slug}`;
        const date = post.publishedAt ? new Date(post.publishedAt) : buildDate;

        feed.addItem({
          title: post._title ?? "Untitled",
          id: url,
          link: url,
          description: post.description ?? "Read more on the Lightfast blog",
          date: date,
          category: (post.categories ?? []).map((cat) => ({
            name: cat._title ?? "Uncategorized",
          })),
          author: (post.authors ?? []).map((author) => ({
            name: author._title ?? "Lightfast Team",
            link: author.xUrl ?? undefined,
          })),
          image: post.featuredImage?.url ?? undefined,
        });
      });
  } catch {
    // Return empty feed when CMS is unavailable
  }

  return feed;
}