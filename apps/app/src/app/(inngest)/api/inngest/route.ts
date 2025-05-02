import { createInngestRouteContext } from "@vendor/trpc/inngest";

export const maxDuration = 30;

export const { GET, POST, PUT } = createInngestRouteContext();
