export type Micronutrients = {
  iron_mg: number;
  zinc_mg: number;
  magnesium_mg: number;
  vitamin_d_iu: number;
  calcium_mg: number;
};

export type MealScanResult = {
  meal_name: string;
  serving_inferred: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  micronutrients: Micronutrients;
  breakdown_summary: string;
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
};

export const DAILY_MACRO_TARGETS: DailyMacroTargets = {
  calories: 2200,
  protein_g: 140,
  carbs_g: 250,
  fats_g: 70,
};

export const LOCAL_MEAL_LOGS_KEY = "local_meal_logs";
