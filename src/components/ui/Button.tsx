import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(props, ref) {
  const variant = props.variant ?? "secondary";
  const size = props.size ?? "md";

  const base =
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold shadow-sm transition focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60";

  const sizes =
    size === "sm" ? "px-3 py-2 text-sm" : "px-4 py-2.5 text-sm md:text-[15px]";

  const variants =
    variant === "primary"
      ? "bg-[#FF5F1F] text-white hover:bg-[#e24f16] focus:ring-[#FF5F1F]/20"
      : variant === "danger"
        ? "border border-red-200 bg-white text-red-800 hover:bg-red-50 focus:ring-red-500/15"
        : variant === "ghost"
          ? "bg-transparent text-slate-800 hover:bg-slate-100 focus:ring-slate-500/15"
          : "border border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50 focus:ring-[#0818A8]/10";

  const { className, leftIcon, rightIcon, children, ...rest } = props;
  return (
    <button ref={ref} className={cn(base, sizes, variants, className)} {...rest}>
      {leftIcon ? <span className="shrink-0">{leftIcon}</span> : null}
      <span className="min-w-0 truncate">{children}</span>
      {rightIcon ? <span className="shrink-0">{rightIcon}</span> : null}
    </button>
  );
});
