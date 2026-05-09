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
        "rounded-[32px] border border-[rgb(var(--border))] bg-[rgb(var(--surface))]/82 shadow-[0_26px_100px_rgba(0,0,0,0.14)] backdrop-blur-2xl",
        className
      ].join(" ")}
    >
      {children}
    </div>
  );
}