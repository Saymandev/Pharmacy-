"use client";

import { useLayoutEffect, useRef, type MouseEvent } from "react";

const positions = new Map<string, number>();

/** Page-owned AppShell instances share sidebar position, not content scroll. */
export function useSidebarScroll(userId: string, route: string, ready: boolean) {
  const ref = useRef<HTMLElement>(null);
  const key = `pharmacy.sidebar-scroll:${userId}`;
  useLayoutEffect(() => {
    if (!ready || !ref.current || !ref.current.getClientRects().length) return;
    let top = positions.get(key) ?? 0;
    try { const saved = sessionStorage.getItem(key); if (saved !== null && Number.isFinite(Number(saved))) top = Math.max(0, Number(saved)); } catch { /* Memory fallback for unavailable storage. */ }
    ref.current.scrollTop = top;
  }, [key, ready, route]);
  function remember() {
    if (!ready || !ref.current || !ref.current.getClientRects().length) return;
    const top = ref.current.scrollTop;
    positions.set(key, top);
    try { sessionStorage.setItem(key, String(top)); } catch { /* Memory fallback. */ }
  }
  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    remember();
    if (!event.defaultPrevented && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) window.scrollTo(0, 0);
  }
  return { ref, remember, navigate };
}
