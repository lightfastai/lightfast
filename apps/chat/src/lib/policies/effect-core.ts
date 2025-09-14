import { Effect } from "effect";

// Basic error types for the Effect system
export class ValidationError extends Error {
  readonly _tag = "ValidationError";
  constructor(message: string) {
    super(message);
  }
}

export class AuthError extends Error {
  readonly _tag = "AuthError";
  constructor(message: string) {
    super(message);
  }
}

export class RateLimitError extends Error {
  readonly _tag = "RateLimitError";
  constructor(message: string) {
    super(message);
  }
}

export class QuotaError extends Error {
  readonly _tag = "QuotaError";
  constructor(message: string) {
    super(message);
  }
}

export class ModelAccessError extends Error {
  readonly _tag = "ModelAccessError";
  constructor(message: string) {
    super(message);
  }
}

export class ProfileError extends Error {
  readonly _tag = "ProfileError";
  constructor(message: string) {
    super(message);
  }
}

export class ExecutionError extends Error {
  readonly _tag = "ExecutionError";
  constructor(message: string, public cause?: unknown) {
    super(message);
  }
}

export class MemoryError extends Error {
  readonly _tag = "MemoryError";
  constructor(message: string) {
    super(message);
  }
}

// Base Guard class
export abstract class Guard<TInput, TOutput, TError extends Error> {
  abstract check(resource: TInput): Effect.Effect<TOutput, TError>;
}

// Base Resource Allocator class
export abstract class ResourceAllocator<TInput, TOutput, TError extends Error> {
  abstract allocate(resource: TInput): Effect.Effect<TOutput, TError>;
}

// Base Resource Executor class  
export abstract class ResourceExecutor<TInput, TOutput, TError extends Error> {
  abstract execute(resource: TInput): Effect.Effect<TOutput, TError>;
}

// Resource context wrapper
export class Resource<T> {
  constructor(private _resource: T) {}
  
  get resource() {
    return this._resource;
  }
  
  static create<T>(resource: T): Effect.Effect<Resource<T>, never> {
    return Effect.succeed(new Resource(resource));
  }
  
  guard<TOutput, TError extends Error>(
    guard: Guard<T, TOutput, TError>
  ): Effect.Effect<Resource<TOutput>, TError> {
    return guard.check(this._resource).pipe(
      Effect.map(result => new Resource(result))
    );
  }
  
  allocate<TOutput, TError extends Error>(
    allocator: ResourceAllocator<T, TOutput, TError>
  ): Effect.Effect<Resource<TOutput>, TError> {
    return allocator.allocate(this._resource).pipe(
      Effect.map(result => new Resource(result))
    );
  }
  
  execute<TOutput, TError extends Error>(
    executor: ResourceExecutor<T, TOutput, TError>
  ): Effect.Effect<TOutput, TError> {
    return executor.execute(this._resource);
  }
}

// Request Service
export interface RequestService {
  request: Request;
  method: string;
}

export const RequestService = {
  of: (service: RequestService) => service,
};