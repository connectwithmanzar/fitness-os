"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, Check, ChevronDown, Dumbbell, Moon } from "lucide-react";
import { AccountButton, AuthModal } from "@/components/AuthModal";
import {
  isSameLocalDay,
  loadLocalMealLogs,
  localDayKey,
} from "@/lib/diet-storage";
import { loadDietTargets } from "@/lib/diet-targets";
import { DAILY_MACRO_TARGETS, type DailyMacroTargets, type MealLog } from "@/lib/diet-types";
import {
  aggregateMealTotals,
  bedtimeHighlights,
  buildMacroProgress,
  buildMicroMarkers,
  buildSmartRecommendations,
  remainingOf,
} from "@/lib/pulse-engine";
import { getSupabase } from "@/lib/supabaseClient";
import {
  completedSetCount,
  loadWorkoutHistory,
  totalVolumeKg,
  type CompletedWorkout,
} from "@/lib/workout-history";

const BEDTIME_STORAGE_KEY = "pulse_bedtime_checks";

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

function buildWeekTrends(
  end: Date,
  meals: MealLog[],
  workouts: CompletedWorkout[],
  proteinHitG: number
): DayTrend[] {
  return lastSevenDays(end).map((date) => {
    const key = localDayKey(date);
    const dayMeals = meals.filter((log) => isSameLocalDay(log.logged_at, key));
    const dayWorkouts = workouts.filter((entry) =>
      isSameLocalDay(entry.completedAt, key)
    );
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
      : protein_g >= proteinHitG
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

function weeklySummaryMarkdown(
  weekTrends: DayTrend[],
  workouts: CompletedWorkout[]
): string {
  const totalVolume = weekTrends.reduce((sum, day) => sum + day.volumeKg, 0);
  const totalSets = weekTrends.reduce((sum, day) => sum + day.setsCompleted, 0);
  const proteinHits = weekTrends.filter((day) => day.proteinAdherence === "hit").length;
  const trainingDays = weekTrends.filter((day) => day.workoutCompleted).length;
  const rangeStart = weekTrends[0]?.key ?? "";
  const rangeEnd = weekTrends[weekTrends.length - 1]?.key ?? "";
  const keys = new Set(weekTrends.map((day) => day.key));

  const lifts = new Map<string, { sets: number; volume: number }>();
  for (const workout of workouts) {
    const date = new Date(workout.completedAt);
    if (Number.isNaN(date.getTime())) {
      continue;
    }
    const key = localDayKey(date);
    if (!keys.has(key)) {
      continue;
    }
    for (const exercise of workout.exercises) {
      const current = lifts.get(exercise.name) ?? { sets: 0, volume: 0 };
      for (const set of exercise.sets) {
        if (!set.completed) {
          continue;
        }
        current.sets += 1;
        const weight = Number(set.weightKg);
        const reps = Number(set.reps);
        if (Number.isFinite(weight) && Number.isFinite(reps)) {
          current.volume += weight * reps;
        }
      }
      lifts.set(exercise.name, current);
    }
  }

  const topLifts = Array.from(lifts.entries())
    .sort((left, right) => right[1].volume - left[1].volume)
    .slice(0, 5)
    .map(
      ([name, stats], index) =>
        `${index + 1}. ${name} — ${stats.sets} sets, ${Math.round(stats.volume)} kg volume`
    );

  return [
    `## Fitness OS — 7-day summary`,
    `${rangeStart} → ${rangeEnd}`,
    "",
    `- Training days: ${trainingDays}/7`,
    `- Sets: ${totalSets}`,
    `- Volume: ${Math.round(totalVolume)} kg`,
    `- Protein adherence (hit days): ${proteinHits}/7`,
    "",
    "### Top lifts",
    topLifts.length > 0 ? topLifts.join("\n") : "- No completed lifts in this window",
    "",
    "Paste into Claude/Cursor for a weekly review. No extra API cost.",
  ].join("\n");
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
  const todayKey = localDayKey(today);
  const [workouts, setWorkouts] = useState<CompletedWorkout[]>([]);
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [checked, setChecked] = useState<BedtimeId[]>([]);
  const [activeTrendKey, setActiveTrendKey] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [auditOpen, setAuditOpen] = useState(true);
  const [dietTargets, setDietTargets] = useState<DailyMacroTargets>(DAILY_MACRO_TARGETS);
  const [copiedSummary, setCopiedSummary] = useState(false);

  useEffect(() => {
    const nextWorkouts = loadWorkoutHistory();
    const nextMeals = loadLocalMealLogs();
    const storedChecks = loadBedtimeChecks(todayKey);
    setWorkouts(nextWorkouts);
    setMeals(nextMeals);
    setDietTargets(loadDietTargets());

    const todaysMealLogs = nextMeals.filter((log) =>
      isSameLocalDay(log.logged_at, todayKey)
    );
    const workoutDone = nextWorkouts.some((entry) =>
      isSameLocalDay(entry.completedAt, todayKey)
    );
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
    () => workouts.filter((entry) => isSameLocalDay(entry.completedAt, todayKey)),
    [todayKey, workouts]
  );
  const latestWorkout = todaysWorkouts[0] ?? null;
  const trainingCompleted = latestWorkout !== null;

  const todaysMeals = useMemo(
    () => meals.filter((log) => isSameLocalDay(log.logged_at, todayKey)),
    [meals, todayKey]
  );

  const totals = useMemo(() => aggregateMealTotals(todaysMeals), [todaysMeals]);
  const macros = useMemo(
    () => buildMacroProgress(totals, dietTargets),
    [dietTargets, totals]
  );
  const microAudit = useMemo(
    () => buildMicroMarkers(totals, dietTargets),
    [dietTargets, totals]
  );
  const recommendations = useMemo(
    () => buildSmartRecommendations(totals, trainingCompleted, dietTargets),
    [dietTargets, totals, trainingCompleted]
  );
  const recoveryFlags = useMemo(
    () => bedtimeHighlights(totals, trainingCompleted),
    [totals, trainingCompleted]
  );

  const weekTrends = useMemo(
    () => buildWeekTrends(today, meals, workouts, dietTargets.protein_g * 0.85),
    [dietTargets.protein_g, meals, today, workouts]
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
    calories: remainingOf(totals.calories, dietTargets.calories),
    protein_g: remainingOf(totals.protein_g, dietTargets.protein_g),
    carbs_g: remainingOf(totals.carbs_g, dietTargets.carbs_g),
    fats_g: remainingOf(totals.fats_g, dietTargets.fats_g),
    fiber_g: remainingOf(totals.fiber_g, dietTargets.fiber_g),
  };
  const proteinTarget = dietTargets.protein_g;
  const proteinRatio = totals.protein_g / proteinTarget;
  const proteinDeficit = proteinRatio < 0.7;
  const fiberDeficit = totals.fiber_g < dietTargets.fiber_g * 0.7;
  const workoutSets = latestWorkout ? completedSetCount(latestWorkout) : 0;
  const highIntensity =
    trainingCompleted &&
    (workoutSets >= 12 || (latestWorkout ? totalVolumeKg(latestWorkout) >= 2500 : false));

  const readiness = Math.min(
    100,
    Math.round(
      (macros.reduce((sum, item) => sum + percent(item.consumed, item.target), 0) /
        Math.max(macros.length, 1)) *
        0.55 +
        (trainingCompleted ? 25 : 0) +
        (checked.length / BEDTIME_ITEMS.length) * 20
    )
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
          DRI: {formatAmount(dietTargets.calories)} kcal • {formatAmount(dietTargets.protein_g)}g
          Protein • {formatAmount(dietTargets.carbs_g)}g Carbs • {formatAmount(dietTargets.fats_g)}g
          Fat • {formatAmount(dietTargets.fiber_g)}g Fiber
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
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={async () => {
                const markdown = weeklySummaryMarkdown(weekTrends, workouts);
                try {
                  await navigator.clipboard.writeText(markdown);
                  setCopiedSummary(true);
                  window.setTimeout(() => setCopiedSummary(false), 2000);
                } catch {
                  setCopiedSummary(false);
                }
              }}
              className="rounded-full border border-neutral-700 px-2.5 py-1 text-[11px] font-semibold text-neutral-200"
            >
              {copiedSummary ? "Copied" : "Copy weekly summary"}
            </button>
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
          Recovery stack tied to today&apos;s training and macros. Checking items lifts readiness.
        </p>

        {proteinDeficit ? (
          <article className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-red-300">
              Protein Deficit Detected
            </p>
            <p className="mt-1 text-xs leading-5 text-red-100/90">
              You are at {formatAmount(totals.protein_g, 1)}g / {formatAmount(proteinTarget)}g (
              {Math.round(proteinRatio * 100)}%). Take 1 Scoop Whey or 200g Greek Yogurt/Paneer.
            </p>
          </article>
        ) : null}

        {fiberDeficit ? (
          <article className="mt-3 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-300">
              Fiber Deficit
            </p>
            <p className="mt-1 text-xs leading-5 text-amber-100/90">
              {formatAmount(totals.fiber_g, 1)}g logged. Take 2 tbsp Isabgol / Chia Seeds before bed.
            </p>
          </article>
        ) : null}
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
                      {item.id === "magnesium" && trainingCompleted ? (
                        <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-300">
                          CRITICAL: Muscle Repair &amp; CNS Recovery Active
                        </span>
                      ) : (item.id === "magnesium" && recoveryFlags.magnesium) ||
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
