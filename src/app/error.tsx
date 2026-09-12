"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 bg-neutral-950 px-6 text-center">
      <p className="text-sm font-medium text-neutral-200">
        Something went wrong — Reload
      </p>
      <button
        type="button"
        className="tap-target min-h-12 rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-black transition active:scale-95"
        onClick={() => reset()}
      >
        Reload
      </button>
    </div>
  );
}
