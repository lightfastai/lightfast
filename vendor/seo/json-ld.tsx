import type { Thing, WithContext } from "schema-dts";

// Type for JSON-LD Graph structure
interface GraphContext {
  "@context": string | Record<string, unknown> | (string | Record<string, unknown>)[];
  "@graph": Thing[];
}

// Union type supporting both single entities and graph structures
type JsonLdData = WithContext<Thing> | GraphContext;

interface JsonLdProps {
  code: JsonLdData;
}

const escapeJsonForHtml = (json: string): string =>
  json
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

export const JsonLd = ({ code }: JsonLdProps) => (
  <script
    dangerouslySetInnerHTML={{
      __html: escapeJsonForHtml(JSON.stringify(code)),
    }}
    // biome-ignore lint/security/noDangerouslySetInnerHtml: "This is a JSON-LD script with properly escaped content."
    type="application/ld+json"
  />
);

// Export types for use in components
export type { GraphContext, JsonLdData };

// Re-export commonly used schema types for convenience
export type {
  // Core types
  Thing,
  WithContext,

  // Organization types
  Organization,

  // Website types
  WebSite,
  WebPage,

  // Content types
  Article,
  TechArticle,
  BlogPosting,
  Blog,
  FAQPage,
  Question,
  Answer,
  BreadcrumbList,
  HowTo,
  HowToStep,

  // Product/Service types
  SoftwareApplication,
  Product,
  Service,
  Offer,

  // Media types
  ImageObject,
  VideoObject,

  // Person types
  Person,

  // Event types
  Event,
} from "schema-dts";


