export type LightfastUrl<P extends string = string> =
  `https://lightfast.ai/${P}`;

export type BlogPostUrl = LightfastUrl<`blog/${string}` | `v2/blog/${string}`>;
export type ChangelogUrl = LightfastUrl<`changelog/${string}`>;
export type LegalUrl = LightfastUrl<`legal/${string}`>;
