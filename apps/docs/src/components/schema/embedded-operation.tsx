import { getApiPages } from "@/src/lib/source";
import { InlineAPIPage } from "@/src/lib/inline-api-page";

interface EmbeddedOperationProps {
  /** The operationId from the OpenAPI spec (e.g., "search", "get-contents") */
  operationId: string;
}

/**
 * Renders a fumadocs-openapi operation inline in MDX pages.
 *
 * Uses the same OpenAPI spec and rendering pipeline as the auto-generated
 * API reference pages, but with a minimal layout (no header, no playground).
 *
 * Usage in MDX:
 *   <EmbeddedOperation operationId="search" />
 */
export function EmbeddedOperation({ operationId }: EmbeddedOperationProps) {
  const pages = getApiPages();

  // Find the virtual page matching this operationId
  // Slugs are based on operationId: ["search"], ["get-contents"], etc.
  const page = pages.find(
    (p) => p.slugs.length === 1 && p.slugs[0] === operationId
  );

  if (!page || !("getAPIPageProps" in page.data)) {
    console.warn(`EmbeddedOperation: No OpenAPI page found for operationId "${operationId}"`);
    return null;
  }

  const props = page.data.getAPIPageProps();

  return (
    <div className="my-6">
      <InlineAPIPage {...props} />
    </div>
  );
}
