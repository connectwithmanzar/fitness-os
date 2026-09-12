"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="t-title2">Something went wrong</p>
      <button
        type="button"
        className="btn primary"
        style={{ maxWidth: 200 }}
        onClick={() => reset()}
      >
        Reload
      </button>
    </div>
  );
}
