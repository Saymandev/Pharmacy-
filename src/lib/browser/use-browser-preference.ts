"use client";
import { useCallback, useSyncExternalStore, type SetStateAction } from "react";
const volatile = new Map<string, string>();
const eventName = "pharmacy:preference";

/** Server-safe preference snapshots with same-tab and cross-tab updates. */
export function useBrowserPreference<T extends string | boolean>(key: string, fallback: T) {
  const read = useCallback((): T => {
    let value = volatile.get(key);
    try { value = window.localStorage.getItem(key) ?? value; } catch { /* memory fallback */ }
    if (value === undefined) return fallback;
    return (typeof fallback === "boolean" ? value === "true" : value) as T;
  }, [key, fallback]);
  const subscribe = useCallback((notify: () => void) => {
    window.addEventListener("storage", notify); window.addEventListener(eventName, notify);
    return () => { window.removeEventListener("storage", notify); window.removeEventListener(eventName, notify); };
  }, []);
  const getServerSnapshot = useCallback(() => fallback, [fallback]);
  const value = useSyncExternalStore(subscribe, read, getServerSnapshot);
  const update = useCallback((next: SetStateAction<T>) => {
    const resolved = typeof next === "function" ? next(read()) : next;
    volatile.set(key, String(resolved));
    try { window.localStorage.setItem(key, String(resolved)); } catch { /* memory fallback */ }
    window.dispatchEvent(new Event(eventName));
  }, [key, read]);
  return [value, update] as const;
}
