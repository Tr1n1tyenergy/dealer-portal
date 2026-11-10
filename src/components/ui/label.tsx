import * as React from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={cn("mb-1.5 block text-[13px] font-bold text-[var(--tri-ink)]", className)}
      {...props}
    />
  );
}
