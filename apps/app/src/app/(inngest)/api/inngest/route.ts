import { createInngestRouteContext } from "@api/app/inngest";

export const runtime = "nodejs";
export const { GET, POST, PUT } = createInngestRouteContext();
