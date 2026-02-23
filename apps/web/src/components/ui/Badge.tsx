import clsx from "clsx";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "info";
  className?: string;
}

export function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  return (
    <span className={clsx(
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", className,
      {
        "bg-[var(--accent)]/10 text-[var(--accent)]":  variant === "default",
        "bg-green-100 text-green-700":                  variant === "success",
        "bg-amber-100 text-amber-700":                  variant === "warning",
        "bg-red-100 text-red-700":                      variant === "error",
        "bg-blue-100 text-blue-700":                    variant === "info",
      }
    )}>
      {children}
    </span>
  );
}
