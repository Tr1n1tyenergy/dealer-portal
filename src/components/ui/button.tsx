import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const primary = "bg-[var(--tri-yellow)] text-[var(--tri-ink)] hover:bg-[#ffd23a]";
const secondary = "bg-transparent text-[var(--tri-blue)] shadow-[inset_0_0_0_1.5px_rgba(56,83,164,0.45)] hover:bg-[rgba(56,83,164,0.06)]";
const quiet = "bg-transparent text-[var(--tri-blue)] hover:underline hover:decoration-[var(--tri-yellow)] underline-offset-4";
const destructive = "bg-transparent text-[var(--tri-problem)] shadow-[inset_0_0_0_1.5px_rgba(161,40,31,0.5)] hover:bg-[rgba(161,40,31,0.06)]";

/** Pill buttons (redesign spec §3). Old variant names stay as aliases so existing call sites keep working. */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-bold transition-[transform,background-color,box-shadow] duration-200 hover:-translate-y-px active:translate-y-px active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tri-blue)] disabled:pointer-events-none disabled:opacity-50 motion-reduce:transform-none motion-reduce:transition-none",
  {
    variants: {
      variant: { primary, secondary, quiet, destructive, default: primary, navy: secondary, outline: secondary, ghost: quiet, danger: destructive },
      size: {
        default: "h-11 px-5 text-[15px]",
        md: "h-11 px-5 text-[15px]",
        sm: "h-9 px-4 text-[13px]",
        lg: "h-12 px-7 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  )
);
Button.displayName = "Button";
