import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-xl border border-[var(--tri-line)] bg-white px-3.5 text-base text-[var(--tri-ink)] transition placeholder:text-[var(--tri-soft)] focus-visible:outline-none focus-visible:border-[var(--tri-blue)] focus-visible:ring-2 focus-visible:ring-[rgba(56,83,164,0.2)] aria-[invalid=true]:border-[#a1281f] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = "Input";
