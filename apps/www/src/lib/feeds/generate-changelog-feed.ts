import { changelog } from "@vendor/cms";
import { Feed } from "feed";

/**
 * Generate RSS/Atom feed for changelog entries.
 * Mirrors the blog feed pattern from generate-feed.ts
 */
export async function generateChangelogFeed(): Promise<Feed> {
  const baseUrl = "https://lightfast.ai";
  const buildDate = new Date();

  const feed = new Feed({
    title: "Lightfast Changelog",
    description:
      "Product updates, new features, and improvements from Lightfast - the AI memory layer for engineering teams",
    id: `${baseUrl}/changelog`,
    link: `${baseUrl}/changelog`,
    language: "en",
    image: `${baseUrl}/android-chrome-512x512.png`,
    favicon: `${baseUrl}/favicon.ico`,
    copyright: `All rights reserved ${buildDate.getFullYear()}, Lightfast`,
    updated: buildDate,
    generator: "Lightfast Changelog Generator",
    feedLinks: {
      rss: `${baseUrl}/changelog/rss.xml`,
      atom: `${baseUrl}/changelog/atom.xml`,
    },
    author: {
      name: "Lightfast",
      email: "hello@lightfast.ai",
      link: baseUrl,
    },
  });

  try {
    const entries = await changelog.getEntries();

    // Add entries to feed (newest first, limit 50)
    entries.slice(0, 50).forEach((entry) => {
      const url = `${baseUrl}/changelog/${entry.slug ?? entry._slug}`;

      // Use publishedAt if available, fall back to createdAt
      const publishedDate = entry.publishedAt
        ? new Date(entry.publishedAt)
        : entry._sys?.createdAt
          ? new Date(entry._sys.createdAt)
          : buildDate;

      // Use AEO fields for enhanced descriptions
      const description =
        entry.excerpt ??
        entry.tldr ??
        entry.body?.plainText?.slice(0, 300) ??
        "View the latest updates from Lightfast";

      feed.addItem({
        title: entry._title ?? "Untitled",
        id: url,
        link: url,
        description,
        date: publishedDate,
        ...(entry.featuredImage?.url
          ? { image: entry.featuredImage.url }
          : {}),
      });
    });
  } catch {
    // Return empty feed when CMS is unavailable
  }

  return feed;
}
