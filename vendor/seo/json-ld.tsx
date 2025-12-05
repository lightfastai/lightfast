import type { Thing, WithContext } from "schema-dts";

// Type for JSON-LD Graph structure
type GraphContext = {
  "@context": "https://schema.org" | string | Record<string, unknown> | Array<string | Record<string, unknown>>;
  "@graph": Array<Thing>;
};

// Union type supporting both single entities and graph structures
type JsonLdData = WithContext<Thing> | GraphContext;

type JsonLdProps = {
  code: JsonLdData;
};

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
export * from "schema-dts";

