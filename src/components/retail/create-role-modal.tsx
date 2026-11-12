"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Shield, UserRound, X } from "lucide-react";

export function CreateRoleModal({
  open,
  busy,
  error,
  onClose,
  onCreate,
}: {
  open: boolean;
  busy: boolean;
  error: string;
  onClose: () => void;
  onCreate: (input: { name: string; description: string }) => Promise<void> | void;
}) {
  const titleId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    const t = window.setTimeout(() => nameRef.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, busy, onClose]);

  if (!open) return null;

  return (
    <div className="ru-modal-root" role="presentation">
      <button type="button" className="ru-modal-backdrop" aria-label="Close dialog" onClick={() => !busy && onClose()} />
      <div className="ru-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <button type="button" className="ru-modal__close" aria-label="Close" onClick={() => !busy && onClose()}>
          <X size={16} strokeWidth={2} />
        </button>
        <div className="ru-modal__head">
          <span className="ru-modal__icon" aria-hidden>
            <Shield size={18} strokeWidth={1.75} />
          </span>
          <div>
            <h2 id={titleId}>Create Role</h2>
            <p>Create a new role for internal staff and assign permissions after.</p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onCreate({ name: name.trim(), description: description.trim() });
          }}
        >
          <div className="ru-modal__field">
            <label htmlFor="create-role-name">
              Role Name<em>*</em>
            </label>
            <div className="ru-modal__control">
              <UserRound size={15} strokeWidth={1.75} aria-hidden />
              <input
                id="create-role-name"
                ref={nameRef}
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Finance Officer"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="ru-modal__field">
            <label htmlFor="create-role-desc">Description (Optional)</label>
            <div className="ru-modal__control">
              <textarea
                id="create-role-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="E.g. Access to orders, reports, and analytics only."
                maxLength={500}
              />
            </div>
          </div>

          {error ? <div className="ru-modal__error">{error}</div> : null}

          <div className="ru-modal__foot">
            <button type="button" className="ru-btn ru-btn--ghost" disabled={busy} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="ru-btn ru-btn--gold" disabled={busy || !name.trim()}>
              Create Role
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
