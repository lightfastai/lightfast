export function toPlainClerkResource<T>(resource: T): T {
  return structuredClone(resource);
}
