"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Link> & {
  className?: string;
};

/**
 * Consistent "brand link" styling (Zaffre) used across the app.
 * Keeps visuals uniform without changing link behavior.
 */
export function BrandLink({ className, ...rest }: Props) {
  return (
    <Link
      {...rest}
      className={cn(
        "font-semibold text-[color:var(--brand)] hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--brand)]/10",
        className,
      )}
    />
  );
}

