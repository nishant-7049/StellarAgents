import { ReactNode } from "react";
import clsx from "clsx";

interface CardProps {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}

export function Card({ children, className, glow }: CardProps) {
  return (
    <div className={clsx(
      "rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6",
      glow && "card-glow",
      className,
    )}>
      {children}
    </div>
  );
}
