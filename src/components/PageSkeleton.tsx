export function PageSkeleton() {
  return (
    <div>
      <div className="hdr">
        <div className="h-9 w-36 animate-pulse rounded-[10px] bg-[var(--surface)]" />
        <div className="h-9 w-9 animate-pulse rounded-full bg-[var(--surface)]" />
      </div>
      <div className="h-20 animate-pulse rounded-[14px] bg-[var(--surface)]" />
      <div className="mt-3 h-28 animate-pulse rounded-[14px] bg-[var(--surface)]" />
      <div className="mt-3 h-40 animate-pulse rounded-[14px] bg-[var(--surface)]" />
    </div>
  );
}
