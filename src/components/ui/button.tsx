import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-trinity-gold/40 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-trinity-gold text-trinity-navy shadow-[0_10px_22px_rgba(245,184,0,0.28)] hover:shadow-[0_14px_28px_rgba(245,184,0,0.36)] hover:-translate-y-0.5",
        navy: "bg-trinity-blue text-white shadow-[0_10px_22px_rgba(23,61,143,0.28)] hover:bg-[#1d47a3] hover:-translate-y-0.5",
        outline:
          "border border-trinity-blue/20 bg-transparent text-trinity-blue hover:bg-trinity-blue/5",
        ghost: "text-trinity-blue hover:bg-trinity-blue/5",
        danger: "bg-red-600 text-white hover:bg-red-700",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-xl px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
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
