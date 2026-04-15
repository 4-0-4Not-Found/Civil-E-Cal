"use client";

import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { modalOverlayClass, modalPanelClass, modalSubtitleClass, modalTitleClass, useModalA11y } from "@/components/ui/modal";

function WarningIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      aria-hidden
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

/**
 * Accessible in-app confirm dialog (replaces `window.confirm` for styled flows).
 */
export function ConfirmDialog(props: {
  open: boolean;
  /** Small "app says" label (UI only). */
  contextLabel?: string;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Strong red styling for the confirm action */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const {
    open,
    contextLabel,
    title,
    description,
    confirmLabel,
    cancelLabel: cancelLabelProp,
    destructive,
    onConfirm,
    onCancel,
  } = props;
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y({
    open,
    onClose: onCancel,
    initialFocusRef: cancelRef,
    containerRef: dialogRef,
  });

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const cancelLabel = cancelLabelProp ?? "Cancel";

  return createPortal(
    <div className="not-print fixed inset-0 z-[95] flex items-center justify-center p-4">
      <button
        type="button"
        className={modalOverlayClass}
        aria-label="Dismiss dialog"
        onClick={onCancel}
      />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        ref={dialogRef}
        className={cn(
          modalPanelClass,
          "max-w-md p-6",
          "dark:border-slate-700 dark:bg-slate-900",
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {contextLabel ? (
          <p className="text-xs font-semibold text-slate-500">
            {contextLabel} says
          </p>
        ) : null}
        <div className="flex items-start gap-4">
          <div
            className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
            aria-hidden
          >
            <WarningIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className={cn(modalTitleClass, "text-lg dark:text-slate-50")}>
              {title}
            </h2>
            <div id={descId} className={cn(modalSubtitleClass, "text-sm dark:text-slate-300")}>
              {description}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button
            ref={cancelRef}
            type="button"
            variant="secondary"
            onClick={onCancel}
            className="rounded-full px-5"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? "danger" : "primary"}
            onClick={onConfirm}
            className={cn(
              "rounded-full px-5",
              destructive
                ? "border-0 bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500/30 dark:bg-red-600 dark:hover:bg-red-700"
                : null,
            )}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  , document.body);
}
