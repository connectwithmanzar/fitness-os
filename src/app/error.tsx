"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
      <span className="os-dot" aria-hidden="true" />
      <p className="font-display text-lg font-semibold text-ink">Something went wrong</p>
      <button
        type="button"
        className="btn-primary max-w-48"
        onClick={() => reset()}
      >
        Reload
      </button>
    </div>
  );
}
