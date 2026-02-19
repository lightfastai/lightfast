import { basehub as basehubClient, fragmentOn } from "basehub";
import type { RichTextNode, RichTextTocNode } from "basehub/api-transaction";
// ensures types are passed through to apps that use this package
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

export interface Category {
  _slug?: string | null;
  _title?: string | null;
  description?: {
    plainText?: string | null;
  } | null;
}

export const categories = {
  query: fragmentOn("Query", {
    blog: {
      categories: {
        items: categoryFragment,
      },
    },
  }),

  getCategories: async (): Promise<Category[]> => {
    try {
      const data = await basehub.query(categories.query);
      return data.blog.categories.items;
    } catch {
      return [];
    }
  },
};

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

// Relaxed runtime-facing types to avoid tight coupling to BaseHub's d.ts during app typecheck
export interface PostMeta {
  _slug?: string | null;
  _title?: string | null;
  slug?: string | null;
  _sys?: {
    lastModifiedAt?: string | null;
  } | null;
  authors?: {
    _title?: string | null;
    avatar?: {
      url?: string | null;
      width?: number | null;
      height?: number | null;
      alt?: string | null;
      blurDataURL?: string | null;
    } | null;
    xUrl?: string | null;
  }[];
  categories?: { _title?: string | null }[];
  publishedAt?: string | null;
  description?: string | null;
  featuredImage?: {
    url?: string | null;
    width?: number | null;
    height?: number | null;
    alt?: string | null;
    blurDataURL?: string | null;
  } | null;
}

export type Post = PostMeta & {
  tldr?: string | null;
  body?: {
    plainText?: string | null;
    json?: { content?: RichTextNode[]; toc?: RichTextTocNode[] } | null;
    readingTime?: number | null;
  } | null;
  seo?: {
    metaTitle?: string | null;
    metaDescription?: string | null;
    focusKeyword?: string | null;
    secondaryKeywords?: string | null;
    canonicalUrl?: string | null;
    noIndex?: boolean | null;
    faq?: {
      items?: {
        question?: string | null;
        answer?: string | null;
      }[];
    } | null;
  } | null;
};

const mapLegalMetaToBlogMeta = (item: LegalPostMeta): PostMeta => ({
  _slug: item._slug,
  _title: item._title,
  _sys: item._sys ? { lastModifiedAt: item._sys.lastModifiedAt } : null,
  authors: [],
  categories: [],
  publishedAt: item._sys?.createdAt,
  description: item.description,
});

const mapLegalToBlogPost = (item: LegalPost): Post => ({
  ...mapLegalMetaToBlogMeta(item),
  body: item.body
    ? {
        plainText: item.body.plainText ?? "",
        json: {
          content: item.body.json?.content ?? undefined,
          toc: item.body.json?.toc ?? undefined,
        },
        readingTime: item.body.readingTime ?? undefined,
      }
    : undefined,
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

  getPosts: async (): Promise<PostMeta[]> => {
    try {
      const data = await basehub.query(blog.postsQuery);
      return data.blog.post.items;
    } catch {
      try {
        const fallback = await legal.getPosts();
        return fallback.map(mapLegalMetaToBlogMeta);
      } catch {
        return [];
      }
    }
  },

  getLatestPost: async (): Promise<Post | null> => {
    try {
      const data = await basehub.query(blog.latestPostQuery);
      return data.blog.post.item;
    } catch {
      try {
        const fallback = await legal.getLatestPost();
        return fallback ? mapLegalToBlogPost(fallback) : null;
      } catch {
        return null;
      }
    }
  },

  getPost: async (slug: string): Promise<Post | null> => {
    try {
      const query = blog.postQuery(slug);
      const data = await basehub.query(query);
      return data.blog.post.item;
    } catch {
      try {
        const fallback = await legal.getPost(slug);
        return fallback ? mapLegalToBlogPost(fallback) : null;
      } catch {
        return null;
      }
    }
  },
};

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
  _title?: string | null;
  description?: string | null;
  _sys?: {
    createdAt?: string | null;
    lastModifiedAt?: string | null;
  } | null;
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

export interface ChangelogEntryMeta {
  _slug?: string | null;
  _title?: string | null;
  slug?: string | null;
  prefix?: string | null;
  _sys?: {
    createdAt?: string | null;
    lastModifiedAt?: string | null;
  } | null;
}

export type ChangelogEntry = ChangelogEntryMeta & {
  body?: {
    plainText?: string | null;
    json?: { content?: RichTextNode[]; toc?: RichTextTocNode[] } | null;
    readingTime?: number | null;
  } | null;
  improvements?: string | null;
  infrastructure?: string | null;
  fixes?: string | null;
  patches?: string | null;
  // AEO fields
  featuredImage?: {
    url?: string | null;
    width?: number | null;
    height?: number | null;
    alt?: string | null;
    blurDataURL?: string | null;
  } | null;
  publishedAt?: string | null;
  excerpt?: string | null;
  tldr?: string | null;
  seo?: {
    metaTitle?: string | null;
    metaDescription?: string | null;
    focusKeyword?: string | null;
    secondaryKeyword?: string | null;
    canonicalUrl?: string | null;
    noIndex?: boolean | null;
    faq?: {
      items?: {
        question?: string | null;
        answer?: string | null;
      }[];
    } | null;
  } | null;
};

export interface ChangelogEntryQueryResponse {
  changelog?: {
    post?: {
      item?: ChangelogEntry | null;
    } | null;
  } | null;
}

export interface ChangelogEntriesQueryResponse {
  changelog?: {
    post?: {
      items?: ChangelogEntry[] | null;
    } | null;
  } | null;
}

export interface ChangelogAdjacentEntries {
  previous?: ChangelogEntryMeta | null;
  next?: ChangelogEntryMeta | null;
}

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

  getEntries: async (): Promise<ChangelogEntry[]> => {
    try {
      const data = await basehub.query(changelog.entriesQuery);
      return data.changelog.post.items;
    } catch {
      return [];
    }
  },

  getLatestEntry: async (): Promise<ChangelogEntry | null> => {
    try {
      const data = await basehub.query(changelog.latestEntryQuery);
      return data.changelog.post.item;
    } catch {
      return null;
    }
  },

  getEntry: async (slug: string): Promise<ChangelogEntry | null> => {
    try {
      const query = changelog.entryQuery(slug);
      const data = await basehub.query(query);
      return data.changelog.post.item;
    } catch {
      return null;
    }
  },

  getEntryBySlug: async (slug: string): Promise<ChangelogEntry | null> => {
    try {
      const query = changelog.entryBySlugQuery(slug);
      const data = await basehub.query(query);
      return data.changelog.post.item;
    } catch {
      return null;
    }
  },

  getAdjacentEntries: async (
    currentSlug: string,
  ): Promise<ChangelogAdjacentEntries> => {
    try {
      const data = await basehub.query(changelog.entriesMetaQuery);
      const entries = data.changelog.post.items;

      const currentIndex = entries.findIndex(
        (entry) => entry.slug === currentSlug,
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
