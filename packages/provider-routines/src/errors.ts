import type {
  ProviderRoutineErrorCode,
  ProviderRoutineId,
} from "@repo/provider-routine-contract";

export class ProviderRoutineError extends Error {
  code: ProviderRoutineErrorCode;
  providerRoutineCallId?: string;
  publicMessage: string;
  routineId?: ProviderRoutineId;

  constructor(input: {
    cause?: unknown;
    code: ProviderRoutineErrorCode;
    message: string;
    providerRoutineCallId?: string;
    routineId?: ProviderRoutineId;
  }) {
    super(input.message);
    this.name = "ProviderRoutineError";
    this.cause = input.cause;
    this.code = input.code;
    this.publicMessage = input.message;
    this.providerRoutineCallId = input.providerRoutineCallId;
    this.routineId = input.routineId;
  }
}

export function providerRoutineError(input: {
  cause?: unknown;
  code: ProviderRoutineErrorCode;
  message: string;
  providerRoutineCallId?: string;
  routineId?: ProviderRoutineId;
}) {
  return new ProviderRoutineError(input);
}
