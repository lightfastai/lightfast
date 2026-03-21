import { basehub as basehubClient, fragmentOn } from "basehub";
import type { RichTextNode, RichTextTocNode } from "basehub/api-transaction";
// biome-ignore lint/correctness/noUnusedImports: ensures types are passed through to apps that use this package
import type * as _types from "./basehub-types.d.ts";
import { basehubEnv } from "./env";
import "./basehub.config";

const { BASEHUB_TOKEN } = basehubEnv;

const basehub = basehubClient({ token: BASEHUB_TOKEN });

/* -------------------------------------------------------------------------------------------------
 * Common Fragments
 * -----------------------------------------------------------------------------------------------*/

const imageFragment = fragmentOn("BlockImage", {
  url: true,
  width: true,
  height: true,
  alt: true,
  blurDataURL: true,
});

/* -------------------------------------------------------------------------------------------------
 * Blog Categories Fragments & Queries
 * -----------------------------------------------------------------------------------------------*/

const categoryFragment = fragmentOn("CategoriesItem", {
  _slug: true,
  _title: true,
  description: {
    plainText: true,
  },
});

export const categories = {
  query: fragmentOn("Query", {
    blog: {
      categories: {
        items: categoryFragment,
      },
    },
  }),

  getCategories: async () => {
    try {
      const data = await basehub.query(categories.query);
      return data.blog.categories.items;
    } catch {
      return [];
    }
  },
};

export type Category = Awaited<
  ReturnType<(typeof categories)["getCategories"]>
>[number];

/* -------------------------------------------------------------------------------------------------
 * Blog Fragments & Queries
 * -----------------------------------------------------------------------------------------------*/

const postMetaFragment = fragmentOn("PostItem_1", {
  _slug: true,
  _title: true,
  slug: true,
  _sys: {
    lastModifiedAt: true,
  },
  authors: {
    _title: true,
    avatar: imageFragment,
    xUrl: true,
  },
  categories: {
    _title: true,
  },
  publishedAt: true,
  description: true,
  featuredImage: imageFragment,
});

const postFragment = fragmentOn("PostItem_1", {
  ...postMetaFragment,
  tldr: true,
  body: {
    plainText: true,
    json: {
      content: true,
      toc: true,
    },
    readingTime: true,
  },
  seo: {
    metaTitle: true,
    metaDescription: true,
    focusKeyword: true,
    secondaryKeywords: true,
    canonicalUrl: true,
    noIndex: true,
    faq: {
      items: {
        question: true,
        answer: true,
      },
    },
  },
});

export const blog = {
  postsQuery: fragmentOn("Query", {
    blog: {
      post: {
        items: postMetaFragment,
      },
    },
  }),

  latestPostQuery: fragmentOn("Query", {
    blog: {
      post: {
        __args: {
          orderBy: "_sys_createdAt__DESC",
        },
        item: postFragment,
      },
    },
  }),

  postQuery: (slug: string) =>
    fragmentOn("Query", {
      blog: {
        post: {
          __args: {
            filter: {
              slug: { eq: slug },
            },
          },
          item: postFragment,
        },
      },
    }),

  getPosts: async () => {
    try {
      const data = await basehub.query(blog.postsQuery);
      return data.blog.post.items;
    } catch {
      return [];
    }
  },

  getLatestPost: async () => {
    try {
      const data = await basehub.query(blog.latestPostQuery);
      return data.blog.post.item;
    } catch {
      return null;
    }
  },

  getPost: async (slug: string) => {
    try {
      const query = blog.postQuery(slug);
      const data = await basehub.query(query);
      return data.blog.post.item;
    } catch {
      return null;
    }
  },
};

// Blog types — derived from fragment-backed query return types
export type PostMeta = Awaited<ReturnType<(typeof blog)["getPosts"]>>[number];
export type Post = NonNullable<Awaited<ReturnType<(typeof blog)["getPost"]>>>;

// Blog Feed response wrapper — exported for use in blog/[slug]/page.tsx Feed callback
// (replaces the local BlogPostQueryResponse defined in that file)
export interface BlogPostQueryResponse {
  blog: { post: { item: Post | null } };
}

/* -------------------------------------------------------------------------------------------------
 * Legal Fragments & Queries
 * -----------------------------------------------------------------------------------------------*/

const legalPostMetaFragment = fragmentOn("TemplateLegalComponent", {
  _slug: true,
  _title: true,
  description: true,
  _sys: {
    createdAt: true,
    lastModifiedAt: true,
  },
});

const legalPostFragment = fragmentOn("TemplateLegalComponent", {
  ...legalPostMetaFragment,
  body: {
    plainText: true,
    json: {
      content: true,
      toc: true,
    },
    readingTime: true,
  },
});

export interface LegalPostMeta {
  _slug?: string | null;
  _sys?: {
    createdAt?: string | null;
    lastModifiedAt?: string | null;
  } | null;
  _title?: string | null;
  description?: string | null;
}

export type LegalPost = LegalPostMeta & {
  body?: {
    plainText?: string | null;
    json?: { content?: RichTextNode[]; toc?: RichTextTocNode[] } | null;
    readingTime?: number | null;
  } | null;
};

export interface LegalPostQueryResponse {
  legalPages?: {
    item?: LegalPost | null;
  } | null;
}

export const legal = {
  postsQuery: fragmentOn("Query", {
    legalPages: {
      __args: {
        orderBy: "_sys_createdAt__DESC",
      },
      items: legalPostFragment,
    },
  }),

  latestPostQuery: fragmentOn("Query", {
    legalPages: {
      __args: {
        orderBy: "_sys_createdAt__DESC",
      },
      item: legalPostFragment,
    },
  }),

  postQuery: (slug: string) =>
    fragmentOn("Query", {
      legalPages: {
        __args: {
          filter: {
            _sys_slug: { eq: slug },
          },
        },
        item: legalPostFragment,
      },
    }),

  getPosts: async (): Promise<LegalPost[]> => {
    try {
      const data = await basehub.query(legal.postsQuery);
      return data.legalPages.items;
    } catch {
      return [];
    }
  },

  getLatestPost: async (): Promise<LegalPost | null> => {
    try {
      const data = await basehub.query(legal.latestPostQuery);
      return data.legalPages.item;
    } catch {
      return null;
    }
  },

  getPost: async (slug: string): Promise<LegalPost | null> => {
    try {
      const query = legal.postQuery(slug);
      const data = await basehub.query(query);
      return data.legalPages.item;
    } catch {
      return null;
    }
  },
};

/* -------------------------------------------------------------------------------------------------
 * Changelog Fragments & Queries
 * -----------------------------------------------------------------------------------------------*/

const changelogEntryMetaFragment = fragmentOn("PostItem", {
  _slug: true,
  _title: true,
  slug: true,
  prefix: true,
  _sys: {
    createdAt: true,
    lastModifiedAt: true,
  },
});

const changelogEntryFragment = fragmentOn("PostItem", {
  ...changelogEntryMetaFragment,
  body: {
    plainText: true,
    json: {
      content: true,
      toc: true,
    },
    readingTime: true,
  },
  improvements: true,
  infrastructure: true,
  fixes: true,
  patches: true,
  // AEO fields
  featuredImage: imageFragment,
  publishedAt: true,
  excerpt: true,
  tldr: true,
  seo: {
    metaTitle: true,
    metaDescription: true,
    focusKeyword: true,
    secondaryKeyword: true,
    canonicalUrl: true,
    noIndex: true,
    faq: {
      items: {
        question: true,
        answer: true,
      },
    },
  },
});

export const changelog = {
  entriesQuery: fragmentOn("Query", {
    changelog: {
      post: {
        __args: {
          orderBy: "publishedAt__DESC",
        },
        items: changelogEntryFragment,
      },
    },
  }),

  entriesMetaQuery: fragmentOn("Query", {
    changelog: {
      post: {
        __args: {
          orderBy: "publishedAt__DESC",
        },
        items: changelogEntryMetaFragment,
      },
    },
  }),

  latestEntryQuery: fragmentOn("Query", {
    changelog: {
      post: {
        __args: {
          orderBy: "publishedAt__DESC",
        },
        item: changelogEntryFragment,
      },
    },
  }),

  entryQuery: (slug: string) =>
    fragmentOn("Query", {
      changelog: {
        post: {
          __args: {
            filter: {
              _sys_slug: { eq: slug },
            },
          },
          item: changelogEntryFragment,
        },
      },
    }),

  entryBySlugQuery: (slug: string) =>
    fragmentOn("Query", {
      changelog: {
        post: {
          __args: {
            filter: {
              slug: { eq: slug },
            },
          },
          item: changelogEntryFragment,
        },
      },
    }),

  getEntries: async () => {
    try {
      const data = await basehub.query(changelog.entriesQuery);
      return data.changelog.post.items;
    } catch {
      return [];
    }
  },

  getLatestEntry: async () => {
    try {
      const data = await basehub.query(changelog.latestEntryQuery);
      return data.changelog.post.item;
    } catch {
      return null;
    }
  },

  getEntry: async (slug: string) => {
    try {
      const query = changelog.entryQuery(slug);
      const data = await basehub.query(query);
      return data.changelog.post.item;
    } catch {
      return null;
    }
  },

  getEntryBySlug: async (slug: string) => {
    try {
      const query = changelog.entryBySlugQuery(slug);
      const data = await basehub.query(query);
      return data.changelog.post.item;
    } catch {
      return null;
    }
  },

  getAdjacentEntries: async (currentSlug: string) => {
    try {
      const data = await basehub.query(changelog.entriesMetaQuery);
      const entries = data.changelog.post.items;

      const currentIndex = entries.findIndex(
        (entry) => entry.slug === currentSlug
      );

      if (currentIndex === -1) {
        return { previous: null, next: null };
      }

      // Entries are ordered newest first (DESC), so:
      // - previous (older) = index + 1
      // - next (newer) = index - 1
      return {
        previous: entries[currentIndex + 1] ?? null,
        next: entries[currentIndex - 1] ?? null,
      };
    } catch {
      return { previous: null, next: null };
    }
  },
};

// Changelog types — derived from fragment-backed query return types
// ChangelogAdjacentEntries must be declared before ChangelogEntryMeta
// since ChangelogEntryMeta is derived from it
export type ChangelogAdjacentEntries = Awaited<
  ReturnType<(typeof changelog)["getAdjacentEntries"]>
>;
export type ChangelogEntryMeta = NonNullable<ChangelogAdjacentEntries["next"]>;
export type ChangelogEntry = Awaited<
  ReturnType<(typeof changelog)["getEntries"]>
>[number];

// Changelog Feed response wrappers — tightened to match actual query results
// (non-optional top-level since Feed only calls these on success)
export interface ChangelogEntryQueryResponse {
  changelog: { post: { item: ChangelogEntry | null } };
}
export interface ChangelogEntriesQueryResponse {
  changelog: { post: { items: ChangelogEntry[] } };
}
