import { orpcRouter } from "@api/app";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

const handler = new OpenAPIHandler(orpcRouter);

const setCorsHeaders = (res: Response) => {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );
  res.headers.set("Access-Control-Allow-Headers", "authorization,content-type");
  res.headers.set("Vary", "Origin");
  return res;
};

export const OPTIONS = () =>
  setCorsHeaders(new Response(null, { status: 204 }));

const dispatch = async (req: NextRequest) => {
  const { response } = await handler.handle(req, {
    prefix: "/api/v1",
    context: {
      headers: req.headers,
      requestId: crypto.randomUUID(),
    },
  });
  return setCorsHeaders(response ?? new Response(null, { status: 404 }));
};

export {
  dispatch as DELETE,
  dispatch as GET,
  dispatch as PATCH,
  dispatch as POST,
  dispatch as PUT,
};
