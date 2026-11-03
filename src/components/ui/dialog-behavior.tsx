"use client";

import { useEffect } from "react";

/** Adds keyboard focus, Escape dismissal and scroll locking to legacy dialogs. */
export function DialogBehavior() {
  useEffect(() => {
    let current: HTMLElement | null = null;
    let previous: HTMLElement | null = null;
    let overflow: string | null = null;
    const candidates = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')).filter(node => node.getClientRects().length && !node.closest('[popover]:not(:popover-open)'));
    function sync() {
      const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')).filter(node => node.getClientRects().length);
      const next = dialogs.at(-1) ?? null;
      if (next === current) return;
      if (!next) {
        if (overflow !== null) document.body.style.overflow = overflow;
        overflow = null;
        if (previous?.isConnected) previous.focus();
        previous = null;
      } else {
        if (!current) {
          previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          overflow = document.body.style.overflow;
          document.body.style.overflow = "hidden";
        }
        if (!(next instanceof HTMLDialogElement) && !next.contains(document.activeElement)) {
          const first = candidates(next).find(node => node.matches('input:not([type="checkbox"]),select,textarea')) ?? candidates(next)[0];
          first?.focus({ preventScroll: true });
        }
      }
      current = next;
    }
    function keyboard(event: KeyboardEvent) {
      if (!current || event.target instanceof Element && event.target.closest('[popover]:popover-open')) return;
      if (current instanceof HTMLDialogElement) return;
      if (event.key === "Escape") {
        const close = current.querySelector<HTMLButtonElement>('button.purchase-close,button.data-dialog-close,button.pos-cart-close,button[aria-label="Close"],button[aria-label="বন্ধ করুন"]');
        if (close && !close.disabled) { event.preventDefault(); event.stopPropagation(); close.click(); }
      }
      if (event.key === "Tab") {
        const all = candidates(current);
        const first = all[0], last = all.at(-1);
        if (first && (event.shiftKey && document.activeElement === first || !event.shiftKey && document.activeElement === last)) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); }
      }
    }
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open"] });
    document.addEventListener("keydown", keyboard, true);
    sync();
    return () => {
      observer.disconnect(); document.removeEventListener("keydown", keyboard, true);
      if (overflow !== null) document.body.style.overflow = overflow;
    };
  }, []);
  return null;
}
