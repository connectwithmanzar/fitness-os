export type Micronutrients = {
  iron_mg: number;
  calcium_mg: number;
  magnesium_mg: number;
  zinc_mg: number;
  vitamin_d_iu: number;
  vitamin_b12_mcg: number;
};

export type DietEntry = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  fiber?: number;
  micros?: Record<string, number>;
};

export type MealEstimateSource = "gemini" | "estimate";

export type MealScanResult = DietEntry & {
  meal_name: string;
  serving_inferred: string;
  fiber_g: number;
  micronutrients: Micronutrients;
  breakdown_summary: string;
  source?: MealEstimateSource;
};

export type MealLog = MealScanResult & {
  id: string;
  query: string;
  logged_at: string;
};

export type MealScanRequest = {
  query: string;
};

export type DailyMacroTargets = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  fiber_g: number;
};

export const EMPTY_MICRONUTRIENTS: Micronutrients = {
  iron_mg: 0,
  calcium_mg: 0,
  magnesium_mg: 0,
  zinc_mg: 0,
  vitamin_d_iu: 0,
  vitamin_b12_mcg: 0,
};

export const DAILY_MACRO_TARGETS: DailyMacroTargets = {
  calories: 2200,
  protein_g: 140,
  carbs_g: 220,
  fats_g: 65,
  fiber_g: 35,
};

export const LOCAL_MEAL_LOGS_KEY = "local_meal_logs";

export function toMicrosRecord(micros: Micronutrients): Record<string, number> {
  return {
    iron_mg: micros.iron_mg,
    calcium_mg: micros.calcium_mg,
    magnesium_mg: micros.magnesium_mg,
    zinc_mg: micros.zinc_mg,
    vitamin_d_iu: micros.vitamin_d_iu,
    vitamin_b12_mcg: micros.vitamin_b12_mcg,
  };
}

export function fiberFromEntry(entry: {
  fiber?: number;
  fiber_g?: number;
}): number {
  if (typeof entry.fiber === "number" && Number.isFinite(entry.fiber)) {
    return entry.fiber;
  }
  if (typeof entry.fiber_g === "number" && Number.isFinite(entry.fiber_g)) {
    return entry.fiber_g;
  }
  return 0;
}
