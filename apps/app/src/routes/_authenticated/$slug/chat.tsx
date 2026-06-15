import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/$slug/chat")({
  head: ({ params }) => ({
    meta: [{ title: `Chat - ${params.slug} - Lightfast` }],
  }),
  component: Outlet,
});
