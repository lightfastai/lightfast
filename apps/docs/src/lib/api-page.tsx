import { openapi } from "@/src/lib/openapi";
import { createAPIPage } from "fumadocs-openapi/ui";
import client from "./api-page.client";
import { renderOperationLayout, renderPageLayout } from "./api-page-renderers";
import { getCodeSamples } from "./code-samples";

/**
 * Lightfast-branded API page component
 *
 * Uses custom layout renderers to apply Lightfast design system
 * while maintaining all fumadocs-openapi functionality.
 */
export const APIPage = createAPIPage(openapi, {
  client,
  generateCodeSamples(endpoint) {
    return getCodeSamples(endpoint);
  },
  content: {
    renderOperationLayout,
    renderPageLayout,
  },
});
