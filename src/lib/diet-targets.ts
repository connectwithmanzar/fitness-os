import {
  DAILY_MACRO_TARGETS,
  type DailyMacroTargets,
} from "@/lib/diet-types";

export const DIET_TARGETS_STORAGE_KEY = "diet_targets";

function asPositiveNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return fallback;
}

export function normalizeDietTargets(value: unknown): DailyMacroTargets {
  const record =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};
  return {
    calories: Math.round(asPositiveNumber(record.calories, DAILY_MACRO_TARGETS.calories)),
    protein_g: asPositiveNumber(record.protein_g, DAILY_MACRO_TARGETS.protein_g),
    carbs_g: asPositiveNumber(record.carbs_g, DAILY_MACRO_TARGETS.carbs_g),
    fats_g: asPositiveNumber(record.fats_g, DAILY_MACRO_TARGETS.fats_g),
    fiber_g: asPositiveNumber(record.fiber_g, DAILY_MACRO_TARGETS.fiber_g),
  };
}

export function loadDietTargets(): DailyMacroTargets {
  if (typeof window === "undefined") {
    return { ...DAILY_MACRO_TARGETS };
  }
  try {
    const raw = window.localStorage.getItem(DIET_TARGETS_STORAGE_KEY);
    if (!raw) {
      return { ...DAILY_MACRO_TARGETS };
    }
    return normalizeDietTargets(JSON.parse(raw) as unknown);
  } catch {
    return { ...DAILY_MACRO_TARGETS };
  }
}

export function persistDietTargets(targets: DailyMacroTargets): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(
    DIET_TARGETS_STORAGE_KEY,
    JSON.stringify(normalizeDietTargets(targets))
  );
}
