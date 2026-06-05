/// <reference types="vite/client" />

import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { buildRootHead } from "~/lib/root-head";
import appCss from "../styles/globals.css?url";

export const Route = createRootRoute({
  head: () => buildRootHead(appCss),
  component: RootComponent,
  notFoundComponent: NotFoundPage,
});

function RootComponent() {
  return (
    <html
      className="dark scrollbar-thin touch-manipulation font-sans antialiased"
      lang="en"
      suppressHydrationWarning
    >
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
    <main className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
      <section className="grid w-full max-w-md gap-3">
        <p className="font-medium text-muted-foreground text-sm uppercase">
          404
        </p>
        <h1 className="font-medium text-4xl tracking-normal">Not found</h1>
        <p className="text-muted-foreground">
          This page has not been added to the TanStack marketing pilot.
        </p>
      </section>
    </main>
  );
}
