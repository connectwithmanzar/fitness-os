export const PULSE_CALORIE_TARGET = 2200;
export const PULSE_PROTEIN_TARGET_G = 140;
export const PULSE_CARBS_TARGET_G = 220;
export const PULSE_FATS_TARGET_G = 65;
export const PULSE_FIBER_TARGET_G = 35;

export const PULSE_MICRO_TARGETS = {
  iron_mg: 18,
  calcium_mg: 1000,
  magnesium_mg: 400,
  zinc_mg: 12,
  vitamin_d_iu: 2000,
  vitamin_b12_mcg: 2.4,
} as const;

export const SUPPLEMENTS_TAKEN_STORAGE_KEY = "supplements_taken_today";
export const LAST_COMPLETED_WORKOUT_KEY = "last_completed_workout";
