export function intersection<T>(a: T[], b: T[]): T[] {
  return a.filter((x) => b.includes(x))
}

/**
 * Computes a stable hash string for any value using deep inspection.
 * This function recursively builds a string for primitives, arrays, and objects.
 * It uses a cache (WeakMap) to avoid rehashing the same object twice, which is
 * particularly beneficial if an object appears in multiple places.
 */
function deepHash(value: unknown, cache = new WeakMap<object, string>()): string {
  // Handle primitives and null/undefined.
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  const type = typeof value
  if (type === 'number' || type === 'boolean' || type === 'string') {
    return `${type}:${String(value as string | number | boolean)}`
  }
  if (type === 'function') {
    // Note: using toString for functions.
    return `function:${String(value as (...args: unknown[]) => unknown)}`
  }

  // For objects and arrays, use caching to avoid repeated work.
  if (type === 'object') {
    const obj = value as object
    // If we've seen this object before, return the cached hash.
    const cached = cache.get(obj)
    if (cached !== undefined) {
      return cached
    }
    // Set a placeholder before recursing to break circular references.
    cache.set(obj, 'circular')
    let hash: string
    if (Array.isArray(obj)) {
      // Compute hash for each element in order.
      hash = `array:[${obj.map((v: unknown) => deepHash(v, cache)).join(',')}]`
    } else {
      // For objects, sort keys to ensure the representation is stable.
      const record = obj as Record<string, unknown>
      const keys = Object.keys(record).sort()
      const props = keys
        .map((k) => `${k}:${deepHash(record[k], cache)}`)
        .join(',')
      hash = `object:{${props}}`
    }
    cache.set(obj, hash)
    return hash
  }

  // Fallback for symbol and bigint types.
  if (type === 'symbol') return `symbol:${(value as symbol).toString()}`
  if (type === 'bigint') return `bigint:${(value as bigint).toString()}`
  return `${type}:unknown`
}

/**
 * Performs deep equality check for any two values.
 * This recursively checks primitives, arrays, and plain objects.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  // Check strict equality first.
  if (a === b) return true
  // If types differ, they're not equal.
  if (typeof a !== typeof b) return false
  if (a === null || b === null || a === undefined || b === undefined)
    return false

  // Check arrays.
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false
    }
    return true
  }

  // Check objects.
  if (typeof a === 'object') {
    if (typeof b !== 'object') return false
    const aRecord = a as Record<string, unknown>
    const bRecord = b as Record<string, unknown>
    const aKeys = Object.keys(aRecord).sort()
    const bKeys = Object.keys(bRecord).sort()
    if (aKeys.length !== bKeys.length) return false
    for (let i = 0; i < aKeys.length; i++) {
      const aKey = aKeys[i]
      const bKey = bKeys[i]
      if (aKey === undefined || bKey === undefined) return false
      if (aKey !== bKey) return false
      if (!deepEqual(aRecord[aKey], bRecord[bKey])) return false
    }
    return true
  }

  // For any other types (should be primitives by now), use strict equality.
  return false
}

/**
 * Returns a new array containing only the unique values from the input array.
 * Uniqueness is determined by deep equality.
 *
 * @param arr - The array of values to be filtered.
 * @returns A new array with duplicates removed.
 */
export function uniq<T>(arr: T[]): T[] {
  // Use a Map where key is the deep hash and value is an array of items sharing the same hash.
  const seen = new Map<string, T[]>()
  const result: T[] = []

  for (const item of arr) {
    const hash = deepHash(item)
    const itemsWithHash = seen.get(hash)
    if (itemsWithHash) {
      // There is a potential duplicate; check the stored items with the same hash.
      let duplicateFound = false
      for (const existing of itemsWithHash) {
        if (deepEqual(existing, item)) {
          duplicateFound = true
          break
        }
      }
      if (!duplicateFound) {
        itemsWithHash.push(item)
        result.push(item)
      }
    } else {
      // First time this hash appears.
      seen.set(hash, [item])
      result.push(item)
    }
  }

  return result
}

export function take<T>(a: T[], n: number): T[] {
  return a.slice(0, n)
}

export function flatten<T>(a: T[][]): T[] {
  return a.flat()
}
