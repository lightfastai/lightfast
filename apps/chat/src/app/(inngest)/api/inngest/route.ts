import { createInngestRouteContext } from "@api/chat/inngest";
import type { NextRequest } from "next/server";

const handlers = createInngestRouteContext();

// Explicitly type the handlers to match Next.js 15's type signature
// Using unknown cast to work around Next.js version mismatch in Inngest peer deps
export const GET = handlers.GET as unknown as (
  request: NextRequest,
  context: { params: Promise<object> },
) => Promise<Response>;

export const POST = handlers.POST as unknown as (
  request: NextRequest,
  context: { params: Promise<object> },
) => Promise<Response>;

export const PUT = handlers.PUT as unknown as (
  request: NextRequest,
  context: { params: Promise<object> },
) => Promise<Response>;