"use client";

import { useEffect, useRef, useState } from "react";
import { X, Delete } from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-provider";
import { calculate } from "./calculator-policy";

export function PosCalculator({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null), input = useRef<HTMLInputElement>(null);
  const [expression, setExpression] = useState(""), [result, setResult] = useState(""), [error, setError] = useState("");
  useEffect(() => {
    const previous = document.activeElement, node = dialog.current;
    node?.showModal(); input.current?.focus();
    return () => { node?.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  function equals() { try { setResult(String(calculate(expression))); setError(""); } catch (cause) { setError(t(cause instanceof Error ? cause.message : "Invalid calculation")); setResult(""); } }
  function key(value: string) {
    if (value === "=") { equals(); return; }
    setError("");
    if (value === "AC") { setExpression(""); setResult(""); }
    else if (value === "⌫") setExpression(current => current.slice(0, -1));
    else setExpression(current => (result && ["+", "-", "×", "÷"].includes(value) ? result : current).concat(value).slice(0, 120));
    if (value !== "AC") setResult("");
    input.current?.focus();
  }
  return <dialog ref={dialog} className="pos-calculator" aria-label={t("Calculator")} onCancel={onClose}>
    <header><h2>{t("Calculator")}</h2><button type="button" onClick={onClose} aria-label={t("Close calculator")}><X size={18}/></button></header>
    <label>{t("Calculation")}<input ref={input} value={expression} maxLength={120} inputMode="decimal" placeholder="0" onChange={event => { setExpression(event.target.value); setResult(""); setError(""); }} onKeyDown={event => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); equals(); } }}/></label>
    <output aria-live="polite" aria-label={t("Calculation result")}>{result || "—"}</output>
    {error && <p role="alert">{error}</p>}
    <div className="pos-calculator-keys">{["AC", "(", ")", "⌫", "7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "-", "0", ".", "%", "+", "="].map(value => <button type="button" key={value} className={value === "=" ? "is-equals" : ""} aria-label={value === "⌫" ? t("Backspace") : value === "AC" ? t("Clear calculation") : value} onClick={() => key(value)}>{value === "⌫" ? <Delete size={18}/> : value}</button>)}</div>
    <small>{t("For quick calculations only. Sale amounts stay unchanged.")}</small>
  </dialog>;
}
