"use client";

import { useEffect, useRef } from "react";

export function useDismissiblePanel(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function pointer(event: PointerEvent) {
      if (event.target instanceof Node && !ref.current?.contains(event.target)) close();
    }
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
        ref.current?.querySelector<HTMLElement>("button[aria-expanded]")?.focus();
      }
    }
    document.addEventListener("pointerdown", pointer);
    document.addEventListener("keydown", keyboard, true);
    return () => {
      document.removeEventListener("pointerdown", pointer);
      document.removeEventListener("keydown", keyboard, true);
    };
  }, [open, close]);
  return ref;
}
