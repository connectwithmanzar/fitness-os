"use client";

import { useEffect, useState } from "react";
import type { MuscleGroup } from "@/lib/exerciseDatabase";

const MUSCLE_FILL: Record<MuscleGroup, string> = {
  Chest: "#34d399",
  Back: "#22d3ee",
  Legs: "#a78bfa",
  Shoulders: "#fbbf24",
  Arms: "#fb7185",
  Core: "#4ade80",
};

export function MuscleFallback({
  muscle,
  className,
}: {
  muscle: MuscleGroup;
  className?: string;
}) {
  const fill = MUSCLE_FILL[muscle];
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="12" fill="#171717" />
      <path
        d="M32 10c3 0 5 2 6 5 4 1 8 4 10 8 1 2 1 5-1 6-2 8-6 16-15 22-9-6-13-14-15-22-2-1-2-4-1-6 2-4 6-7 10-8 1-3 3-5 6-5z"
        fill="#262626"
      />
      {muscle === "Chest" ? (
        <path d="M20 28c4-3 8-3 12-1 4-2 8-2 12 1 0 6-5 10-12 12-7-2-12-6-12-12z" fill={fill} />
      ) : null}
      {muscle === "Back" ? (
        <path d="M18 24c5 2 9 3 14 3s9-1 14-3c-1 10-6 18-14 24-8-6-13-14-14-24z" fill={fill} />
      ) : null}
      {muscle === "Shoulders" ? (
        <>
          <circle cx="16" cy="24" r="7" fill={fill} />
          <circle cx="48" cy="24" r="7" fill={fill} />
        </>
      ) : null}
      {muscle === "Arms" ? (
        <>
          <rect x="8" y="22" width="8" height="22" rx="4" fill={fill} />
          <rect x="48" y="22" width="8" height="22" rx="4" fill={fill} />
        </>
      ) : null}
      {muscle === "Core" ? (
        <rect x="24" y="28" width="16" height="18" rx="4" fill={fill} />
      ) : null}
      {muscle === "Legs" ? (
        <>
          <rect x="20" y="36" width="8" height="20" rx="4" fill={fill} />
          <rect x="36" y="36" width="8" height="20" rx="4" fill={fill} />
        </>
      ) : null}
    </svg>
  );
}

export function ExerciseThumb({
  name,
  muscle,
  gifUrl,
  stillUrl,
  className,
  eager = false,
}: {
  name: string;
  muscle: MuscleGroup;
  gifUrl: string;
  stillUrl?: string;
  className?: string;
  eager?: boolean;
}) {
  const [stage, setStage] = useState<"gif" | "still" | "fallback">("gif");
  const src = stage === "still" && stillUrl ? stillUrl : gifUrl;

  useEffect(() => {
    setStage("gif");
  }, [gifUrl, stillUrl]);

  if (!gifUrl || stage === "fallback") {
    return <MuscleFallback muscle={muscle} className={className} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote looping demo GIFs
    <img
      src={src}
      alt={`${name} demonstration`}
      loading={eager ? "eager" : "lazy"}
      className={`bg-neutral-900 ${className ?? ""}`}
      onError={() => {
        if (stage === "gif" && stillUrl && stillUrl !== gifUrl) {
          setStage("still");
          return;
        }
        setStage("fallback");
      }}
    />
  );
}
