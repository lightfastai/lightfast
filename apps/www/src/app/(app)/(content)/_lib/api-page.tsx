import { openaiDark } from "@repo/ui/components/ssr-code-block/openai-dark-theme";
import { createAPIPage } from "fumadocs-openapi/ui";
import client from "~/app/(app)/(content)/_lib/api-page.client";
import {
  renderOperationLayout,
  renderPageLayout,
} from "~/app/(app)/(content)/_lib/api-page-renderers";
import { getCodeSamples } from "~/app/(app)/(content)/_lib/code-samples";
import { openapi } from "~/app/(app)/(content)/_lib/openapi";

export const APIPage = createAPIPage(openapi, {
  client,
  generateCodeSamples(endpoint) {
    return getCodeSamples(endpoint);
  },
  shikiOptions: {
    themes: {
      light: openaiDark,
      dark: openaiDark,
    },
  },
  content: {
    renderOperationLayout,
    renderPageLayout,
  },
});
