"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AlertCircle, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-provider";

export function OperationsDialog({ title, description, icon, children, actions, onClose, onSubmit, busy, error, note, compact = false }: {
  title: string; description?: string; icon?: ReactNode; children: ReactNode; actions: ReactNode;
  onClose: () => void; onSubmit?: () => void | Promise<void>; busy?: boolean; error?: string; note?: string; compact?: boolean;
}) {
  const { t } = useLanguage();
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => { if (error) body.current?.scrollTo({ top: 0 }); }, [error]);
  return <div className="sales-backdrop" role="presentation" onClick={() => { if (!busy) onClose(); }}>
    <section className={`supplier-dialog panel operations-dialog${compact ? " operations-dialog-compact" : ""}`} role="dialog" aria-modal="true" aria-label={title} onClick={event => event.stopPropagation()}>
      <header className="operations-dialog-heading">
        {icon && <span className="operations-dialog-icon">{icon}</span>}
        <div><h2>{title}</h2>{description && <p>{description}</p>}</div>
        <button type="button" disabled={busy} className="purchase-close" aria-label={t("Close")} onClick={onClose}><X size={19}/></button>
      </header>
      <form className="operations-dialog-form" noValidate onSubmit={event => { event.preventDefault(); if (!busy) void onSubmit?.(); }}>
        <div ref={body} className="operations-dialog-body">
          {error && <div className="operations-form-error" role="alert"><AlertCircle size={17}/><span>{t(error)}</span></div>}
          {children}
        </div>
        <footer className="operations-dialog-footer">
          {note && <span>{note}</span>}
          <button type="button" className="purchase-save-pending" disabled={busy} onClick={onClose}>{t("Cancel")}</button>
          {actions}
        </footer>
      </form>
    </section>
  </div>;
}
