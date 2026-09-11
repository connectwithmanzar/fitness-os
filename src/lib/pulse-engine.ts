import type { MealLog, Micronutrients } from "@/lib/diet-types";
import {
  PULSE_CALORIE_TARGET,
  PULSE_CARBS_TARGET_G,
  PULSE_FATS_TARGET_G,
  PULSE_MICRO_TARGETS,
  PULSE_PROTEIN_TARGET_G,
} from "@/lib/pulse-baselines";
import type {
  MacroProgress,
  MicroMarker,
  ProgressTone,
  PulseTotals,
  SupplementPrescription,
} from "@/lib/pulse-types";

const EMPTY_MICROS: Micronutrients = {
  iron_mg: 0,
  zinc_mg: 0,
  magnesium_mg: 0,
  vitamin_d_iu: 0,
  calcium_mg: 0,
};

export function emptyPulseTotals(): PulseTotals {
  return {
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fats_g: 0,
    micronutrients: { ...EMPTY_MICROS },
  };
}

export function aggregateMealTotals(logs: MealLog[]): PulseTotals {
  return logs.reduce<PulseTotals>((totals, log) => {
    return {
      calories: totals.calories + log.calories,
      protein_g: totals.protein_g + log.protein_g,
      carbs_g: totals.carbs_g + log.carbs_g,
      fats_g: totals.fats_g + log.fats_g,
      micronutrients: {
        iron_mg: totals.micronutrients.iron_mg + log.micronutrients.iron_mg,
        zinc_mg: totals.micronutrients.zinc_mg + log.micronutrients.zinc_mg,
        magnesium_mg:
          totals.micronutrients.magnesium_mg + log.micronutrients.magnesium_mg,
        vitamin_d_iu:
          totals.micronutrients.vitamin_d_iu + log.micronutrients.vitamin_d_iu,
        calcium_mg:
          totals.micronutrients.calcium_mg + log.micronutrients.calcium_mg,
      },
    };
  }, emptyPulseTotals());
}

export function clampPercent(consumed: number, target: number): number {
  if (target <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((consumed / target) * 100));
}

export function progressTone(percent: number): ProgressTone {
  if (percent >= 90) {
    return "emerald";
  }
  if (percent >= 50) {
    return "amber";
  }
  return "red";
}

export function buildMacroProgress(totals: PulseTotals): MacroProgress[] {
  const rows: Array<Omit<MacroProgress, "percent" | "tone">> = [
    {
      id: "calories",
      label: "Calories",
      consumed: totals.calories,
      target: PULSE_CALORIE_TARGET,
      unit: "kcal",
    },
    {
      id: "protein",
      label: "Protein",
      consumed: totals.protein_g,
      target: PULSE_PROTEIN_TARGET_G,
      unit: "g",
    },
    {
      id: "carbs",
      label: "Carbs",
      consumed: totals.carbs_g,
      target: PULSE_CARBS_TARGET_G,
      unit: "g",
    },
    {
      id: "fats",
      label: "Fats",
      consumed: totals.fats_g,
      target: PULSE_FATS_TARGET_G,
      unit: "g",
    },
  ];

  return rows.map((row) => {
    const percent = clampPercent(row.consumed, row.target);
    return { ...row, percent, tone: progressTone(percent) };
  });
}

export function buildMicroMarkers(totals: PulseTotals): MicroMarker[] {
  const markers: Array<Omit<MicroMarker, "percent" | "deficient">> = [
    {
      id: "magnesium_mg",
      name: "Magnesium",
      focus: "Recovery & Sleep",
      consumed: totals.micronutrients.magnesium_mg,
      target: PULSE_MICRO_TARGETS.magnesium_mg,
      unit: "mg",
    },
    {
      id: "vitamin_d_iu",
      name: "Vitamin D",
      focus: "Immunity & Bone Density",
      consumed: totals.micronutrients.vitamin_d_iu,
      target: PULSE_MICRO_TARGETS.vitamin_d_iu,
      unit: "IU",
    },
    {
      id: "zinc_mg",
      name: "Zinc",
      focus: "Hormonal Balance & Recovery",
      consumed: totals.micronutrients.zinc_mg,
      target: PULSE_MICRO_TARGETS.zinc_mg,
      unit: "mg",
    },
    {
      id: "iron_mg",
      name: "Iron",
      focus: "Energy & Oxygen Transport",
      consumed: totals.micronutrients.iron_mg,
      target: PULSE_MICRO_TARGETS.iron_mg,
      unit: "mg",
    },
    {
      id: "calcium_mg",
      name: "Calcium",
      focus: "Bone Strength",
      consumed: totals.micronutrients.calcium_mg,
      target: PULSE_MICRO_TARGETS.calcium_mg,
      unit: "mg",
    },
  ];

  return markers.map((marker) => {
    const percent = clampPercent(marker.consumed, marker.target);
    return { ...marker, percent, deficient: percent < 50 };
  });
}

function mealsMentionOmega3(logs: MealLog[]): boolean {
  return logs.some((log) =>
    /salmon|mackerel|sardine|fish oil|omega|hilsa|rohu|pomfret/i.test(
      `${log.query} ${log.meal_name} ${log.breakdown_summary}`
    )
  );
}

export function buildSupplementPrescriptions(
  totals: PulseTotals,
  logs: MealLog[]
): SupplementPrescription[] {
  const prescriptions: SupplementPrescription[] = [];
  const proteinGap = PULSE_PROTEIN_TARGET_G - totals.protein_g;

  if (proteinGap > 25) {
    prescriptions.push({
      id: "whey",
      name: "Whey Isolate",
      dosage: "1 scoop",
      gapLabel: `Bridges your ${Math.round(proteinGap)}g protein deficit`,
    });
  }

  if (totals.micronutrients.magnesium_mg < 300) {
    const magnesiumGap = Math.max(
      0,
      PULSE_MICRO_TARGETS.magnesium_mg - totals.micronutrients.magnesium_mg
    );
    prescriptions.push({
      id: "magnesium",
      name: "Magnesium Glycinate",
      dosage: "400mg before bed for sleep quality",
      gapLabel: `Bridges your ${Math.round(magnesiumGap)}mg Magnesium deficit`,
    });
  }

  if (totals.micronutrients.zinc_mg < 10) {
    const zincGap = Math.max(
      0,
      PULSE_MICRO_TARGETS.zinc_mg - totals.micronutrients.zinc_mg
    );
    prescriptions.push({
      id: "zinc",
      name: "Zinc Picolinate",
      dosage: "15-30mg",
      gapLabel: `Bridges your ${Math.round(zincGap * 10) / 10}mg Zinc deficit`,
    });
  }

  if (totals.micronutrients.vitamin_d_iu < 1500) {
    const vitaminDGap = Math.max(
      0,
      PULSE_MICRO_TARGETS.vitamin_d_iu - totals.micronutrients.vitamin_d_iu
    );
    prescriptions.push({
      id: "vitamin-d",
      name: "Vitamin D3 + K2",
      dosage: "2000-5000 IU",
      gapLabel: `Bridges your ${Math.round(vitaminDGap)} IU Vitamin D deficit`,
    });
  }

  if (!mealsMentionOmega3(logs)) {
    prescriptions.push({
      id: "omega-3",
      name: "Triple Strength Fish Oil",
      dosage: "1000mg capsule",
      gapLabel: "Covers daily Omega-3 not confirmed from today's meals",
    });
  }

  return prescriptions;
}

export function readinessScore(
  macros: MacroProgress[],
  micros: MicroMarker[],
  workoutLogged: boolean
): number {
  const macroAvg =
    macros.reduce((sum, item) => sum + item.percent, 0) / Math.max(macros.length, 1);
  const microAvg =
    micros.reduce((sum, item) => sum + item.percent, 0) / Math.max(micros.length, 1);
  const training = workoutLogged ? 100 : 0;
  return Math.round(macroAvg * 0.45 + microAvg * 0.4 + training * 0.15);
}

export function readinessLabel(score: number): string {
  if (score >= 70) {
    return "On Track";
  }
  if (score >= 50) {
    return "Needs Attention";
  }
  return "Off Track";
}
