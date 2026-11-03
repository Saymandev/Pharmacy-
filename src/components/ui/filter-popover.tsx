"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Filter, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-provider";

function FloatingFilters({ children, className = "", id, onClose }: { children: ReactNode; className?: string; id?: string; onClose: () => void }) {
  const { t } = useLanguage();
  const panel = useRef<HTMLDivElement>(null);
  const latest = useRef(onClose);
  useEffect(() => { latest.current = onClose; }, [onClose]);
  useEffect(() => {
    const element = panel.current;
    if (!element) return;
    const trigger = element.parentElement?.querySelector<HTMLButtonElement>('button.data-filter-button[aria-expanded="true"],button.data-filter-button');
    const anchor = trigger?.getBoundingClientRect() ?? element.parentElement!.getBoundingClientRect();
    const width = Math.min(760, window.innerWidth - 24);
    const below = window.innerHeight - anchor.bottom - 12;
    const above = below < 260 && anchor.top > below;
    Object.assign(element.style, { width: `${width}px`, left: `${Math.max(12, Math.min(anchor.left, window.innerWidth - width - 12))}px`, top: above ? "auto" : `${anchor.bottom + 7}px`, bottom: above ? `${window.innerHeight - anchor.top + 7}px` : "auto", maxHeight: `${Math.max(140, above ? anchor.top - 20 : below - 10)}px` });
    element.showPopover();
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !element!.contains(event.target) && !trigger?.contains(event.target)) latest.current();
    }
    function key(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.target instanceof Element && event.target.closest(".ui-select-popup")) return;
      event.preventDefault(); event.stopPropagation(); latest.current(); trigger?.focus();
    }
    function resize() { latest.current(); }
    function scrollAway(event: Event) { if (event.target instanceof Node && !element!.contains(event.target)) latest.current(); }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key, true);
    window.addEventListener("resize", resize);
    document.addEventListener("wheel", scrollAway, { capture: true, passive: true });
    return () => { element.hidePopover(); document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", key, true); window.removeEventListener("resize", resize); document.removeEventListener("wheel", scrollAway, true); };
  }, []);
  return <div ref={panel} id={id} popover="manual" className={`floating-filter ${className}`} role="region" aria-label={t("Filters")}><div className="floating-filter-heading"><strong><Filter size={16}/>{t("Filters")}</strong><button type="button" aria-label={t("Close filters")} onClick={onClose}><X size={17}/></button></div>{children}</div>;
}

export function FilterPopover({ children, className, id, onClose }: { children: ReactNode; className?: string; id?: string; onClose?: () => void }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  if (onClose) return <FloatingFilters className={className} id={id} onClose={onClose}>{children}</FloatingFilters>;
  return <div className="filter-popover-control"><button type="button" className="data-filter-button" aria-expanded={open} onClick={() => setOpen(value => !value)}><Filter size={16}/>{t("Filters")}</button>{open && <FloatingFilters className={className} id={id} onClose={() => setOpen(false)}>{children}</FloatingFilters>}</div>;
}
