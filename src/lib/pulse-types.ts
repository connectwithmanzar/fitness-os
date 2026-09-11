import type { Micronutrients } from "@/lib/diet-types";

export type MacroTotals = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  fiber_g: number;
};

export type PulseTotals = MacroTotals & {
  micronutrients: Micronutrients;
};

export type ProgressTone = "emerald" | "amber" | "red";

export type MacroProgress = {
  id: "calories" | "protein" | "carbs" | "fats" | "fiber";
  label: string;
  consumed: number;
  target: number;
  unit: string;
  percent: number;
  tone: ProgressTone;
};

export type MicroMarker = {
  id: "fiber_g" | keyof Micronutrients;
  name: string;
  focus: string;
  consumed: number;
  target: number;
  unit: string;
  percent: number;
  deficient: boolean;
};

export type SupplementId =
  | "whey"
  | "magnesium"
  | "zinc"
  | "vitamin-d"
  | "omega-3"
  | "fiber";

export type SupplementPrescription = {
  id: SupplementId;
  name: string;
  dosage: string;
  gapLabel: string;
};

export type SmartRecommendation = {
  id: "fiber" | "protein" | "magnesium";
  badge: string;
  suggestion: string;
};

export type TrainingStatus = {
  loggedToday: boolean;
  label: string;
};
