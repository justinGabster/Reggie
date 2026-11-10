import { useEffect, useRef } from "react";
import { Button } from "@/components/ui";

type Props = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Native <dialog> confirmation (focus trap, Esc to cancel). Focus starts on Cancel, the safe choice. */
export default function ConfirmDeleteDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  busy,
  error,
  onConfirm,
  onCancel,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === "function") d.showModal();
      else d.setAttribute("open", "");
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby="confirm-delete-title"
      aria-describedby="confirm-delete-body"
      onCancel={(e) => {
        if (busy) e.preventDefault(); // don't close mid-request
      }}
      onClose={() => {
        if (open) onCancel();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel(); // backdrop click
      }}
    >
      <div className="rounded-t-[24px] border-2 border-b-0 border-line bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-fg sm:rounded-[24px] sm:border-b-2 sm:ledge">
        <h2 id="confirm-delete-title" className="text-2xl text-heading">
          {title}
        </h2>
        <p id="confirm-delete-body" className="mt-2 font-semibold leading-snug">
          {body}
        </p>
        {error && (
          <p role="alert" className="mt-3 rounded-xl border-2 border-error bg-error-fill px-3 py-2 text-sm font-bold text-error">
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onCancel} disabled={busy} autoFocus>
            {cancelLabel}
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
