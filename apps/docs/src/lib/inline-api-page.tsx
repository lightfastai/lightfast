import { openapi } from "@/src/lib/openapi";
import { createAPIPage } from "fumadocs-openapi/ui";

/**
 * Minimal API page component for embedding operations inline in MDX.
 *
 * Renders only the requested sections (parameters, body, responses)
 * without header, playground, code samples, or branding.
 */
export const InlineAPIPage = createAPIPage(openapi, {
  content: {
    renderOperationLayout(slots) {
      return (
        <div className="not-prose">
          {slots.paremeters}
          {slots.body}
          {slots.responses}
        </div>
      );
    },
    renderPageLayout(slots) {
      return (
        <>
          {slots.operations?.map((op) => (
            <div key={`${op.item.path}:${op.item.method}`}>
              {op.children}
            </div>
          ))}
        </>
      );
    },
  },
  // Disable playground for inline rendering
  playground: {
    enabled: false,
  },
});
