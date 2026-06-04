import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      { title: "Lightfast MCP" },
      {
        name: "description",
        content: "Hosted Lightfast MCP resource server.",
      },
    ],
    links: [
      {
        rel: "icon",
        href: "/favicon.ico",
        sizes: "any",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "16x16",
        href: "/favicon-16x16.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/favicon-32x32.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "48x48",
        href: "/favicon-48x48.png",
      },
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "/apple-touch-icon.png",
      },
      {
        rel: "manifest",
        href: "/site.webmanifest",
      },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundPage,
});

function RootComponent() {
  return (
    <html lang="en">
      {/* biome-ignore lint/style/noHeadElement: TanStack Start root routes render the document shell. */}
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}

function NotFoundPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
        color: "#171717",
        background: "#f7f7f5",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      }}
    >
      <section
        style={{
          width: "min(100%, 32rem)",
          display: "grid",
          gap: "0.75rem",
        }}
      >
        <p
          style={{
            margin: 0,
            color: "#6b7280",
            fontSize: "0.875rem",
            fontWeight: 600,
            textTransform: "uppercase",
          }}
        >
          404
        </p>
        <h1
          style={{
            margin: 0,
            fontSize: "clamp(2rem, 6vw, 3.5rem)",
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          Not found
        </h1>
      </section>
    </main>
  );
}
