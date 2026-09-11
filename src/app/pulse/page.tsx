"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, Check, Dumbbell } from "lucide-react";

import { historyHasWorkoutToday } from "@/lib/workout-history";

const MEAL_STORAGE_KEY = "local_meal_logs";
const WORKOUT_STORAGE_KEY = "active_workout_session";
const LAST_WORKOUT_KEY = "last_completed_workout";
const BEDTIME_STORAGE_KEY = "bedtime_supplements";

const TARGETS = {
  calories: 2200,
  protein_g: 150,
  carbs_g: 250,
  fats_g: 65,
  magnesium_mg: 400,
  vitamin_d_iu: 2000,
  zinc_mg: 11,
  calcium_mg: 1000,
} as const;

type Micronutrients = {
  iron_mg: number;
  zinc_mg: number;
  magnesium_mg: number;
  vitamin_d_iu: number;
  calcium_mg: number;
};

type MealLog = {
  id: string;
  meal_name: string;
  logged_at: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  micronutrients: Micronutrients;
};

type WorkoutSession = {
  startedAt?: string;
  finishedAt?: string | null;
  exercises?: Array<{
    sets: Array<{ completed: boolean }>;
  }>;
};

type SupplementId = "whey" | "magnesium" | "vitamin-d";

type BedtimeStore = {
  day: string;
  ids: SupplementId[];
};

type ProgressTone = "emerald" | "amber" | "red";

function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sameDay(iso: string, key: string): boolean {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  return dayKey(date) === key;
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isMealLog(value: unknown): value is MealLog {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as MealLog;
  return (
    typeof record.id === "string" &&
    typeof record.logged_at === "string" &&
    typeof record.calories === "number"
  );
}

function loadMeals(today: string): MealLog[] {
  try {
    const raw = window.localStorage.getItem(MEAL_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isMealLog).filter((log) => sameDay(log.logged_at, today));
  } catch {
    return [];
  }
}

function workoutLoggedToday(today: string): boolean {
  try {
    if (historyHasWorkoutToday(today)) {
      return true;
    }

    const lastCompleted = window.localStorage.getItem(LAST_WORKOUT_KEY);
    if (lastCompleted && sameDay(lastCompleted, today)) {
      return true;
    }

    const raw = window.localStorage.getItem(WORKOUT_STORAGE_KEY);
    if (!raw) {
      return false;
    }
    const session = JSON.parse(raw) as WorkoutSession;
    const stamp = session.finishedAt ?? session.startedAt;
    const hasWork =
      Boolean(session.finishedAt) ||
      Boolean(
        session.exercises?.some((exercise) =>
          exercise.sets.some((set) => set.completed)
        )
      );
    return Boolean(stamp && hasWork && sameDay(stamp, today));
  } catch {
    return false;
  }
}

function loadTaken(today: string): SupplementId[] {
  try {
    const raw = window.localStorage.getItem(BEDTIME_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as BedtimeStore;
    if (parsed.day !== today || !Array.isArray(parsed.ids)) {
      return [];
    }
    return parsed.ids.filter(
      (id): id is SupplementId =>
        id === "whey" || id === "magnesium" || id === "vitamin-d"
    );
  } catch {
    return [];
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function percent(consumed: number, target: number): number {
  if (target <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((consumed / target) * 100));
}

function tone(value: number): ProgressTone {
  if (value >= 80) {
    return "emerald";
  }
  if (value >= 40) {
    return "amber";
  }
  return "red";
}

function toneClass(value: ProgressTone): string {
  if (value === "emerald") {
    return "bg-emerald-500";
  }
  if (value === "amber") {
    return "bg-amber-400";
  }
  return "bg-red-500";
}

function formatAmount(value: number, digits = 0): string {
  return value.toLocaleString("en-IN", { maximumFractionDigits: digits });
}

export default function PulsePage() {
  const today = useMemo(() => new Date(), []);
  const todayKey = dayKey(today);
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [trainingToday, setTrainingToday] = useState(false);
  const [taken, setTaken] = useState<SupplementId[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setMeals(loadMeals(todayKey));
    setTrainingToday(workoutLoggedToday(todayKey));
    setTaken(loadTaken(todayKey));
    setHydrated(true);
  }, [todayKey]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    const payload: BedtimeStore = { day: todayKey, ids: taken };
    window.localStorage.setItem(BEDTIME_STORAGE_KEY, JSON.stringify(payload));
  }, [hydrated, taken, todayKey]);

  const totals = useMemo(() => {
    return meals.reduce(
      (acc, log) => ({
        calories: acc.calories + asNumber(log.calories),
        protein_g: acc.protein_g + asNumber(log.protein_g),
        carbs_g: acc.carbs_g + asNumber(log.carbs_g),
        fats_g: acc.fats_g + asNumber(log.fats_g),
        magnesium_mg: acc.magnesium_mg + asNumber(log.micronutrients?.magnesium_mg),
        vitamin_d_iu: acc.vitamin_d_iu + asNumber(log.micronutrients?.vitamin_d_iu),
        zinc_mg: acc.zinc_mg + asNumber(log.micronutrients?.zinc_mg),
        calcium_mg: acc.calcium_mg + asNumber(log.micronutrients?.calcium_mg),
      }),
      {
        calories: 0,
        protein_g: 0,
        carbs_g: 0,
        fats_g: 0,
        magnesium_mg: 0,
        vitamin_d_iu: 0,
        zinc_mg: 0,
        calcium_mg: 0,
      }
    );
  }, [meals]);

  const macros = [
    {
      label: "Calories",
      consumed: totals.calories,
      target: TARGETS.calories,
      unit: "kcal",
    },
    {
      label: "Protein",
      consumed: totals.protein_g,
      target: TARGETS.protein_g,
      unit: "g",
    },
    {
      label: "Carbs",
      consumed: totals.carbs_g,
      target: TARGETS.carbs_g,
      unit: "g",
    },
    {
      label: "Fats",
      consumed: totals.fats_g,
      target: TARGETS.fats_g,
      unit: "g",
    },
  ];

  const micros = [
    {
      name: "Magnesium",
      consumed: totals.magnesium_mg,
      target: TARGETS.magnesium_mg,
      unit: "mg",
    },
    {
      name: "Vitamin D",
      consumed: totals.vitamin_d_iu,
      target: TARGETS.vitamin_d_iu,
      unit: "IU",
    },
    {
      name: "Zinc",
      consumed: totals.zinc_mg,
      target: TARGETS.zinc_mg,
      unit: "mg",
    },
    {
      name: "Calcium",
      consumed: totals.calcium_mg,
      target: TARGETS.calcium_mg,
      unit: "mg",
    },
  ];

  const prescriptions: Array<{ id: SupplementId; title: string; detail: string }> =
    [];
  if (totals.protein_g < TARGETS.protein_g) {
    prescriptions.push({
      id: "whey",
      title: "1 Scoop Whey Isolate",
      detail: `Protein is ${formatAmount(totals.protein_g, 1)}g / ${TARGETS.protein_g}g`,
    });
  }
  if (percent(totals.magnesium_mg, TARGETS.magnesium_mg) < 50) {
    prescriptions.push({
      id: "magnesium",
      title: "Magnesium Glycinate (400mg) before bed",
      detail: `Magnesium is ${formatAmount(totals.magnesium_mg, 1)}mg / ${TARGETS.magnesium_mg}mg`,
    });
  }
  if (percent(totals.vitamin_d_iu, TARGETS.vitamin_d_iu) < 50) {
    prescriptions.push({
      id: "vitamin-d",
      title: "Vitamin D3 + K2",
      detail: `Vitamin D is ${formatAmount(totals.vitamin_d_iu, 1)} IU / ${TARGETS.vitamin_d_iu} IU`,
    });
  }

  const readiness = Math.round(
    (macros.reduce((sum, item) => sum + percent(item.consumed, item.target), 0) /
      macros.length) *
      0.7 +
      (trainingToday ? 30 : 0)
  );

  const toggleTaken = (id: SupplementId) => {
    setTaken((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  return (
    <section className="mx-auto min-h-screen max-w-md bg-neutral-950 px-4 pb-36 pt-6 font-sans text-neutral-50">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-400" />
            <h1 className="text-2xl font-semibold tracking-tight">The Pulse</h1>
          </div>
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">
            {formatDate(today)}
          </p>
        </div>
        <div className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
          Readiness Score: {readiness}%
        </div>
      </header>

      <section className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900/80 p-4">
        <h2 className="text-sm font-semibold">Macro Radar</h2>
        <div className="mt-4 flex flex-col gap-4">
          {macros.map((macro) => {
            const value = percent(macro.consumed, macro.target);
            return (
              <div key={macro.label}>
                <div className="flex items-center justify-between text-sm">
                  <span>{macro.label}</span>
                  <span className="font-mono text-xs text-neutral-400">
                    {formatAmount(macro.consumed, macro.label === "Calories" ? 0 : 1)} /{" "}
                    {formatAmount(macro.target)} {macro.unit}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-800">
                  <div
                    className={`h-full rounded-full ${toneClass(tone(value))}`}
                    style={{ width: `${value}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-5">
        <h2 className="text-sm font-semibold">Micronutrient Health</h2>
        <div className="mt-3 grid grid-cols-1 gap-3">
          {micros.map((marker) => {
            const value = percent(marker.consumed, marker.target);
            const deficit = value < 50;
            return (
              <article
                key={marker.name}
                className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold">{marker.name}</h3>
                  {deficit ? (
                    <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-300">
                      Deficit Alert
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 font-mono text-xs text-neutral-400">
                  {formatAmount(marker.consumed, 1)}
                  {marker.unit} / {formatAmount(marker.target)}
                  {marker.unit}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-800">
                  <div
                    className={`h-full rounded-full ${deficit ? "bg-red-500" : "bg-emerald-500"}`}
                    style={{ width: `${value}%` }}
                  />
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-5">
        <h2 className="text-sm font-semibold">Actionable Bedtime Checklist</h2>
        {prescriptions.length === 0 ? (
          <div className="mt-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            All critical nutritional baselines met through diet. No extra supplements
            required tonight.
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {prescriptions.map((item) => {
              const checked = taken.includes(item.id);
              return (
                <article
                  key={item.id}
                  className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-4"
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleTaken(item.id)}
                      className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-md border transition active:scale-98 ${
                        checked
                          ? "border-emerald-500 bg-emerald-500 text-black"
                          : "border-neutral-700 bg-neutral-950 text-transparent"
                      }`}
                      aria-pressed={checked}
                      aria-label={`Mark ${item.title} taken`}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <div>
                      <h3
                        className={`text-sm font-semibold ${
                          checked ? "text-neutral-400 line-through" : "text-neutral-50"
                        }`}
                      >
                        {item.title}
                      </h3>
                      <p className="mt-1 text-xs text-neutral-500">{item.detail}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-5 rounded-xl border border-neutral-800 bg-neutral-900/80 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Daily Session Sync</h2>
            <p className="mt-2 text-sm text-neutral-300">
              Today&apos;s Training:{" "}
              <span className={trainingToday ? "text-emerald-400" : "text-amber-300"}>
                {trainingToday ? "Workout Completed" : "No Session Logged Yet"}
              </span>
            </p>
          </div>
          <Dumbbell className="h-5 w-5 text-neutral-500" />
        </div>
        {!trainingToday ? (
          <Link
            href="/"
            className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-neutral-700 py-2.5 text-sm font-medium text-neutral-200 transition hover:border-emerald-500 hover:text-emerald-300 active:scale-98"
          >
            Start a workout
          </Link>
        ) : (
          <Link
            href="/"
            className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-neutral-700 py-2.5 text-sm font-medium text-neutral-200 transition hover:border-emerald-500 hover:text-emerald-300 active:scale-98"
          >
            Open Workout Logger
          </Link>
        )}
      </section>
    </section>
  );
}
