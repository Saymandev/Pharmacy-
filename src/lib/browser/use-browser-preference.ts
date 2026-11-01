"use client";
import { useCallback, useSyncExternalStore, type SetStateAction } from "react";
const volatile = new Map<string, string>();
const eventName = "pharmacy:preference";

/** Server-safe preference snapshots with same-tab and cross-tab updates. */
export function useBrowserPreference<T extends string | boolean>(key: string, fallback: T, allowed?: readonly T[]) {
  const read = useCallback((): T => {
    let value = volatile.get(key);
    if(value===undefined)try { value = window.localStorage.getItem(key) ?? undefined; } catch { /* memory fallback */ }
    if (value === undefined) return fallback;
    if(typeof fallback==="boolean")return (value==="true"?true:value==="false"?false:fallback) as T;
    return allowed&&!allowed.includes(value as T)?fallback:value as T;
  }, [key, fallback, allowed]);
  const subscribe = useCallback((notify: () => void) => {
    const onStorage=(event:StorageEvent)=>{if(event.key===key||event.key===null){volatile.delete(key);notify();}};
    window.addEventListener("storage", onStorage); window.addEventListener(eventName, notify);
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener(eventName, notify); };
  }, [key]);
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
