"use client";
import { InputHTMLAttributes } from "react";
import clsx from "clsx";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, className, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm text-[var(--text-secondary)]">{label}</label>}
      <input className={clsx(
        "rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm text-white",
        "focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500",
        "placeholder:text-[var(--text-secondary)]/50",
        className,
      )} {...props} />
    </div>
  );
}
