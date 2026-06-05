export function JsonLdScript({ code }: { code: unknown }) {
  return (
    <script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD is generated from local typed content.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(code) }}
      type="application/ld+json"
    />
  );
}
