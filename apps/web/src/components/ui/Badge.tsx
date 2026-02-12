import clsx from "clsx";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "info";
}

export function Badge({ children, variant = "default" }: BadgeProps) {
  return (
    <span className={clsx(
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
      {
        "bg-indigo-500/20 text-indigo-300": variant === "default",
        "bg-green-500/20 text-green-300": variant === "success",
        "bg-yellow-500/20 text-yellow-300": variant === "warning",
        "bg-red-500/20 text-red-300": variant === "error",
        "bg-blue-500/20 text-blue-300": variant === "info",
      }
    )}>
      {children}
    </span>
  );
}
