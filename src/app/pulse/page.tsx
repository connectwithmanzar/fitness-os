"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, Check, ChevronDown, Dumbbell, Moon } from "lucide-react";
import { AccountButton, AuthModal } from "@/components/AuthModal";
import { parseMealScanResult } from "@/lib/diet-parse";
import type { MealLog } from "@/lib/diet-types";
import {
  PULSE_CALORIE_TARGET,
  PULSE_CARBS_TARGET_G,
  PULSE_FATS_TARGET_G,
  PULSE_FIBER_TARGET_G,
  PULSE_PROTEIN_TARGET_G,
} from "@/lib/pulse-baselines";
import {
  aggregateMealTotals,
  bedtimeHighlights,
  buildMacroProgress,
  buildMicroMarkers,
  buildSmartRecommendations,
  remainingOf,
} from "@/lib/pulse-engine";
import { getSupabase } from "@/lib/supabaseClient";

const WORKOUT_HISTORY_KEY = "workout_history";
const DIET_LOGS_KEY = "diet_logs";
const LOCAL_MEAL_LOGS_KEY = "local_meal_logs";
const BEDTIME_STORAGE_KEY = "pulse_bedtime_checks";
const PROTEIN_HIT_G = 120;

const TARGETS = {
  calories: PULSE_CALORIE_TARGET,
  protein_g: PULSE_PROTEIN_TARGET_G,
  carbs_g: PULSE_CARBS_TARGET_G,
  fats_g: PULSE_FATS_TARGET_G,
  fiber_g: PULSE_FIBER_TARGET_G,
} as const;

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"] as const;

const BEDTIME_ITEMS = [
  {
    id: "magnesium",
    title: "Magnesium Glycinate",
    detail: "400mg before bed for recovery and sleep quality",
  },
  {
    id: "ashwagandha",
    title: "Ashwagandha",
    detail: "Adaptogen support for cortisol and readiness",
  },
  {
    id: "electrolytes",
    title: "Electrolyte Hydration",
    detail: "500ml water + electrolytes after training",
  },
  {
    id: "sleep",
    title: "8h Sleep target",
    detail: "Protect recovery, GH pulse, and next-day output",
  },
] as const;

type BedtimeId = (typeof BEDTIME_ITEMS)[number]["id"];
type ProteinAdherence = "hit" | "partial" | "none";

type HistorySet = {
  id: string;
  setNumber: number;
  weightKg: string;
  reps: string;
  completed: boolean;
};

type HistoryExercise = {
  id: string;
  name: string;
  sets: HistorySet[];
};

type CompletedWorkout = {
  id: string;
  name: string;
  completedAt: string;
  exercises: HistoryExercise[];
};

type DietLog = MealLog;

type DayTrend = {
  key: string;
  label: string;
  volumeKg: number;
  setsCompleted: number;
  workoutCompleted: boolean;
  calories: number;
  protein_g: number;
  hasFood: boolean;
  proteinAdherence: ProteinAdherence;
};

type BedtimeStore = {
  day: string;
  ids: BedtimeId[];
};

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

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseHistorySet(value: unknown): HistorySet | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = asString(value.id);
  if (!id || typeof value.setNumber !== "number") {
    return null;
  }
  return {
    id,
    setNumber: value.setNumber,
    weightKg: typeof value.weightKg === "string" ? value.weightKg : "0",
    reps: typeof value.reps === "string" ? value.reps : "0",
    completed: value.completed === true,
  };
}

function parseHistoryExercise(value: unknown): HistoryExercise | null {
  if (!isRecord(value) || !Array.isArray(value.sets)) {
    return null;
  }
  const id = asString(value.id);
  const name = asString(value.name);
  if (!id || !name) {
    return null;
  }
  return {
    id,
    name,
    sets: value.sets
      .map(parseHistorySet)
      .filter((set): set is HistorySet => set !== null),
  };
}

function parseCompletedWorkout(value: unknown): CompletedWorkout | null {
  if (!isRecord(value) || !Array.isArray(value.exercises)) {
    return null;
  }
  const id = asString(value.id);
  const name = asString(value.name);
  const completedAt = asString(value.completedAt);
  if (!id || !name || !completedAt) {
    return null;
  }
  return {
    id,
    name,
    completedAt,
    exercises: value.exercises
      .map(parseHistoryExercise)
      .filter((exercise): exercise is HistoryExercise => exercise !== null),
  };
}

function parseDietLog(value: unknown): DietLog | null {
  if (!isRecord(value)) {
    return null;
  }
  const loggedAt = asString(value.logged_at) ?? asString(value.created_at);
  if (!loggedAt) {
    return null;
  }
  const query = asString(value.query) ?? asString(value.meal_name) ?? "Meal";
  const scanned = parseMealScanResult(value, query);
  if (!scanned) {
    return null;
  }
  return {
    ...scanned,
    id: asString(value.id) ?? `${loggedAt}-${Math.random().toString(16).slice(2)}`,
    query,
    logged_at: loggedAt,
  };
}

function readJsonArray(storageKey: string): unknown[] {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadWorkoutHistory(): CompletedWorkout[] {
  return readJsonArray(WORKOUT_HISTORY_KEY)
    .map(parseCompletedWorkout)
    .filter((entry): entry is CompletedWorkout => entry !== null)
    .sort(
      (left, right) =>
        new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime()
    );
}

function loadDietLogs(): DietLog[] {
  const merged = [
    ...readJsonArray(DIET_LOGS_KEY),
    ...readJsonArray(LOCAL_MEAL_LOGS_KEY),
  ];
  const unique = new Map<string, DietLog>();
  for (const item of merged) {
    const parsed = parseDietLog(item);
    if (parsed) {
      unique.set(parsed.id, parsed);
    }
  }
  return Array.from(unique.values());
}

function isBedtimeId(value: unknown): value is BedtimeId {
  return (
    value === "magnesium" ||
    value === "ashwagandha" ||
    value === "electrolytes" ||
    value === "sleep"
  );
}

function loadBedtimeChecks(today: string): BedtimeId[] {
  try {
    const raw = window.localStorage.getItem(BEDTIME_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as BedtimeStore;
    if (parsed.day !== today || !Array.isArray(parsed.ids)) {
      return [];
    }
    return parsed.ids.filter(isBedtimeId);
  } catch {
    return [];
  }
}

function lastSevenDays(end: Date): Date[] {
  const days: Date[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(end);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    days.push(date);
  }
  return days;
}

function completedSetCount(workout: CompletedWorkout): number {
  return workout.exercises.reduce(
    (total, exercise) =>
      total + exercise.sets.filter((set) => set.completed).length,
    0
  );
}

function totalVolumeKg(workout: CompletedWorkout): number {
  return workout.exercises.reduce((total, exercise) => {
    return (
      total +
      exercise.sets.reduce((setTotal, set) => {
        if (!set.completed) {
          return setTotal;
        }
        const weight = Number(set.weightKg);
        const reps = Number(set.reps);
        if (!Number.isFinite(weight) || !Number.isFinite(reps)) {
          return setTotal;
        }
        return setTotal + weight * reps;
      }, 0)
    );
  }, 0);
}

function buildWeekTrends(
  end: Date,
  meals: DietLog[],
  workouts: CompletedWorkout[]
): DayTrend[] {
  return lastSevenDays(end).map((date) => {
    const key = dayKey(date);
    const dayMeals = meals.filter((log) => sameDay(log.logged_at, key));
    const dayWorkouts = workouts.filter((entry) => sameDay(entry.completedAt, key));
    const calories = dayMeals.reduce((sum, log) => sum + log.calories, 0);
    const protein_g = dayMeals.reduce((sum, log) => sum + log.protein_g, 0);
    const volumeKg = dayWorkouts.reduce((sum, entry) => sum + totalVolumeKg(entry), 0);
    const setsCompleted = dayWorkouts.reduce(
      (sum, entry) => sum + completedSetCount(entry),
      0
    );
    const hasFood = dayMeals.length > 0;
    const proteinAdherence: ProteinAdherence = !hasFood
      ? "none"
      : protein_g >= PROTEIN_HIT_G
        ? "hit"
        : "partial";

    return {
      key,
      label: DAY_LETTERS[date.getDay()] ?? "—",
      volumeKg,
      setsCompleted,
      workoutCompleted: dayWorkouts.length > 0,
      calories,
      protein_g,
      hasFood,
      proteinAdherence,
    };
  });
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatAmount(value: number, digits = 0): string {
  return value.toLocaleString("en-IN", { maximumFractionDigits: digits });
}

function percent(consumed: number, target: number): number {
  if (target <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((consumed / target) * 100));
}

function sparklinePoints(values: number[], width: number, height: number): string {
  if (values.length === 0) {
    return "";
  }
  const max = Math.max(...values, 1);
  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - (value / max) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
}

export default function PulsePage() {
  const today = useMemo(() => new Date(), []);
  const todayKey = dayKey(today);
  const [workouts, setWorkouts] = useState<CompletedWorkout[]>([]);
  const [meals, setMeals] = useState<DietLog[]>([]);
  const [checked, setChecked] = useState<BedtimeId[]>([]);
  const [activeTrendKey, setActiveTrendKey] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [auditOpen, setAuditOpen] = useState(true);

  useEffect(() => {
    const nextWorkouts = loadWorkoutHistory();
    const nextMeals = loadDietLogs();
    const storedChecks = loadBedtimeChecks(todayKey);
    setWorkouts(nextWorkouts);
    setMeals(nextMeals);

    const todaysMealLogs = nextMeals.filter((log) => sameDay(log.logged_at, todayKey));
    const workoutDone = nextWorkouts.some((entry) => sameDay(entry.completedAt, todayKey));
    const dayTotals = aggregateMealTotals(todaysMealLogs);
    const highlights = bedtimeHighlights(dayTotals, workoutDone);
    const recommended: BedtimeId[] = [];
    if (highlights.magnesium) {
      recommended.push("magnesium");
    }
    if (highlights.electrolytes) {
      recommended.push("electrolytes");
    }
    setChecked(storedChecks.length === 0 ? recommended : storedChecks);
    setHydrated(true);

    const client = getSupabase();
    if (!client) {
      return;
    }
    let active = true;
    const syncAuth = async () => {
      const { data } = await client.auth.getSession();
      if (active) {
        setIsSignedIn(Boolean(data.session));
      }
    };
    void syncAuth();
    const { data: authListener } = client.auth.onAuthStateChange((_event, nextSession) => {
      setIsSignedIn(Boolean(nextSession));
    });
    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [todayKey]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    const payload: BedtimeStore = { day: todayKey, ids: checked };
    window.localStorage.setItem(BEDTIME_STORAGE_KEY, JSON.stringify(payload));
  }, [checked, hydrated, todayKey]);

  const todaysWorkouts = useMemo(
    () => workouts.filter((entry) => sameDay(entry.completedAt, todayKey)),
    [todayKey, workouts]
  );
  const latestWorkout = todaysWorkouts[0] ?? null;
  const trainingCompleted = latestWorkout !== null;

  const todaysMeals = useMemo(
    () => meals.filter((log) => sameDay(log.logged_at, todayKey)),
    [meals, todayKey]
  );

  const totals = useMemo(() => aggregateMealTotals(todaysMeals), [todaysMeals]);
  const macros = useMemo(() => buildMacroProgress(totals), [totals]);
  const microAudit = useMemo(() => buildMicroMarkers(totals), [totals]);
  const recommendations = useMemo(
    () => buildSmartRecommendations(totals, trainingCompleted),
    [totals, trainingCompleted]
  );
  const recoveryFlags = useMemo(
    () => bedtimeHighlights(totals, trainingCompleted),
    [totals, trainingCompleted]
  );

  const weekTrends = useMemo(
    () => buildWeekTrends(today, meals, workouts),
    [meals, today, workouts]
  );
  const maxVolume = Math.max(...weekTrends.map((day) => day.volumeKg), 0);
  const hasWeekActivity = weekTrends.some((day) => day.workoutCompleted || day.hasFood);
  const selectedTrend = weekTrends.find((day) => day.key === activeTrendKey) ?? null;
  const calorieSpark = sparklinePoints(
    weekTrends.map((day) => day.calories),
    84,
    28
  );

  const gaps = {
    calories: remainingOf(totals.calories, TARGETS.calories),
    protein_g: remainingOf(totals.protein_g, TARGETS.protein_g),
    carbs_g: remainingOf(totals.carbs_g, TARGETS.carbs_g),
    fats_g: remainingOf(totals.fats_g, TARGETS.fats_g),
    fiber_g: remainingOf(totals.fiber_g, TARGETS.fiber_g),
  };
  const workoutSets = latestWorkout ? completedSetCount(latestWorkout) : 0;
  const highIntensity =
    trainingCompleted &&
    (workoutSets >= 12 || (latestWorkout ? totalVolumeKg(latestWorkout) >= 2500 : false));

  const readiness = Math.round(
    (macros.reduce((sum, item) => sum + percent(item.consumed, item.target), 0) /
      macros.length) *
      0.7 +
      (trainingCompleted ? 30 : 0)
  );

  const toggleCheck = (id: BedtimeId) => {
    setChecked((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  return (
    <section className="mx-auto min-h-screen max-w-md bg-neutral-950 px-4 pb-36 pt-6 font-sans text-white">
      <header className="flex items-start justify-between gap-3 pt-[env(safe-area-inset-top)]">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">
            Module 3
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-400" />
            <h1 className="text-2xl font-semibold tracking-tight">The Pulse</h1>
          </div>
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">
            {formatDate(today)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <AccountButton signedIn={isSignedIn} onClick={() => setIsAuthOpen(true)} />
          <div className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
            Readiness Score: {readiness}%
          </div>
        </div>
      </header>

      {trainingCompleted && latestWorkout ? (
        <section className="mt-6 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
                Training Completed
              </p>
              <h2 className="mt-1 text-base font-semibold text-white">
                {latestWorkout.name}
              </h2>
              <p className="mt-1 text-xs text-emerald-200/80">
                {formatTime(latestWorkout.completedAt)} •{" "}
                {completedSetCount(latestWorkout)} sets •{" "}
                {formatAmount(totalVolumeKg(latestWorkout))}kg
              </p>
            </div>
            <Dumbbell className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {latestWorkout.exercises.slice(0, 4).map((exercise) => (
              <span
                key={exercise.id}
                className="rounded-full border border-emerald-500/20 bg-neutral-950/40 px-2.5 py-1 text-[11px] text-emerald-100"
              >
                {exercise.name}
              </span>
            ))}
          </div>
        </section>
      ) : (
        <section className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-300">
                Training Pending
              </p>
              <p className="mt-1 text-sm text-neutral-200">
                No session in today&apos;s workout history yet.
              </p>
            </div>
            <Dumbbell className="h-5 w-5 text-amber-300" />
          </div>
          <Link
            href="/"
            className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-black transition active:scale-98"
          >
            Log a workout
          </Link>
        </section>
      )}

      <section className="mt-5 rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4">
        <h2 className="text-sm font-semibold">Today&apos;s Macro Overview</h2>
        <p className="mt-1 text-xs text-neutral-500">
          DRI: 2,200 kcal • 140g Protein • 220g Carbs • 65g Fat • 35g Fiber
        </p>
        <div className="mt-4 flex flex-col gap-4">
          {macros.map((macro) => {
            const value = macro.percent;
            const barTone =
              value >= 80 ? "bg-emerald-500" : value >= 40 ? "bg-amber-400" : "bg-red-500";
            return (
              <div key={macro.label}>
                <div className="flex items-center justify-between text-sm">
                  <span>{macro.label}</span>
                  <span className="font-mono text-xs text-neutral-400">
                    {formatAmount(macro.consumed, macro.id === "calories" ? 0 : 1)} /{" "}
                    {formatAmount(macro.target)} {macro.unit}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-800">
                  <div
                    className={`h-full rounded-full transition-all ${barTone}`}
                    style={{ width: `${value}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4">
        <h2 className="text-sm font-semibold">Smart Deficit &amp; Supplement Recommendation</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Live gaps from today&apos;s local meal logs against DRI.
        </p>

        {recommendations.length === 0 ? (
          <p className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            No critical fiber, protein, or magnesium gaps right now. Keep logging meals.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {recommendations.map((item) => (
              <article
                key={item.id}
                className={`rounded-xl border p-3 ${
                  item.id === "protein"
                    ? "border-red-500/40 bg-red-500/10"
                    : item.id === "fiber"
                      ? "border-amber-400/40 bg-amber-400/10"
                      : "border-emerald-500/30 bg-emerald-500/10"
                }`}
              >
                <p
                  className={`text-[11px] font-semibold uppercase tracking-wide ${
                    item.id === "protein"
                      ? "text-red-300"
                      : item.id === "fiber"
                        ? "text-amber-300"
                        : "text-emerald-300"
                  }`}
                >
                  {item.badge}
                </p>
                <p className="mt-1 text-xs leading-5 text-neutral-200">
                  Suggestion: {item.suggestion}
                </p>
              </article>
            ))}
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <p className="rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2">
            Calories left: <span className="font-semibold">{formatAmount(gaps.calories)}</span>
          </p>
          <p className="rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2">
            Protein left: <span className="font-semibold">{formatAmount(gaps.protein_g, 1)}g</span>
          </p>
          <p className="rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2">
            Carbs left: <span className="font-semibold">{formatAmount(gaps.carbs_g, 1)}g</span>
          </p>
          <p className="rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2">
            Fiber left: <span className="font-semibold">{formatAmount(gaps.fiber_g, 1)}g</span>
          </p>
        </div>
        {trainingCompleted ? (
          <p className="mt-3 text-xs text-emerald-300">
            {highIntensity ? "High-intensity session logged. " : "Training logged. "}
            Magnesium Glycinate (400mg) and Electrolyte Hydration are Critical for Recovery.
          </p>
        ) : null}
      </section>

      <section className="mt-5 rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4">
        <button
          type="button"
          onClick={() => setAuditOpen((open) => !open)}
          className="flex w-full items-center justify-between text-left"
          aria-expanded={auditOpen}
        >
          <div>
            <h2 className="text-sm font-semibold">Micronutrient Audit</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Fiber, Iron, Calcium, Magnesium, Zinc vs DRI.
            </p>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-neutral-400 transition ${auditOpen ? "rotate-180" : ""}`}
          />
        </button>
        {auditOpen ? (
          <div className="mt-4 flex flex-col gap-4">
            {microAudit.map((marker) => {
              const barTone = marker.deficient
                ? "bg-red-500"
                : marker.percent >= 80
                  ? "bg-emerald-500"
                  : "bg-amber-400";
              return (
                <div key={marker.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white">{marker.name}</span>
                    <span className="font-mono text-xs text-neutral-400">
                      {formatAmount(marker.consumed, 1)} / {formatAmount(marker.target)}{" "}
                      {marker.unit} • {marker.percent}%
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-800">
                    <div
                      className={`h-full rounded-full transition-all ${barTone}`}
                      style={{ width: `${marker.percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className="mb-5 mt-5 rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">7-Day Pulse</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Training Volume &amp; Nutrition Consistency
            </p>
          </div>
          <svg viewBox="0 0 84 28" className="h-7 w-[84px] text-emerald-400" aria-hidden="true">
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={calorieSpark}
            />
          </svg>
        </div>

        {!hasWeekActivity ? (
          <p className="mt-3 text-xs text-neutral-500">
            Log sessions to unlock 7-day trends
          </p>
        ) : null}

        <div className="mt-4 grid h-28 grid-cols-7 items-end gap-2">
          {weekTrends.map((day) => {
            const relative = !hasWeekActivity
              ? 10
              : day.workoutCompleted
                ? Math.max(18, Math.round((day.volumeKg / Math.max(maxVolume, 1)) * 100))
                : 0;
            const selected = activeTrendKey === day.key;
            return (
              <button
                key={day.key}
                type="button"
                onClick={() =>
                  setActiveTrendKey((current) => (current === day.key ? null : day.key))
                }
                className="flex h-full flex-col items-center justify-end gap-2 transition active:scale-98"
                aria-label={`${day.label} volume ${Math.round(day.volumeKg)}kg`}
              >
                <div className="flex h-[88px] w-full items-end justify-center">
                  {day.workoutCompleted || !hasWeekActivity ? (
                    <div
                      className={`w-4 rounded-t-md transition-all duration-300 ${
                        hasWeekActivity ? "bg-emerald-500" : "bg-neutral-800"
                      } ${selected ? "opacity-100" : "opacity-80"}`}
                      style={{ height: `${relative}%` }}
                    />
                  ) : (
                    <div className="h-1.5 w-4 rounded-full bg-neutral-800" />
                  )}
                </div>
                <span
                  className={`text-[10px] font-medium ${
                    selected ? "text-emerald-300" : "text-neutral-500"
                  }`}
                >
                  {day.label}
                </span>
              </button>
            );
          })}
        </div>

        {selectedTrend ? (
          <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            {selectedTrend.label}: {selectedTrend.setsCompleted} sets •{" "}
            {formatAmount(selectedTrend.volumeKg)}kg • {formatAmount(selectedTrend.calories)}{" "}
            kcal • {formatAmount(selectedTrend.protein_g, 1)}g protein
          </div>
        ) : (
          <p className="mt-3 text-[11px] text-neutral-600">
            Tap a day for volume and nutrition detail.
          </p>
        )}

        <div className="mt-4 grid grid-cols-7 gap-2">
          {weekTrends.map((day) => (
            <div key={`${day.key}-dot`} className="flex justify-center">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  day.proteinAdherence === "hit"
                    ? "bg-emerald-500"
                    : day.proteinAdherence === "partial"
                      ? "bg-amber-400"
                      : "bg-neutral-800"
                }`}
                aria-label={`${day.label} protein ${day.proteinAdherence}`}
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-center text-[10px] uppercase tracking-wide text-neutral-600">
          Protein adherence
        </p>
      </section>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4">
        <div className="flex items-center gap-2">
          <Moon className="h-4 w-4 text-emerald-400" />
          <h2 className="text-sm font-semibold">Bedtime Prescription</h2>
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          Recovery checklist persisted locally for tonight.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          {BEDTIME_ITEMS.map((item) => {
            const isChecked = checked.includes(item.id);
            return (
              <article
                key={item.id}
                className={`rounded-xl border p-3 ${
                  (item.id === "magnesium" && recoveryFlags.magnesium) ||
                  (item.id === "electrolytes" && recoveryFlags.electrolytes)
                    ? "border-amber-400/40 bg-amber-400/5"
                    : "border-neutral-800 bg-neutral-950/60"
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => toggleCheck(item.id)}
                    className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-md border transition active:scale-98 ${
                      isChecked
                        ? "border-emerald-500 bg-emerald-500 text-black"
                        : "border-neutral-700 bg-neutral-950 text-transparent"
                    }`}
                    aria-pressed={isChecked}
                    aria-label={`Mark ${item.title} complete`}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3
                        className={`text-sm font-semibold ${
                          isChecked ? "text-neutral-400 line-through" : "text-white"
                        }`}
                      >
                        {item.title}
                      </h3>
                      {(item.id === "magnesium" && recoveryFlags.magnesium) ||
                      (item.id === "electrolytes" && recoveryFlags.electrolytes) ? (
                        <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                          {isChecked ? "Stacked" : "Recommended"}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">{item.detail}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthChange={setIsSignedIn}
      />
    </section>
  );
}
