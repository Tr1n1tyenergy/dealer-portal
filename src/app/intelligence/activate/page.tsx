import { Suspense } from "react";
import ActivateClient from "./activate-client";

export default function ActivatePage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center text-sm text-slate-500">
          Loading...
        </div>
      }
    >
      <ActivateClient />
    </Suspense>
  );
}
