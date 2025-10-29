import { basehub as basehubClient, fragmentOn } from "basehub";
// ensures types are passed through to apps that use this package
import type * as _types from "./basehub-types.d.ts";
import { basehubEnv } from "./env";
import "./basehub.config";

const { BASEHUB_TOKEN } = basehubEnv;

const basehub = basehubClient({ token: BASEHUB_TOKEN });

/* -------------------------------------------------------------------------------------------------
 * Common Fragments
 * -----------------------------------------------------------------------------------------------*/

// Loosen fragment typings to decouple from generated schema types during app type-checks
const fragmentOnLoose: any = fragmentOn as any;

const imageFragment = fragmentOnLoose("BlockImage", {
  url: true,
  width: true,
  height: true,
  alt: true,
  blurDataURL: true,
});

/* -------------------------------------------------------------------------------------------------
 * Blog Fragments & Queries
 * -----------------------------------------------------------------------------------------------*/

const postMetaFragment = fragmentOnLoose("PostsItem", {
  _slug: true,
  _title: true,
  authors: {
    _title: true,
    avatar: imageFragment,
    xUrl: true,
  },
  categories: {
    _title: true,
  },
  date: true,
  description: true,
  image: imageFragment,
});

const postFragment = fragmentOnLoose("PostsItem", {
  ...postMetaFragment,
  body: {
    plainText: true,
    json: {
      content: true,
      toc: true,
    },
    readingTime: true,
  },
});

// Relaxed runtime-facing types to avoid tight coupling to BaseHub's d.ts during app typecheck
export type PostMeta = {
  _slug?: string | null;
  _title?: string | null;
  authors?: Array<{
    _title?: string | null;
    avatar?: {
      url?: string | null;
      width?: number | null;
      height?: number | null;
      alt?: string | null;
      blurDataURL?: string | null;
    } | null;
    xUrl?: string | null;
  }>;
  categories?: Array<{ _title?: string | null }>;
  date?: string | null;
  description?: string | null;
  image?: {
    url?: string | null;
    width?: number | null;
    height?: number | null;
    alt?: string | null;
    blurDataURL?: string | null;
  } | null;
};

export type Post = PostMeta & {
  body?: {
    plainText?: string | null;
    json?: { content?: any[]; toc?: any } | null;
    readingTime?: number | null;
  } | null;
};

const mapLegalMetaToBlogMeta = (item: LegalPostMeta): PostMeta => {
  return {
    _slug: item._slug,
    _title: item._title,
    authors: [],
    categories: [],
    date: (item as any)._sys?.createdAt ?? undefined,
    description: item.description ?? undefined,
    image: undefined as any,
  } as unknown as PostMeta;
};

const mapLegalToBlogPost = (item: LegalPost): Post => {
  return {
    ...(mapLegalMetaToBlogMeta(item) as any),
    body: item.body
      ? {
          plainText: item.body.plainText ?? "",
          json: {
            content: item.body.json?.content ?? null,
            toc: item.body.json?.toc ?? null,
          },
          readingTime: item.body.readingTime ?? null,
        }
      : (undefined as any),
  } as unknown as Post;
};

export const blog = {
  postsQuery: fragmentOnLoose("Query", {
    blog: {
      posts: {
        items: postMetaFragment,
      },
    },
  }),

  latestPostQuery: fragmentOnLoose("Query", {
    blog: {
      posts: {
        __args: {
          orderBy: "_sys_createdAt__DESC",
        },
        item: postFragment,
      },
    },
  }),

  postQuery: (slug: string) => ({
    blog: {
      posts: {
        __args: {
          filter: {
            _sys_slug: { eq: slug },
          },
        },
        item: postFragment,
      },
    },
  }),

  getPosts: async (): Promise<PostMeta[]> => {
    try {
      const data: any = await basehub.query(blog.postsQuery as any);
      return data.blog.posts.items as PostMeta[];
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
      const data: any = await basehub.query(blog.latestPostQuery as any);
      return data.blog.posts.item as Post;
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
      const data: any = await basehub.query(query as any);
      return data.blog.posts.item as Post;
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

const legalPostMetaFragment = fragmentOnLoose("LegalPagesItem", {
  _slug: true,
  _title: true,
  description: true,
  _sys: {
    createdAt: true,
  },
});

const legalPostFragment = fragmentOnLoose("LegalPagesItem", {
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

export type LegalPostMeta = {
  _slug?: string | null;
  _title?: string | null;
  description?: string | null;
  _sys?: { createdAt?: string | null } | null;
};
export type LegalPost = LegalPostMeta & {
  body?: {
    plainText?: string | null;
    json?: { content?: any[]; toc?: any } | null;
    readingTime?: number | null;
  } | null;
};

export const legal = {
  postsQuery: fragmentOnLoose("Query", {
    legalPages: {
      __args: {
        orderBy: "_sys_createdAt__DESC",
      },
      items: legalPostFragment,
    },
  }),

  latestPostQuery: fragmentOnLoose("Query", {
    legalPages: {
      __args: {
        orderBy: "_sys_createdAt__DESC",
      },
      item: legalPostFragment,
    },
  }),

  postQuery: (slug: string) =>
    fragmentOnLoose("Query", {
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
    const data: any = await basehub.query(legal.postsQuery as any);

    return data.legalPages.items as LegalPost[];
  },

  getLatestPost: async (): Promise<LegalPost | null> => {
    const data: any = await basehub.query(legal.latestPostQuery as any);

    return data.legalPages.item as LegalPost;
  },

  getPost: async (slug: string): Promise<LegalPost | null> => {
    const query = legal.postQuery(slug);
    const data: any = await basehub.query(query as any);

    return data.legalPages.item as LegalPost;
  },
};
