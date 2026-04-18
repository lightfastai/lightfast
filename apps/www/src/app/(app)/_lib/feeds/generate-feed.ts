import { Feed } from "feed";
import { getBlogPages } from "~/app/(app)/(content)/_lib/source";

export function generateBlogFeed(): Feed {
  const baseUrl = "https://lightfast.ai";
  const buildDate = new Date();

  const feed = new Feed({
    title: "Lightfast Blog",
    description:
      "Insights on surfacing decisions across your tools — searchable, cited, and ready for people and agents",
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

  const pages = getBlogPages();

  const sortedPages = [...pages]
    .sort(
      (a, b) =>
        new Date(b.data.publishedAt).getTime() -
        new Date(a.data.publishedAt).getTime()
    )
    .slice(0, 50);

  for (const page of sortedPages) {
    const url = `${baseUrl}/blog/${page.slugs[0]}`;
    feed.addItem({
      title: page.data.title,
      id: url,
      link: url,
      description: page.data.description,
      date: new Date(page.data.publishedAt),
      category: [{ name: page.data.category }],
      author: page.data.authors.map((a) => ({
        name: a.name,
        link: a.url,
      })),
      image: `${url}/opengraph-image`,
    });
  }

  return feed;
}
