"use client";

import type { InputHTMLAttributes } from "react";
import { keepNumeric } from "@/lib/forms/numeric-text";

/** Text field that accepts digits, or digits and one decimal point. */
export function NumericInput({
  decimal = false,
  onInput,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { decimal?: boolean }) {
  return (
    <input
      {...props}
      type="text"
      inputMode={decimal ? "decimal" : "numeric"}
      autoComplete={props.autoComplete ?? "off"}
      onInput={(event) => {
        keepNumeric(decimal)(event);
        onInput?.(event);
      }}
    />
  );
}
