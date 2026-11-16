"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLanguage } from "@/lib/i18n/language-provider";
import { sessionBoundary } from "@/lib/api/session-boundary";
import { PlatformError } from "./platform-client";
export function BillingProofForm({
  target,
  paymentId,
  onLock,
  onClose,
  onSaved,
}: {
  target: string;
  paymentId: string;
  onLock: (v: boolean) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLanguage(),
    dialog = useRef<HTMLDialogElement>(null),
    [file, setFile] = useState<File | null>(null),
    [reason, setReason] = useState(""),
    [saving, setSaving] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false);
  const attempt = useRef<{ file: File; reason: string; key: string } | null>(
      null,
    ),
    guard = useRef(false),
    live = useRef(false),
    controller = useRef<AbortController | null>(null),
    boundary = useRef<AbortSignal | null>(null),
    locked = saving || uncertain;
  useEffect(() => {
    live.current = true;
    controller.current = new AbortController();
    boundary.current = sessionBoundary.capture().signal;
    dialog.current?.showModal();
    return () => {
      live.current = false;
      controller.current?.abort();
    };
  }, []);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (guard.current || !confirm || !file || !controller.current) return;
    guard.current = true;
    setSaving(true);
    setError("");
    onLock(true);
    try {
      if (!attempt.current) {
        if (
          !["application/pdf", "image/png", "image/jpeg"].includes(file.type) ||
          file.size > 1048576 ||
          !file.size ||
          reason.trim().length < 5
        )
          throw new PlatformError(
            "Attach a PDF, PNG or JPEG of at most 1 MB and write a reason.",
            422,
          );
        attempt.current = {
          file,
          reason: reason.trim(),
          key: crypto.randomUUID(),
        };
      }
      const current = attempt.current,
        sessionSignal = boundary.current!;
      if (sessionSignal.aborted)
        throw new PlatformError("Session changed.", 409);
      const r = await fetch(
          "/api/backend/platform/shops/" +
            encodeURIComponent(target) +
            "/billing/payments/" +
            encodeURIComponent(paymentId) +
            "/proofs",
          {
            method: "POST",
            credentials: "same-origin",
            signal: AbortSignal.any([sessionSignal, controller.current.signal]),
            headers: {
              "Content-Type": current.file.type,
              "Idempotency-Key": current.key,
              "X-Proof-Name": encodeURIComponent(current.file.name),
              "X-Billing-Reason": encodeURIComponent(current.reason),
            },
            body: current.file,
          },
        ),
        v = await r.json();
      if (!live.current || sessionSignal.aborted) return;
      if (!r.ok || v.success !== true)
        throw new PlatformError(
          v.message ?? "Proof attachment failed.",
          r.status,
        );
      if (
        v.data?.targetTenantId !== target ||
        v.data?.paymentId !== paymentId ||
        typeof v.data?.id !== "string"
      )
        throw new PlatformError(
          "Proof result could not be verified. Retry the same request.",
          502,
        );
      onLock(false);
      onSaved();
    } catch (e) {
      if (!live.current) return;
      const unknown = !(e instanceof PlatformError) || e.status >= 500;
      setUncertain(unknown);
      onLock(unknown);
      if (!unknown) attempt.current = null;
      setError(e instanceof Error ? e.message : "Proof attachment failed.");
    } finally {
      guard.current = false;
      if (live.current) setSaving(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="platform-confirm billing-command"
      aria-label={t("Attach payment proof")}
      onCancel={(e) => {
        e.preventDefault();
        if (!locked) onClose();
      }}
    >
      <form onSubmit={save}>
        <h2>{t("Attach payment proof")}</h2>
        <p>{t("Private attachment. PDF, PNG or JPEG, up to 1 MB.")}</p>
        {error && <p role="alert">{t(error)}</p>}
        <fieldset disabled={locked}>
          <label>
            {t("Proof file")}
            <input
              autoFocus
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <label>
            {t("Billing reason")}
            <textarea
              required
              minLength={5}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <label className="platform-checkbox">
            <input
              type="checkbox"
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
            />
            <span>
              {t("I confirm this proof belongs to the selected payment.")}
            </span>
          </label>
        </fieldset>
        <footer>
          <button type="button" disabled={locked} onClick={onClose}>
            {t("Cancel")}
          </button>
          <button
            type="submit"
            disabled={saving || !confirm || !file || reason.trim().length < 5}
          >
            {t(
              saving
                ? "Saving…"
                : uncertain
                  ? "Retry same request"
                  : "Attach proof",
            )}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
