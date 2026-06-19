export type LightfastUrl<P extends string = string> =
  `https://lightfast.ai/${P}`;

export type BlogPostUrl = LightfastUrl<`blog/${string}` | `v2/blog/${string}`>;
export type LegalUrl = LightfastUrl<`v2/legal/${string}`>;
