import type { Thing, WithContext } from "schema-dts";

// Type for JSON-LD Graph structure.
// @context is intentionally `string` (not the literal "https://schema.org") to
// stay spec-compliant — JSON-LD allows any URI, inline objects, or arrays.
// Use WithContext<Thing> when a strict "https://schema.org" literal is needed.
interface GraphContext {
  "@context":
    | string
    | Record<string, unknown>
    | (string | Record<string, unknown>)[];
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
    type="application/ld+json"
  />
);

// Export types for use in components
export type { GraphContext, JsonLdData };

// Re-export commonly used schema types for convenience
export type {
  Answer,
  // Content types
  Article,
  Blog,
  BlogPosting,
  BreadcrumbList,
  // Event types
  Event,
  FAQPage,
  HowTo,
  HowToStep,
  // Media types
  ImageObject,
  Offer,
  // Organization types
  Organization,
  // Person types
  Person,
  Product,
  Question,
  Service,
  // Product/Service types
  SoftwareApplication,
  TechArticle,
  // Core types
  Thing,
  VideoObject,
  WebPage,
  // Website types
  WebSite,
  WithContext,
} from "schema-dts";
