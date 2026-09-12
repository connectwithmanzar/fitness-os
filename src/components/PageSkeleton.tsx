export function PageSkeleton() {
  return (
    <div className="min-h-dvh bg-neutral-950 px-4 pb-36 pt-4">
      <div className="flex items-center justify-between">
        <div className="h-8 w-36 animate-pulse rounded-lg bg-neutral-800" />
        <div className="h-12 w-24 animate-pulse rounded-full bg-neutral-800" />
      </div>
      <div className="mt-6 h-28 animate-pulse rounded-2xl bg-neutral-900" />
      <div className="mt-4 h-44 animate-pulse rounded-2xl bg-neutral-900" />
      <div className="mt-4 h-44 animate-pulse rounded-2xl bg-neutral-900" />
    </div>
  );
}
