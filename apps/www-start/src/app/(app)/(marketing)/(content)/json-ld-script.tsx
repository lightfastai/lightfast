import { serializeJsonLd } from "~/lib/json-ld";

export function JsonLdScript({ code }: { code: unknown }) {
  return (
    <script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD is generated from local typed content.
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(code) }}
      type="application/ld+json"
    />
  );
}
