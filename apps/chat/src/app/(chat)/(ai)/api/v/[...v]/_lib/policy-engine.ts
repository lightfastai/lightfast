export type ResourceRecord = Record<string, unknown>;

export interface PolicyContext<TResources extends ResourceRecord> {
  request: Request;
  resources: TResources;
}

export interface AllowResult<TResources extends ResourceRecord> {
  kind: "allow";
  resources?: Partial<TResources>;
}

export interface DenyResult {
  kind: "deny";
  response: Response;
}

export type GuardResult<TResources extends ResourceRecord> =
  | AllowResult<TResources>
  | DenyResult;

export type Guard<TResources extends ResourceRecord> = (
  context: PolicyContext<TResources>,
) => Promise<GuardResult<TResources>> | GuardResult<TResources>;

export const allow = <TResources extends ResourceRecord>(
  resources?: Partial<TResources>,
): AllowResult<TResources> => ({
  kind: "allow",
  resources,
});

export const deny = (response: Response): DenyResult => ({
  kind: "deny",
  response,
});

export async function runGuards<TResources extends ResourceRecord>(
  guards: Guard<TResources>[],
  context: PolicyContext<TResources>,
): Promise<Response | null> {
  for (const guard of guards) {
    const result = await guard(context);
    if (result.kind === "deny") {
      return result.response;
    }

    if (result.resources) {
      Object.assign(context.resources, result.resources);
    }
  }

  return null;
}
