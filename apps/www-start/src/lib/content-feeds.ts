import { Feed } from "feed";
import { getBlogPages } from "~/lib/blog-content";
import { getChangelogPages } from "~/lib/changelog-content";

const baseUrl = "https://lightfast.ai";

export function generateBlogFeed(): Feed {
  const buildDate = new Date();
  const feed = new Feed({
    title: "Lightfast Blog",
    description:
      "Insights on surfacing decisions across your tools - searchable, cited, and ready for people and agents",
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

  for (const page of getBlogPages().slice(0, 50)) {
    feed.addItem({
      title: page.data.title,
      id: page.url,
      link: page.url,
      description: page.data.description,
      date: new Date(page.data.publishedAt),
      category: [{ name: page.data.category }],
      author: page.data.authors.map((author) => ({
        name: author.name,
        link: author.url,
      })),
      image: `${page.url}/opengraph-image`,
    });
  }

  return feed;
}

export function generateChangelogFeed(): Feed {
  const buildDate = new Date();
  const feed = new Feed({
    title: "Lightfast Changelog",
    description:
      "Product updates, new features, and improvements from Lightfast - surfaces decisions across your tools",
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

  for (const page of getChangelogPages().slice(0, 50)) {
    feed.addItem({
      title: page.data.title,
      id: page.url,
      link: page.url,
      description: page.data.description,
      date: new Date(page.data.publishedAt),
      image: `${page.url}/opengraph-image`,
    });
  }

  return feed;
}
