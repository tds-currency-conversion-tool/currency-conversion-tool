import { useEffect, useState } from 'react';

/**
 * Returns a debounced copy of value that only updates after delay ms
 * without changes. 
 * 
 * Useful to throttle API calls while the user types. 
 * Avoids firing a conversion request on every keystroke - only call the API after the user pauses typing for 300 ms - reduces network spam, flicker, and rate-limit risk.
 *
 * @typeParam - the type of the input value.
 *
 * @param value - the source value to debounce
 * @param delay - debounce window in milliseconds (default 300ms)
 *
 * @returns The most recent value, but only after it has remained unchanged for delay ms
 */
export function useDebounced<T>(value: T, delay = 300): T {
  // Internal state that lags behind value
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    // Schedule an update to copy value after delay ms.
    const timerId = setTimeout(() => setDebounced(value), delay);

    // If value or delay changes before the timer fires, cancel the old timer
    return () => clearTimeout(timerId);
  }, [value, delay]);

  return debounced;
}
