"use client";

import { useCallback, useEffect, useRef } from "react";

const DEBOUNCE_DELAY = 8;

/**
 * A custom hook that returns a debounced version of the provided callback function.
 * The debounced function will delay invoking the callback until after `delay` milliseconds
 * have elapsed since the last time it was called.
 *
 * @template T - Generic type extending a function
 * @param {T} callback - The function to debounce
 * @param {number} delay - The number of milliseconds to delay
 * @returns {(...args: Parameters<T>) => void} A debounced version of the callback
 *
 * @example
 * ```tsx
 * // Basic usage
 * const debouncedFn = useDebounce((value: string) => {
 *   console.log(value);
 * }, 500);
 *
 * // Usage with state
 * const [value, setValue] = useState('');
 * const debouncedSetValue = useDebounce((newValue: string) => {
 *   setValue(newValue);
 * }, 300);
 *
 * // Usage with event handlers
 * const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 *   debouncedSetValue(e.target.value);
 * };
 * ```
 *
 * @remarks
 * - The hook automatically cleans up the timeout when the component unmounts
 * - If the debounced function is called multiple times within the delay period,
 *   only the last call will be executed
 * - The callback and delay parameters are included in the dependency array of useCallback,
 *   so changing either will create a new debounced function
 */
export const useDebounce = <T extends (...args: any[]) => void>(
  callback: T,
  delay: number = DEBOUNCE_DELAY,
) => {
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay],
  );
};
