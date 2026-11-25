"use client";

import { useFormStatus } from "react-dom";

export function PendingSubmit({
  className,
  children,
  pendingLabel,
  disabled,
}: {
  className: string;
  children: React.ReactNode;
  pendingLabel: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={className} type="submit" disabled={disabled || pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}
