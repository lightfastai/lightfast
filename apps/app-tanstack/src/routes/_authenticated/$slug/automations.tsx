import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/$slug/automations")({
  head: ({ params }) => ({
    meta: [{ title: `Automations - ${params.slug} - Lightfast` }],
  }),
  component: Outlet,
});
