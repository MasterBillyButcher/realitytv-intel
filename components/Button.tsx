import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium px-4 py-2 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus-ring";

const variants: Record<Variant, string> = {
  primary: "bg-accent-600 text-white hover:bg-accent-700",
  secondary: "bg-ink-100 text-ink-900 hover:bg-ink-200 border border-ink-300",
  danger: "bg-signal-down text-white hover:opacity-90",
  ghost: "bg-transparent text-ink-700 hover:bg-ink-100"
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", className = "", ...props },
  ref
) {
  return <button ref={ref} className={`${base} ${variants[variant]} ${className}`} {...props} />;
});
