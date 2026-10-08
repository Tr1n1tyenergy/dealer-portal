import { cn } from "@/lib/utils";

/**
 * Real Trinity Energy logos used on the Kenya marketing site header:
 * - dark backgrounds / blue header → white-logo.png
 * - light backgrounds → logo.png
 */
export function TrinityLogo({
  className,
  variant = "light",
  height = 42,
}: {
  className?: string;
  variant?: "light" | "dark";
  height?: number;
}) {
  const src =
    variant === "light"
      ? "/assets2/img/white-logo.png"
      : "/assets2/img/logo.png";

  return (
    <img
      src={src}
      alt="Trinity Energy"
      height={height}
      className={cn("w-auto object-contain", className)}
      style={{ height }}
    />
  );
}
