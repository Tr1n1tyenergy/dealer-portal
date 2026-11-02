import type { ReactNode } from "react";

/** A list with nothing in it yet: one sentence and the next action. */
export function EmptyState({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="ui-empty">
      <p>{title}</p>
      {action}
    </div>
  );
}

/** A grey placeholder in the shape of what is loading (no spinners). */
export function Skeleton({ className = "" }: { className?: string }) {
  return <span className={`ui-skeleton ${className}`} aria-hidden />;
}

/** Something failed: a plain message and, when it can help, a retry. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="ui-error" role="alert">
      <p>{message}</p>
      {onRetry ? (
        <button type="button" className="ui-btn ui-btn--secondary" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}
