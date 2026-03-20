import { createInngestRouteContext } from "@api/app/inngest";

export const runtime = "edge";
export const { GET, POST, PUT } = createInngestRouteContext();
