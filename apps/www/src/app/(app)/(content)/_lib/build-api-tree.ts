import type * as PageTree from "fumadocs-core/page-tree";
import {
  apiPageTree,
  getApiPages,
  isOpenAPIPage,
} from "~/app/(app)/(content)/_lib/source";

/**
 * Build a custom page tree that includes OpenAPI virtual pages
 *
 * The default apiPageTree only includes MDX pages from meta.json.
 * This function adds the OpenAPI virtual pages to the tree structure.
 *
 * We use groupBy: "none" to generate flat URLs based on operationId.
 * URLs: /docs/api-reference/search, /docs/api-reference/contents, etc.
 */
export function buildApiPageTree(): PageTree.Root {
  const allPages = getApiPages();

  // Separate MDX pages from OpenAPI pages
  const openapiPages = allPages.filter(isOpenAPIPage);

  // Build flat list of endpoint pages directly under "Endpoints" folder
  // URLs are flat using operationId: /docs/api-reference/search, /docs/api-reference/contents, etc.
  // Sidebar displays them as a simple flat list under "Endpoints"
  const openapiFolder: PageTree.Folder = {
    type: "folder",
    name: "Endpoints",
    index: undefined,
    children: openapiPages.map(
      (page): PageTree.Item => ({
        type: "page",
        name: page.data.title ?? "Untitled",
        url: page.url,
        external: false,
      })
    ),
  };

  // Insert the Endpoints folder into the existing tree
  return {
    name: apiPageTree.name,
    children: [
      ...apiPageTree.children.slice(0, 1), // Getting Started
      openapiFolder, // Endpoints (OpenAPI)
      ...apiPageTree.children.slice(1), // SDKs & Tools
    ],
  };
}
