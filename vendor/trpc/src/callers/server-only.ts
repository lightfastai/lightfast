import { appRouter } from "../root";
import { createCallerFactory } from "../trpc";

/**
 * Create a server-side caller for the tRPC API
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
const createServerOnlyCaller = createCallerFactory(appRouter);

export { createServerOnlyCaller };
