/**
 * Inngest API route handler for memory service
 *
 * Serves Inngest functions registered in @api/memory/inngest.
 * Initially empty — functions are added as they are ported from
 * console, gateway, and backfill services.
 */
import { createInngestRouteContext } from "@api/memory/inngest";
import type { NextRequest } from "next/server";

const handlers = createInngestRouteContext();

export const GET = handlers.GET as unknown as (
  request: NextRequest,
  context: { params: Promise<object> }
) => Promise<Response>;

export const POST = handlers.POST as unknown as (
  request: NextRequest,
  context: { params: Promise<object> }
) => Promise<Response>;

export const PUT = handlers.PUT as unknown as (
  request: NextRequest,
  context: { params: Promise<object> }
) => Promise<Response>;
