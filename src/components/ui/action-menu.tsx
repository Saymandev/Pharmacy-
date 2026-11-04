"use client";

import { useEffect, useId, useRef, useState, type ElementType } from "react";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-provider";

type Item = { label: string; icon?: ElementType; onSelect: () => void; danger?: boolean; disabled?: boolean };

/** Native top-layer menu: survives table clipping and dismisses outside or on Escape. */
export function ActionMenu({ label, items, disabled }: { label: string; items: Item[]; disabled?: boolean }) {
  const { t } = useLanguage();
  const id = useId(), trigger = useRef<HTMLButtonElement>(null), popup = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: Event) => { if (!(event.target instanceof Node && popup.current?.contains(event.target))) popup.current?.hidePopover(); };
    window.addEventListener("resize", dismiss);
    document.addEventListener("scroll", dismiss, true);
    return () => { window.removeEventListener("resize", dismiss); document.removeEventListener("scroll", dismiss, true); };
  }, [open]);
  if (!items.length) return <span>—</span>;
  function show() {
    const button = trigger.current, menu = popup.current;
    if (!button || !menu) return;
    if (menu.matches(":popover-open")) { menu.hidePopover(); return; }
    const rect = button.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(rect.right - 224, window.innerWidth - 232))}px`;
    menu.style.top = `${Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 240))}px`;
    menu.showPopover();
    menu.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
  }
  return <div className="action-menu">
    <button ref={trigger} type="button" className="action-menu-trigger" aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={id} disabled={disabled} onClick={show} onKeyDown={event => { if (event.key === "ArrowDown") { event.preventDefault(); show(); } }}><MoreHorizontal size={17}/><span>{t("Actions")}</span><ChevronDown size={13}/></button>
    <div ref={popup} id={id} popover="auto" role="menu" aria-label={label} className="action-menu-popup" onToggle={event => setOpen(event.newState === "open")} onKeyDown={event => {
      const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault(); buttons[event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowUp" ? -1 : 1) + buttons.length) % buttons.length]?.focus();
      } else if (event.key === "Escape" || event.key === "Tab") { popup.current?.hidePopover(); trigger.current?.focus(); if (event.key === "Escape") event.preventDefault(); }
    }}>
      {items.map(({ label: text, icon: Icon, onSelect, danger, disabled: itemDisabled }) => <button role="menuitem" type="button" key={text} className={danger ? "action-menu-danger" : undefined} disabled={itemDisabled} onClick={() => { popup.current?.hidePopover(); trigger.current?.focus(); onSelect(); }}>{Icon && <Icon size={16}/>}<span>{text}</span></button>)}
    </div>
  </div>;
}
