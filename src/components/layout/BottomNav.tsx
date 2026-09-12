"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Activity, Play, Square, Utensils } from "lucide-react";
import { FITNESS_DATA_CHANGED_EVENT, WORKOUT_SESSION_CHANGED_EVENT } from "@/lib/fitness-events";

const SESSION_KEY = "active_workout_session";

function hasActiveSession(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) {
      return false;
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return false;
    }
    const finishedAt = (parsed as { finishedAt?: string | null }).finishedAt;
    return !finishedAt;
  } catch {
    return false;
  }
}

export function BottomNav() {
  const pathname = usePathname();
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    const sync = () => setRecording(hasActiveSession());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(FITNESS_DATA_CHANGED_EVENT, sync);
    window.addEventListener(WORKOUT_SESSION_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(FITNESS_DATA_CHANGED_EVENT, sync);
      window.removeEventListener(WORKOUT_SESSION_CHANGED_EVENT, sync);
    };
  }, [pathname]);

  const todayOn = pathname === "/pulse" || pathname.startsWith("/pulse/");
  const trainOn = pathname === "/";
  const eatOn = pathname === "/diet" || pathname.startsWith("/diet/");

  return (
    <nav id="tabbar" aria-label="Primary">
      <Link href="/pulse" prefetch className={todayOn ? "on" : undefined}>
        <Activity className="icn" strokeWidth={todayOn ? 2 : 1.65} />
        Today
      </Link>
      <Link
        href="/"
        prefetch
        className={`start ${recording ? "rec" : ""} ${trainOn ? "on" : ""}`}
      >
        <span className="cir" aria-hidden="true">
          {recording ? (
            <Square className="icn" strokeWidth={2} />
          ) : (
            <Play className="icn" strokeWidth={2} />
          )}
        </span>
        <span>{recording ? "Session" : "Train"}</span>
      </Link>
      <Link href="/diet" prefetch className={eatOn ? "on" : undefined}>
        <Utensils className="icn" strokeWidth={eatOn ? 2 : 1.65} />
        Eat
      </Link>
    </nav>
  );
}
