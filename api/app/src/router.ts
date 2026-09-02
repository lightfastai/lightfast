export type ApiProcedure<TContext, TOutput> = (
  context: TContext
) => Promise<TOutput> | TOutput;

export function createRouter<const TRouter>(router: TRouter): TRouter {
  return router;
}
