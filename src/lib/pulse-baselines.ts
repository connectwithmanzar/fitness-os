export const PULSE_CALORIE_TARGET = 2200;
export const PULSE_PROTEIN_TARGET_G = 150;
export const PULSE_CARBS_TARGET_G = 250;
export const PULSE_FATS_TARGET_G = 70;

export const PULSE_MICRO_TARGETS = {
  iron_mg: 18,
  zinc_mg: 11,
  magnesium_mg: 400,
  vitamin_d_iu: 2000,
  calcium_mg: 1000,
} as const;

export const SUPPLEMENTS_TAKEN_STORAGE_KEY = "supplements_taken_today";
export const LAST_COMPLETED_WORKOUT_KEY = "last_completed_workout";
