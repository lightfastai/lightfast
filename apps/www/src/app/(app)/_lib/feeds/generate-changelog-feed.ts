import { Feed } from "feed";
import { getChangelogPages } from "~/app/(app)/(content)/_lib/source";

export function generateChangelogFeed(): Feed {
  const baseUrl = "https://lightfast.ai";
  const buildDate = new Date();

  const feed = new Feed({
    title: "Lightfast Changelog",
    description:
      "Product updates, new features, and improvements from Lightfast — surfaces decisions across your tools",
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

  const pages = getChangelogPages();

  const sortedPages = [...pages]
    .sort(
      (a, b) =>
        new Date(b.data.publishedAt).getTime() -
        new Date(a.data.publishedAt).getTime()
    )
    .slice(0, 50);

  for (const page of sortedPages) {
    const url = `${baseUrl}/changelog/${page.slugs[0]}`;
    feed.addItem({
      title: page.data.title,
      id: url,
      link: url,
      description: page.data.description,
      date: new Date(page.data.publishedAt),
      image: `${url}/opengraph-image`,
    });
  }

  return feed;
}
