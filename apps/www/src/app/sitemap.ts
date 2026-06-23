import type { MetadataRoute } from "next";
import {
  getBlogPages,
  getBrandPage,
  getHomePage,
  getLegalPages,
} from "~/lib/content/source";

const BASE_URL = "https://lightfast.ai";

export default function sitemap(): MetadataRoute.Sitemap {
  const blogPages = getBlogPages()
    .filter((page) => !page.data.noindex)
    .sort(
      (a, b) =>
        new Date(b.data.publishedAt).getTime() -
        new Date(a.data.publishedAt).getTime()
    );
  const brandPage = getBrandPage();
  const homePage = getHomePage();
  const legalPages = getLegalPages();
  const mostRecentBlog = blogPages.at(0);

  return [
    {
      url: `${BASE_URL}`,
      ...(homePage
        ? {
            lastModified: new Date(
              homePage.data.reviewedAt ?? homePage.data.updatedAt
            ),
          }
        : {}),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...(brandPage && !brandPage.data.noindex
      ? [
          {
            url: brandPage.data.canonicalUrl ?? `${BASE_URL}/brand`,
            lastModified: new Date(
              brandPage.data.reviewedAt ?? brandPage.data.updatedAt
            ),
            changeFrequency: "monthly" as const,
            priority: 0.7,
          },
        ]
      : []),
    {
      url: `${BASE_URL}/blog`,
      ...(mostRecentBlog
        ? {
            lastModified: new Date(
              mostRecentBlog.data.reviewedAt ??
                mostRecentBlog.data.updatedAt ??
                mostRecentBlog.data.publishedAt
            ),
          }
        : {}),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...blogPages.map((page) => ({
      url: page.data.canonicalUrl ?? `${BASE_URL}/blog/${page.slugs.join("/")}`,
      lastModified: new Date(
        page.data.reviewedAt ?? page.data.updatedAt ?? page.data.publishedAt
      ),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...legalPages
      .filter((page) => !page.data.noindex)
      .map((page) => ({
        url:
          page.data.canonicalUrl ?? `${BASE_URL}/legal/${page.slugs.join("/")}`,
        lastModified: new Date(page.data.reviewedAt ?? page.data.updatedAt),
        changeFrequency: "monthly" as const,
        priority: 0.4,
      })),
  ];
}
