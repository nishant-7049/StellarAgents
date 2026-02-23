"use client";
import { ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

export function Button({ variant = "primary", size = "md", className, children, ...props }: ButtonProps) {
  return (
    <button className={clsx(
      "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200",
      {
        "bg-indigo-600 hover:bg-indigo-500 text-white": variant === "primary",
        "bg-[var(--surface1)] hover:bg-[var(--surface0)] text-[var(--text-primary)] border border-[var(--border)]": variant === "secondary",
        "border border-indigo-500 text-indigo-400 hover:bg-indigo-500/10": variant === "outline",
        "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface1)]": variant === "ghost",
      },
      {
        "px-3 py-1.5 text-sm": size === "sm",
        "px-4 py-2 text-sm": size === "md",
        "px-6 py-3 text-base": size === "lg",
      },
      "disabled:opacity-50 disabled:cursor-not-allowed",
      className,
    )} {...props}>
      {children}
    </button>
  );
}
