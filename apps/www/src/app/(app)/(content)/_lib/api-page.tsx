import { createAPIPage } from "fumadocs-openapi/ui";
import client from "~/app/(app)/(content)/_lib/api-page.client";
import {
  renderOperationLayout,
  renderPageLayout,
} from "~/app/(app)/(content)/_lib/api-page-renderers";
import { getCodeSamples } from "~/app/(app)/(content)/_lib/code-samples";
import { openapi } from "~/app/(app)/(content)/_lib/openapi";

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
