"use client";

import { Children, isValidElement, useEffect, useId, useRef, useState, type ReactNode, type SelectHTMLAttributes } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-provider";

type Choice = { value: string; label: string; disabled: boolean };
function text(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (isValidElement<{ children?: ReactNode }>(node)) return text(node.props.children);
  return Children.toArray(node).map(child => isValidElement<{ children?: ReactNode }>(child) ? text(child.props.children) : String(child)).join("");
}
function choices(children: ReactNode, disabled = false): Choice[] {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>(child)) return [];
    if (child.type === "option") return [{ value: String(child.props.value ?? text(child.props.children)), label: text(child.props.children), disabled: disabled || !!child.props.disabled }];
    return choices(child.props.children, disabled || !!child.props.disabled);
  });
}

/** Native form semantics and validation, with a searchable, keyboard-operated popup. */
export function Select({ children, className = "", onKeyDown, onChange, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  const { t } = useLanguage();
  const id = useId();
  const native = useRef<HTMLSelectElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [uncontrolled, setUncontrolled] = useState(String(props.defaultValue ?? ""));
  useEffect(() => {
    if (!open) return;
    popup.current?.showPopover();
    search.current?.focus({ preventScroll: true });
    function dismiss(event: Event) {
      if (event.target instanceof Node && popup.current?.contains(event.target)) return;
      popup.current?.hidePopover();
    }
    window.addEventListener("resize", dismiss);
    document.addEventListener("wheel", dismiss, { capture: true, passive: true });
    document.addEventListener("touchmove", dismiss, { capture: true, passive: true });
    return () => { window.removeEventListener("resize", dismiss); document.removeEventListener("wheel", dismiss, true); document.removeEventListener("touchmove", dismiss, true); };
  }, [open]);
  const items = choices(children);
  const selected = String(props.value ?? uncontrolled);
  const shown = items.filter(item => item.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  function close() { popup.current?.hidePopover(); setOpen(false); }
  function reveal() {
    if (!native.current || native.current.matches(":disabled")) return;
    const rect = native.current.getBoundingClientRect();
    const menu = popup.current;
    if (!menu) return;
    const width = Math.min(Math.max(rect.width, 240), window.innerWidth - 24);
    const below = window.innerHeight - rect.bottom - 12;
    const height = Math.min(340, Math.max(below, rect.top - 12));
    Object.assign(menu.style, { width: `${width}px`, left: `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`, top: below >= Math.min(240, rect.top) ? `${rect.bottom + 6}px` : "auto", bottom: below >= Math.min(240, rect.top) ? "auto" : `${window.innerHeight - rect.top + 6}px`, maxHeight: `${height}px` });
    setQuery(""); setHighlight(0); setOpen(true);
  }
  function choose(item: Choice) {
    if (item.disabled || !native.current) return;
    native.current.value = item.value;
    native.current.dispatchEvent(new Event("change", { bubbles: true }));
    close(); native.current.focus();
  }
  function navigate(event: React.KeyboardEvent) {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); native.current?.focus(); }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      let next = highlight;
      for (let step = 0; step < shown.length; step++) {
        next = (next + (event.key === "ArrowDown" ? 1 : -1) + shown.length) % shown.length;
        if (!shown[next].disabled) break;
      }
      setHighlight(next);
      document.getElementById(`${id}-${next}`)?.scrollIntoView({ block: "nearest" });
    }
    if (event.key === "Enter" && shown[highlight]) { event.preventDefault(); choose(shown[highlight]); }
    if (event.key === "Tab") { native.current?.focus(); close(); }
  }
  return <span className={`ui-select ${className}`} data-open={open}>
    <select {...props} className="ui-select-native" ref={native} aria-expanded={open} aria-controls={`${id}-list`} onChange={event => { setUncontrolled(event.target.value); onChange?.(event); }} onKeyDown={event => { onKeyDown?.(event); if (!event.defaultPrevented && ["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); reveal(); } }}>{children}</select>
    <span className="ui-select-display" aria-hidden="true" onPointerDown={event => event.preventDefault()} onClick={event => { event.preventDefault(); if (open) close(); else reveal(); }}><span>{items.find(item => item.value === selected)?.label ?? items[0]?.label ?? t("Select")}</span><ChevronDown size={16}/></span>
    <div ref={popup} popover="auto" className="ui-select-popup" onToggle={event => { if (event.newState === "closed") setOpen(false); }} onKeyDown={navigate}>
      {open && <>
      <div className="ui-select-search"><Search size={16}/><input ref={search} aria-label={t("Search options")} placeholder={t("Search options")} value={query} onChange={event => { setQuery(event.target.value); setHighlight(0); }} role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls={`${id}-list`} aria-activedescendant={shown[highlight] ? `${id}-${highlight}` : undefined}/></div>
      <div role="listbox" id={`${id}-list`} aria-label={props["aria-label"] ?? t("Options")} className="ui-select-options">
        {shown.map((item, index) => <div id={`${id}-${index}`} key={`${item.value}-${index}`} role="option" aria-selected={item.value === selected} aria-disabled={item.disabled} data-highlighted={index === highlight} onPointerMove={() => setHighlight(index)} onClick={event => { event.preventDefault(); event.stopPropagation(); choose(item); }}>{item.label}<Check size={15} style={{ visibility: item.value === selected ? "visible" : "hidden" }}/></div>)}
        {!shown.length && <p role="status">{t("No matching options")}</p>}
      </div>
      </>}
    </div>
  </span>;
}
