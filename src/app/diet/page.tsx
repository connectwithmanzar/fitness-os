"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2, Trash2 } from "lucide-react";
import { AccountButton, AuthModal } from "@/components/AuthModal";
import { PageSkeleton } from "@/components/PageSkeleton";
import { AppBanner } from "@/components/ui/AppBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Meter, meterTone } from "@/components/ui/Meter";
import { PageHeader } from "@/components/ui/PageHeader";
import { parseMealScanResult } from "@/lib/diet-parse";
import {
  createMealId,
  isSameLocalDay,
  loadLocalMealLogs,
  localDayKey,
  removeLocalMealLog,
  upsertLocalMealLogs,
} from "@/lib/diet-storage";
import {
  deleteRemoteMealLog,
  fetchRemoteMealLogs,
  insertRemoteMealLog,
} from "@/lib/diet-sync";
import { DAILY_MACRO_TARGETS, fiberFromEntry } from "@/lib/diet-types";
import type { DailyMacroTargets, DietEntry, MealLog, MealScanResult } from "@/lib/diet-types";
import { loadDietTargets, persistDietTargets } from "@/lib/diet-targets";
import { getSupabase } from "@/lib/supabaseClient";
import { useReloadLocalFitnessData } from "@/hooks/useReloadLocalFitnessData";

const SHORTCUTS = [
  "+ 1 Katori Dal",
  "+ 2 Roti",
  "+ 100g Paneer",
  "+ 250ml Milk",
  "+ 200g Chicken",
] as const;

function appendShortcut(current: string, chip: string): string {
  const addition = chip.replace(/^\+\s*/, "");
  const trimmed = current.trim();
  if (trimmed.length === 0) {
    return addition;
  }
  if (trimmed.endsWith(",")) {
    return `${trimmed} ${addition}`;
  }
  return `${trimmed}, ${addition}`;
}

function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function todaysMealLogs(todayKey: string): MealLog[] {
  return loadLocalMealLogs()
    .filter((log) => isSameLocalDay(log.logged_at, todayKey))
    .sort((left, right) => right.logged_at.localeCompare(left.logged_at));
}

function startOfLocalDayIso(date: Date): string {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

async function readJsonBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export default function DietPage() {
  const [query, setQuery] = useState("");
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [targets, setTargets] = useState<DailyMacroTargets>(DAILY_MACRO_TARGETS);
  const [draftTargets, setDraftTargets] = useState<DailyMacroTargets>(DAILY_MACRO_TARGETS);
  const [editingTargets, setEditingTargets] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const todayKey = localDayKey(new Date());
  const dataTick = useReloadLocalFitnessData();
  const editingTargetsRef = useRef(editingTargets);
  editingTargetsRef.current = editingTargets;

  useEffect(() => {
    const bootstrap = async () => {
      const local = todaysMealLogs(todayKey);
      const remote = await fetchRemoteMealLogs(startOfLocalDayIso(new Date()));
      const merged = new Map<string, MealLog>();
      for (const log of local) {
        merged.set(log.id, log);
      }
      if (remote) {
        for (const log of remote) {
          merged.set(log.id, log);
        }
      }
      const todayMerged = Array.from(merged.values()).sort((a, b) =>
        b.logged_at.localeCompare(a.logged_at)
      );
      if (todayMerged.length > 0) {
        upsertLocalMealLogs(todayMerged);
      }
      setLogs(todaysMealLogs(todayKey));
      if (!editingTargetsRef.current) {
        const savedTargets = loadDietTargets();
        setTargets(savedTargets);
        setDraftTargets(savedTargets);
      }
      setHydrated(true);
    };

    void bootstrap();
  }, [todayKey]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    setLogs(todaysMealLogs(todayKey));
    if (!editingTargetsRef.current) {
      const savedTargets = loadDietTargets();
      setTargets(savedTargets);
      setDraftTargets(savedTargets);
    }
  }, [dataTick, hydrated, todayKey]);

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
    if (!banner) {
      return;
    }
    const timeout = window.setTimeout(() => setBanner(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [banner]);

  const totals = useMemo(
    () =>
      logs.reduce(
        (acc, log) => ({
          calories: acc.calories + log.calories,
          protein_g: acc.protein_g + log.protein_g,
          carbs_g: acc.carbs_g + log.carbs_g,
          fats_g: acc.fats_g + log.fats_g,
          fiber_g: acc.fiber_g + fiberFromEntry(log),
        }),
        { calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0, fiber_g: 0 }
      ),
    [logs]
  );

  const saveTargets = () => {
    const next = {
      calories: Math.max(1, Number(draftTargets.calories) || DAILY_MACRO_TARGETS.calories),
      protein_g: Math.max(1, Number(draftTargets.protein_g) || DAILY_MACRO_TARGETS.protein_g),
      carbs_g: Math.max(1, Number(draftTargets.carbs_g) || DAILY_MACRO_TARGETS.carbs_g),
      fats_g: Math.max(1, Number(draftTargets.fats_g) || DAILY_MACRO_TARGETS.fats_g),
      fiber_g: Math.max(1, Number(draftTargets.fiber_g) || DAILY_MACRO_TARGETS.fiber_g),
    };
    setTargets(next);
    persistDietTargets(next);
    setEditingTargets(false);
  };

  const logMeal = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed || loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/diet/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });

      const payload = await readJsonBody(response);
      let scanned: MealScanResult | null = null;
      try {
        scanned = parseMealScanResult(payload, trimmed);
      } catch {
        scanned = null;
      }

      if (!scanned) {
        setError("Could not read that meal. Try a shorter description.");
        return;
      }

      const nextLog: MealLog = {
        ...scanned,
        id: createMealId(),
        query: trimmed,
        logged_at: new Date().toISOString(),
      };

      upsertLocalMealLogs([nextLog]);
      setLogs(todaysMealLogs(todayKey));
      setQuery("");

      let synced = false;
      try {
        synced = await insertRemoteMealLog(nextLog);
      } catch {
        synced = false;
      }
      setBanner(synced ? "Meal saved · Synced" : "Meal saved · Saved on this phone");
    } catch {
      setError("Could not log that meal. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [loading, query, todayKey]);

  const removeLog = useCallback(async (id: string) => {
    removeLocalMealLog(id);
    setLogs(todaysMealLogs(todayKey));
    if (expandedId === id) {
      setExpandedId(null);
    }
    try {
      await deleteRemoteMealLog(id);
    } catch {
      // Keep the local delete even if remote delete is unavailable.
    }
  }, [expandedId, todayKey]);

  if (!hydrated) {
    return <PageSkeleton />;
  }

  return (
    <section>
      <PageHeader
        title="Eat"
        subtitle="Log katori, roti, plates, grams, or ml."
        action={<AccountButton signedIn={isSignedIn} onClick={() => setIsAuthOpen(true)} />}
      />

      {banner ? <AppBanner>{banner}</AppBanner> : null}

      <div className="card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2>Remaining</h2>
            <p className="big">
              {formatNumber(Math.max(0, targets.calories - totals.calories))}
            </p>
            <p className="t-foot" style={{ marginTop: 4 }}>
              kcal left · {formatNumber(Math.max(0, targets.protein_g - totals.protein_g), 0)}g
              protein
            </p>
          </div>
          <button
            type="button"
            className="btn sm"
            onClick={() => {
              setDraftTargets(targets);
              setEditingTargets((open) => !open);
            }}
          >
            {editingTargets ? "Close" : "Targets"}
          </button>
        </div>

        {editingTargets ? (
          <form
            className="mt-4 grid grid-cols-2 gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              saveTargets();
            }}
          >
            {(
              [
                ["calories", "kcal"],
                ["protein_g", "Protein"],
                ["carbs_g", "Carbs"],
                ["fats_g", "Fat"],
                ["fiber_g", "Fiber"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="t-foot">
                {label}
                <input
                  inputMode="decimal"
                  value={draftTargets[key]}
                  onChange={(event) =>
                    setDraftTargets((current) => ({
                      ...current,
                      [key]: Number(event.target.value) || 0,
                    }))
                  }
                  className="field"
                  style={{ marginTop: 6 }}
                />
              </label>
            ))}
            <button type="submit" className="btn primary" style={{ gridColumn: "1 / -1" }}>
              Save targets
            </button>
          </form>
        ) : null}

        <div className="mt-5 flex flex-col gap-3">
          {(
            [
              { label: "Calories", consumed: totals.calories, target: targets.calories, unit: "kcal" },
              { label: "Protein", consumed: totals.protein_g, target: targets.protein_g, unit: "g" },
              { label: "Carbs", consumed: totals.carbs_g, target: targets.carbs_g, unit: "g" },
              { label: "Fat", consumed: totals.fats_g, target: targets.fats_g, unit: "g" },
              { label: "Fiber", consumed: totals.fiber_g, target: targets.fiber_g, unit: "g" },
            ] as const
          ).map((row) => {
            const percent =
              row.target > 0 ? Math.min(100, Math.round((row.consumed / row.target) * 100)) : 0;
            return (
              <div key={row.label}>
                <div className="flex items-center justify-between">
                  <span className="t-sub">{row.label}</span>
                  <span className="t-foot">
                    {formatNumber(row.consumed, row.unit === "kcal" ? 0 : 1)} /{" "}
                    {formatNumber(row.target)} {row.unit}
                  </span>
                </div>
                <Meter value={percent} tone={meterTone(percent)} />
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <label htmlFor="meal-query" className="t-head">
          What did you eat?
        </label>
        <textarea
          id="meal-query"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          rows={4}
          placeholder="e.g., 250g paneer bhurji, 2 roti, and 1 katori dal or 300ml whole milk..."
          className="field"
          style={{ marginTop: 10, resize: "none", minHeight: 96 }}
        />
        <div className="chips" style={{ marginTop: 10 }}>
          {SHORTCUTS.map((chip) => (
            <button
              key={chip}
              type="button"
              className="chip"
              onClick={() => setQuery((current) => appendShortcut(current, chip))}
            >
              {chip}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            void logMeal();
          }}
          disabled={loading || query.trim().length === 0}
          className="btn primary"
          style={{ marginTop: 14 }}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Calculating nutritional values...
            </>
          ) : (
            "Log meal"
          )}
        </button>
        {error ? (
          <p className="t-foot" style={{ marginTop: 10, color: "var(--orange)" }}>
            {error}
          </p>
        ) : null}
      </div>

      <div className="sect">
        <span className="sect-t">Today&apos;s meals · {logs.length}</span>
        <div className="sect-b">
          {logs.length === 0 ? (
            <EmptyState
              title="Nothing logged yet"
              body="Log a roti, katori, or gram-based plate to start the day."
            />
          ) : (
            logs.map((log: DietEntry & MealLog) => {
              const expanded = expandedId === log.id;
              const fiberG = fiberFromEntry(log);
              return (
                <div key={log.id}>
                  <div className="lrow">
                    <span className="lrow-m">
                      <span className="lrow-t">{log.meal_name}</span>
                      <span className="lrow-s">
                        {formatNumber(log.calories)} kcal · P {formatNumber(log.protein_g, 1)}g · C{" "}
                        {formatNumber(log.carbs_g, 1)}g · F {formatNumber(log.fats_g, 1)}g · Fiber{" "}
                        {formatNumber(fiberG, 0)}g
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        void removeLog(log.id);
                      }}
                      className="iconbtn"
                      aria-label={`Delete ${log.meal_name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    className="lrow tap"
                    onClick={() => setExpandedId(expanded ? null : log.id)}
                    aria-expanded={expanded}
                  >
                    <span className="lrow-m">
                      <span className="lrow-s">
                        {log.serving_inferred}
                        {log.source ? ` · ${log.source === "gemini" ? "Gemini" : "Estimate"}` : ""}
                      </span>
                    </span>
                    <ChevronDown
                      className="lrow-c h-4 w-4"
                      style={{ transform: expanded ? "rotate(180deg)" : undefined }}
                    />
                  </button>
                  {expanded ? (
                    <div className="t-foot" style={{ padding: "0 14px 14px" }}>
                      Iron {formatNumber(log.micronutrients.iron_mg, 1)} mg · Zinc{" "}
                      {formatNumber(log.micronutrients.zinc_mg, 1)} mg · Mg{" "}
                      {formatNumber(log.micronutrients.magnesium_mg, 1)} mg · Ca{" "}
                      {formatNumber(log.micronutrients.calcium_mg, 1)} mg · D{" "}
                      {formatNumber(log.micronutrients.vitamin_d_iu, 1)} IU · B12{" "}
                      {formatNumber(log.micronutrients.vitamin_b12_mcg, 2)} mcg
                      {log.breakdown_summary ? ` · ${log.breakdown_summary}` : ""}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthChange={setIsSignedIn}
      />
    </section>
  );
}
