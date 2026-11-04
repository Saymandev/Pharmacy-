"use client";

import { useState, type Ref } from "react";
import { useLanguage } from "@/lib/i18n/language-provider";

/** Keep an editable draft so clearing/retyping a quantity does not force a stray 1. */
export function QuantityInput({ quantity, max, onChange, onDone, inputRef }: {
  quantity: number; max: number; onChange: (quantity: number) => void; onDone: () => void; inputRef?: Ref<HTMLInputElement>;
}) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const normalize = (value: string) => Math.max(1, Math.min(Math.floor(max), Math.floor(Number(value)) || 1));
  function commit() { onChange(normalize(draft)); setEditing(false); }
  return <input ref={inputRef} aria-label={t("Quantity")} inputMode="numeric" autoComplete="off" value={editing ? draft : quantity}
    onFocus={event => { setDraft(String(quantity)); setEditing(true); event.currentTarget.select(); }}
    onChange={event => {
      const next = event.target.value.replace(/[০-৯]/g, digit => String("০১২৩৪৫৬৭৮৯".indexOf(digit)));
      if (!/^\d*$/.test(next)) return;
      setDraft(next);
      if (next && Number(next) >= 1 && Number(next) <= max) onChange(Number(next));
    }}
    onBlur={commit}
    onKeyDown={event => {
      if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "Enter") { event.preventDefault(); commit(); onDone(); }
      if (["ArrowUp", "ArrowDown", "+", "-"].includes(event.key)) {
        event.preventDefault();
        const next = normalize(String(normalize(draft) + (["ArrowUp", "+"].includes(event.key) ? 1 : -1)));
        setDraft(String(next)); onChange(next);
      }
    }} />;
}
