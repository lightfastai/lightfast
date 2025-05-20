/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1)
 * 2. You want to create a new middleware or type of procedure (see Part 3)
 *
 * tl;dr - this is where all the tRPC server stuff is created and plugged in.
 * The pieces you will need to use are documented accordingly near the end
 */
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import type { Session } from "@vendor/openauth";
import { db } from "@vendor/db/client";
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> ac8850d9 (refactor: enhance TRPC provider and authentication handling)
import { $SessionType } from "@vendor/openauth";
import {
  getSessionFromCookiesNextHandler,
  verifyToken,
} from "@vendor/openauth/server";

import { $TRPCHeaderName, getHeaderFromTRPCHeaders } from "./headers";
<<<<<<< HEAD

/**
 * Isomorphic Session getter for API requests
 * - Works for both Next.JS and non-Next.JS requests through the Headers object
=======
import { $SessionType, authSubjects } from "@vendor/openauth";
import { auth, client } from "@vendor/openauth/server";

/**
 * Isomorphic Session getter for API requests
 * - Expo requests will have a session token in the Authorization header
 * - Next.js requests will have a session token in cookies
>>>>>>> 108e4271 (refactor: simplify TRPC provider and enhance session handling)
=======

/**
 * Isomorphic Session getter for API requests
 * - Works for both Next.JS and non-Next.JS requests through the Headers object
>>>>>>> ac8850d9 (refactor: enhance TRPC provider and authentication handling)
 */
const isomorphicGetSession = async (
  headers: Headers,
): Promise<Session | null> => {
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> ac8850d9 (refactor: enhance TRPC provider and authentication handling)
  const accessToken = getHeaderFromTRPCHeaders(
    headers,
    $TRPCHeaderName.Enum["x-lightfast-trpc-access-token"],
  );
  const refreshToken = getHeaderFromTRPCHeaders(
    headers,
    $TRPCHeaderName.Enum["x-lightfast-trpc-refresh-token"],
  );
<<<<<<< HEAD
  if (accessToken) {
    const verified = await verifyToken(accessToken, refreshToken ?? undefined);
=======
  const accessToken = headers.get("x-access-token") ?? null;
  if (accessToken) {
    const verified = await client.verify(authSubjects, accessToken);
>>>>>>> 108e4271 (refactor: simplify TRPC provider and enhance session handling)
=======
  if (accessToken) {
    const verified = await verifyToken(accessToken, refreshToken ?? undefined);
>>>>>>> ac8850d9 (refactor: enhance TRPC provider and authentication handling)
    if (verified.err) return null;
    return {
      type: $SessionType.Enum.user,
      user: {
        id: verified.subject.properties.id,
        accessToken,
<<<<<<< HEAD
<<<<<<< HEAD
        refreshToken: refreshToken ?? "",
      },
    };
  }
  return getSessionFromCookiesNextHandler();
=======
        refreshToken: verified.tokens?.refresh ?? "",
      },
    };
  }
  return auth();
>>>>>>> 108e4271 (refactor: simplify TRPC provider and enhance session handling)
=======
        refreshToken: refreshToken ?? "",
      },
    };
  }
  return getSessionFromCookiesNextHandler();
>>>>>>> ac8850d9 (refactor: enhance TRPC provider and authentication handling)
};

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: {
  headers: Headers;
  session: Session | null;
}): Promise<{
  session: Session | null;
  db: typeof db;
}> => {
  const userSession = await isomorphicGetSession(opts.headers);

  const source = getHeaderFromTRPCHeaders(
    opts.headers,
    $TRPCHeaderName.Enum["x-lightfast-trpc-source"],
  );

  if (!userSession) {
    console.info(`>>> tRPC Request from ${source} by unknown`);
  }

  if (userSession?.type === $SessionType.Enum.user) {
    console.info(`>>> tRPC Request from ${source} by ${userSession.user.id}`);
  }

  return {
    session: userSession,
    db,
  };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the trpc api is initialized, connecting the context and
 * transformer
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: {
      ...shape.data,
      zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
    },
  }),
});

/**
 * Create a server-side caller
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these
 * a lot in the /src/server/api/routers folder
 */

/**
 * This is how you create new routers and subrouters in your tRPC API
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Middleware for timing procedure execution and adding an articifial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (t._config.isDev) {
    // artificial delay in dev 100-500ms
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();

  const end = Date.now();
  console.info(`[TRPC] ${path} took ${end - start}ms to execute`);

  return result;
});

const protectedMiddleware = t.middleware(async ({ next, ctx }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  if (ctx.session.type === $SessionType.Enum.user && !ctx.session.user.id) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({ ctx: { session: ctx.session } });
});

const serverMiddleware = t.middleware(async ({ next, ctx }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  if (ctx.session.type !== $SessionType.Enum.server) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({ ctx: { session: ctx.session } });
});

/**
 * Public (unauthed) procedure
 *
 * This is the base piece you use to build new queries and mutations on your
 * tRPC API. It does not guarantee that a user querying is authorized, but you
 * can still access user session data if they are logged in
 */
export const publicProcedure = t.procedure.use(timingMiddleware);

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(protectedMiddleware);

export const serverProcedure = t.procedure
  .use(timingMiddleware)
  .use(serverMiddleware);
