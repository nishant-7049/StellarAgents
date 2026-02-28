import clsx from "clsx";

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={clsx("animate-spin rounded-full border-2 border-indigo-500 border-t-transparent h-5 w-5", className)} />
  );
}
