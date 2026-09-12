"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, Moon, Utensils } from "lucide-react";
import { AccountButton, AuthModal } from "@/components/AuthModal";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Meter, meterTone } from "@/components/ui/Meter";
import { PageHeader } from "@/components/ui/PageHeader";
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
import { suggestNextSplit } from "@/lib/workout-splits";
import { useReloadLocalFitnessData } from "@/hooks/useReloadLocalFitnessData";

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
  dayNum: number;
  isToday: boolean;
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

function loadBedtimeChecks(today: string): BedtimeId[] | null {
  try {
    const raw = window.localStorage.getItem(BEDTIME_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as BedtimeStore;
    if (parsed.day !== today || !Array.isArray(parsed.ids)) {
      return null;
    }
    return parsed.ids.filter(isBedtimeId);
  } catch {
    return null;
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
      dayNum: date.getDate(),
      isToday: key === localDayKey(end),
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
  const dataTick = useReloadLocalFitnessData();
  const bedtimeSeededDayRef = useRef<string | null>(null);

  useEffect(() => {
    const nextWorkouts = loadWorkoutHistory();
    const nextMeals = loadLocalMealLogs();
    setWorkouts(nextWorkouts);
    setMeals(nextMeals);
    setDietTargets(loadDietTargets());

    const storedChecks = loadBedtimeChecks(todayKey);
    if (storedChecks !== null) {
      setChecked(storedChecks);
      bedtimeSeededDayRef.current = todayKey;
    } else if (bedtimeSeededDayRef.current !== todayKey) {
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
      setChecked(recommended);
      bedtimeSeededDayRef.current = todayKey;
    }
    setHydrated(true);
  }, [dataTick, todayKey]);

  useEffect(() => {
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
  }, []);

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

  const suggestedSplit = useMemo(() => suggestNextSplit(workouts), [workouts]);
  const uncheckedBedtime = BEDTIME_ITEMS.filter((item) => !checked.includes(item.id)).length;
  const magnesiumUnchecked = !checked.includes("magnesium");
  const recoverHighlight = trainingCompleted && magnesiumUnchecked;

  const toggleCheck = (id: BedtimeId) => {
    setChecked((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  if (!hydrated) {
    return <PageSkeleton />;
  }

  return (
    <section>
      <PageHeader
        title="Today"
        subtitle={formatDate(today)}
        action={<AccountButton signedIn={isSignedIn} onClick={() => setIsAuthOpen(true)} />}
      />

      <div className="week">
        {weekTrends.map((day) => (
          <button
            key={day.key}
            type="button"
            className={`wday ${day.isToday ? "today" : ""}`}
            onClick={() =>
              setActiveTrendKey((current) => (current === day.key ? null : day.key))
            }
            aria-label={`${day.label} ${day.dayNum}`}
          >
            <div className="lbl">{day.label}</div>
            <div className="num">{day.dayNum}</div>
            <div
              className={`dot ${
                day.workoutCompleted ? "done" : day.hasFood ? "plan" : ""
              }`}
            />
          </button>
        ))}
      </div>

      {selectedTrend ? (
        <p className="sect-f" style={{ marginTop: -8, marginBottom: 12 }}>
          {selectedTrend.label}: {selectedTrend.setsCompleted} sets •{" "}
          {formatAmount(selectedTrend.volumeKg)}kg • {formatAmount(selectedTrend.calories)} kcal
        </p>
      ) : null}

      <div className="card">
        <h2>Today&apos;s workout</h2>
        {trainingCompleted && latestWorkout ? (
          <>
            <p className="t-head">Training done</p>
            <p className="t-foot" style={{ marginTop: 4 }}>
              {latestWorkout.name} • {completedSetCount(latestWorkout)} sets
            </p>
            <Link href="/" className="btn" style={{ marginTop: 14 }}>
              Open Train
            </Link>
          </>
        ) : (
          <>
            <p className="big">{suggestedSplit.title}</p>
            <p className="t-foot" style={{ marginTop: 6 }}>
              {suggestedSplit.detail}
            </p>
            <Link
              href={`/?suggest=${suggestedSplit.id}`}
              className="btn primary"
              style={{ marginTop: 14 }}
            >
              Start {suggestedSplit.title}
            </Link>
          </>
        )}
      </div>

      <div className="sect">
        <span className="sect-t">Eat</span>
        <div className="sect-b">
          <Link href="/diet" className={`lrow tap ${proteinDeficit ? "danger" : ""}`}>
            <span className="lrow-i" style={{ background: proteinDeficit ? "var(--red)" : "var(--acc)" }}>
              <Utensils className="h-4 w-4" />
            </span>
            <span className="lrow-m">
              <span className="lrow-t">{proteinDeficit ? "Hit protein" : "Stay on macros"}</span>
              <span className="lrow-s">
                {formatAmount(gaps.calories)} kcal left • {formatAmount(gaps.protein_g, 1)}g protein
              </span>
            </span>
            <ChevronRight className="lrow-c h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="sect">
        <span className="sect-t">Recover</span>
        <div className="sect-b">
          <button
            type="button"
            className="lrow tap"
            onClick={() => {
              document.getElementById("bedtime")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }}
          >
            <span
              className="lrow-i"
              style={{ background: recoverHighlight ? "var(--orange)" : "var(--acc)" }}
            >
              <Moon className="h-4 w-4" />
            </span>
            <span className="lrow-m">
              <span className="lrow-t">
                {uncheckedBedtime === 0
                  ? "Recovery stack done"
                  : `${uncheckedBedtime} bedtime check${uncheckedBedtime === 1 ? "" : "s"} left`}
              </span>
              <span className="lrow-s">
                {recoverHighlight
                  ? "Training is done — take magnesium before bed."
                  : "Sleep, magnesium, and electrolytes protect tomorrow."}
              </span>
            </span>
            <ChevronRight className="lrow-c h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Readiness {readiness}%</h2>
        <p className="big">{formatAmount(Math.max(0, gaps.calories))}</p>
        <p className="t-foot">kcal remaining</p>
        <Meter value={readiness} tone={meterTone(readiness)} />
        <div className="mt-3 grid grid-cols-3 gap-2">
          {macros.slice(0, 3).map((macro) => (
            <div key={macro.label}>
              <p className="t-cap" style={{ color: "var(--label-3)" }}>
                {macro.label}
              </p>
              <p className="t-head">
                {formatAmount(macro.consumed, macro.id === "calories" ? 0 : 0)}
              </p>
              <Meter value={macro.percent} tone={meterTone(macro.percent)} />
            </div>
          ))}
        </div>
      </div>

      <div className="sect">
        <span className="sect-t">Coach</span>
        <div className="sect-b">
          {recommendations.length === 0 ? (
            <div className="lrow">
              <span className="lrow-m">
                <span className="lrow-t">No critical gaps</span>
                <span className="lrow-s">Keep logging meals.</span>
              </span>
            </div>
          ) : (
            recommendations.map((item) => (
              <div
                key={item.id}
                className={`lrow ${item.id === "protein" ? "danger" : ""}`}
              >
                <span className="lrow-m">
                  <span className="lrow-t">{item.badge}</span>
                  <span className="lrow-s">{item.suggestion}</span>
                </span>
              </div>
            ))
          )}
        </div>
        {trainingCompleted ? (
          <p className="sect-f">
            {highIntensity ? "High-intensity session logged. " : "Training logged. "}
            Magnesium glycinate (400mg) and electrolytes are critical for recovery.
          </p>
        ) : null}
      </div>

      <div className="sect">
        <button
          type="button"
          onClick={() => setAuditOpen((open) => !open)}
          className="lrow tap"
          style={{ background: "transparent", paddingLeft: 4 }}
          aria-expanded={auditOpen}
        >
          <span className="lrow-m">
            <span className="sect-t" style={{ padding: 0 }}>
              Details
            </span>
            <span className="lrow-t">Micronutrient audit</span>
          </span>
          <ChevronDown
            className="lrow-c h-4 w-4"
            style={{ transform: auditOpen ? "rotate(180deg)" : undefined }}
          />
        </button>
        {auditOpen ? (
          <div className="card" style={{ marginTop: 8 }}>
            {microAudit.map((marker) => (
              <div key={marker.id} style={{ marginBottom: 12 }}>
                <div className="flex items-center justify-between">
                  <span className="t-sub">{marker.name}</span>
                  <span className="t-foot">
                    {formatAmount(marker.consumed, 1)} / {formatAmount(marker.target)} {marker.unit}
                  </span>
                </div>
                <Meter
                  value={marker.percent}
                  tone={marker.deficient ? "low" : meterTone(marker.percent)}
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2>7-day pulse</h2>
            <svg viewBox="0 0 84 28" className="h-7 w-[84px]" style={{ color: "var(--acc)" }} aria-hidden="true">
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
          <button
            type="button"
            className="btn sm"
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
          >
            {copiedSummary ? "Copied" : "Copy week"}
          </button>
        </div>
        {!hasWeekActivity ? (
          <p className="t-foot">Log sessions to unlock 7-day trends</p>
        ) : null}
      </div>

      <section id="bedtime" className="sect" style={{ scrollMarginTop: 24 }}>
        <span className="sect-t">Bedtime</span>
        {proteinDeficit ? (
          <div className="card" style={{ background: "color-mix(in srgb, var(--red) 12%, transparent)" }}>
            <p className="t-head" style={{ color: "var(--red)" }}>
              Protein deficit
            </p>
            <p className="t-foot" style={{ marginTop: 4 }}>
              You are at {formatAmount(totals.protein_g, 1)}g / {formatAmount(proteinTarget)}g (
              {Math.round(proteinRatio * 100)}%). Take 1 scoop whey or 200g Greek yogurt/paneer.
            </p>
          </div>
        ) : null}
        {fiberDeficit ? (
          <div className="card" style={{ background: "color-mix(in srgb, var(--orange) 12%, transparent)" }}>
            <p className="t-head" style={{ color: "var(--orange)" }}>
              Fiber deficit
            </p>
            <p className="t-foot" style={{ marginTop: 4 }}>
              {formatAmount(totals.fiber_g, 1)}g logged. Take 2 tbsp isabgol / chia seeds before bed.
            </p>
          </div>
        ) : null}
        <div className="sect-b">
          {BEDTIME_ITEMS.map((item) => {
            const isChecked = checked.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                className="lrow tap"
                onClick={() => toggleCheck(item.id)}
              >
                <span className={`ck ${isChecked ? "on" : ""}`}>
                  <Check className="h-3.5 w-3.5" />
                </span>
                <span className="lrow-m">
                  <span className="lrow-t" style={isChecked ? { color: "var(--label-2)", textDecoration: "line-through" } : undefined}>
                    {item.title}
                  </span>
                  <span className="lrow-s">{item.detail}</span>
                </span>
              </button>
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
