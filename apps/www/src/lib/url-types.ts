export type LightfastUrl<P extends string = string> =
  `https://lightfast.ai/${P}`;

export type BlogPostUrl = LightfastUrl<`blog/${string}`>;
export type ChangelogUrl = LightfastUrl<`changelog/${string}`>;
export type LegalUrl = LightfastUrl<`legal/${string}`>;
export type DocsUrl = LightfastUrl<`docs/${string}`>;
export type ApiRefUrl = LightfastUrl<`docs/api-reference/${string}`>;
export type IntegrationUrl = LightfastUrl<`integrations/${string}`>;
