export function Card({
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]",
        className
      ].join(" ")}
    >
      {children}
    </div>
  );
}
