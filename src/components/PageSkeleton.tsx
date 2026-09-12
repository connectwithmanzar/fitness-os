export function PageSkeleton() {
  return (
    <div className="min-h-dvh bg-canvas px-5 pb-36 pt-4">
      <div className="flex items-center justify-between">
        <div className="h-8 w-36 animate-pulse rounded-control bg-inset" />
        <div className="h-12 w-12 animate-pulse rounded-full bg-inset" />
      </div>
      <div className="mt-6 h-36 animate-pulse rounded-card bg-raised" />
      <div className="mt-4 h-24 animate-pulse rounded-card bg-raised" />
      <div className="mt-4 h-44 animate-pulse rounded-card bg-raised" />
    </div>
  );
}
