import {
  createRootRoute,
  HeadContent,
  Link,
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
      { title: "TanStack Start Example" },
      {
        name: "description",
        content: "Standalone TanStack Start example for Lightfast.",
      },
    ],
    links: [
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "/favicon.svg",
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
          gap: "1rem",
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
          Page not found
        </h1>
        <Link
          style={{
            width: "fit-content",
            color: "#064e3b",
            fontWeight: 600,
            textDecoration: "none",
          }}
          to="/"
        >
          Go home
        </Link>
      </section>
    </main>
  );
}
