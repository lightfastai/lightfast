import type { Database } from "@db/app";

import type { ProviderRoutineCommandDeps } from "../../domain/provider-routines";
import { callProviderRoutine } from "./call";
import { findProviderRoutines } from "./find";

type ProviderRoutineCommandDepOverrides = Partial<
  Pick<
    ProviderRoutineCommandDeps,
    "callProviderRoutine" | "findProviderRoutines"
  >
>;

export function createProviderRoutineCommandDeps(
  input: Omit<
    ProviderRoutineCommandDeps,
    "callProviderRoutine" | "db" | "findProviderRoutines"
  > & {
    db: Database;
  } & ProviderRoutineCommandDepOverrides
): ProviderRoutineCommandDeps {
  return {
    ...input,
    callProviderRoutine:
      input.callProviderRoutine ??
      ((context, value) => callProviderRoutine(context, value)),
    findProviderRoutines:
      input.findProviderRoutines ??
      ((context, value) => findProviderRoutines(context, value)),
  };
}
