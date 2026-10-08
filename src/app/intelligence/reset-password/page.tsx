import { Suspense } from "react";
import ResetClient from "./reset-client";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center text-sm text-slate-500">
          Loading...
        </div>
      }
    >
      <ResetClient />
    </Suspense>
  );
}
