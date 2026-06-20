export type LightfastUrl<P extends string = string> =
  `https://lightfast.ai/${P}`;

export type BlogPostUrl = LightfastUrl<`blog/${string}`>;
export type LegalUrl = LightfastUrl<`legal/${string}`>;
