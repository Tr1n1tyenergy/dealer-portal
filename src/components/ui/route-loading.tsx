/** Shown the moment a route is clicked, before that page's data returns. */
export function RouteLoading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="tri-route-loading" role="status" aria-live="polite" aria-busy="true">
      <span className="tri-route-loading__sr">{label}</span>
      <div className="tri-route-loading__bar" />
      <div className="tri-route-loading__card" />
      <div className="tri-route-loading__card tri-route-loading__card--short" />
      <style>{`
        .tri-route-loading { padding: 1.25rem 1.5rem 2rem; }
        .tri-route-loading__sr {
          position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
        }
        .tri-route-loading__bar,
        .tri-route-loading__card {
          border-radius: 0.85rem;
          background: linear-gradient(90deg, #e8eef6 0%, #f7f9fc 50%, #e8eef6 100%);
          background-size: 200% 100%;
          animation: tri-route-shimmer 1.1s ease-in-out infinite;
        }
        .tri-route-loading__bar { height: 1.6rem; width: min(16rem, 55%); margin-bottom: 1rem; }
        .tri-route-loading__card { height: 9rem; margin-bottom: 0.75rem; }
        .tri-route-loading__card--short { height: 5.5rem; width: 70%; }
        @keyframes tri-route-shimmer {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
      `}</style>
    </div>
  );
}
