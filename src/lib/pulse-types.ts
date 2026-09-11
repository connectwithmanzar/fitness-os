import type { Micronutrients } from "@/lib/diet-types";

export type MacroTotals = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
};

export type PulseTotals = MacroTotals & {
  micronutrients: Micronutrients;
};

export type ProgressTone = "emerald" | "amber" | "red";

export type MacroProgress = {
  id: "calories" | "protein" | "carbs" | "fats";
  label: string;
  consumed: number;
  target: number;
  unit: string;
  percent: number;
  tone: ProgressTone;
};

export type MicroMarker = {
  id: keyof Micronutrients;
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
  | "omega-3";

export type SupplementPrescription = {
  id: SupplementId;
  name: string;
  dosage: string;
  gapLabel: string;
};

export type TrainingStatus = {
  loggedToday: boolean;
  label: string;
};
