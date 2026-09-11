import { supabase } from "@/lib/supabase";
import type { MealLog } from "@/lib/diet-types";

async function getUserId(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return null;
    }
    return data.user.id;
  } catch {
    return null;
  }
}

function toRow(log: MealLog, userId: string) {
  return {
    id: log.id,
    user_id: userId,
    meal_name: log.meal_name,
    serving_inferred: log.serving_inferred,
    calories: log.calories,
    protein_g: log.protein_g,
    carbs_g: log.carbs_g,
    fats_g: log.fats_g,
    fiber_g: log.fiber_g,
    iron_mg: log.micronutrients.iron_mg,
    zinc_mg: log.micronutrients.zinc_mg,
    magnesium_mg: log.micronutrients.magnesium_mg,
    vitamin_d_iu: log.micronutrients.vitamin_d_iu,
    calcium_mg: log.micronutrients.calcium_mg,
    vitamin_b12_mcg: log.micronutrients.vitamin_b12_mcg,
    breakdown_summary: log.breakdown_summary,
    query: log.query,
    logged_at: log.logged_at,
  };
}

function fromRow(row: Record<string, unknown>): MealLog | null {
  const id = typeof row.id === "string" ? row.id : null;
  const mealName = typeof row.meal_name === "string" ? row.meal_name : null;
  const loggedAt =
    typeof row.logged_at === "string"
      ? row.logged_at
      : typeof row.created_at === "string"
        ? row.created_at
        : null;

  if (!id || !mealName || !loggedAt) {
    return null;
  }

  const asNumber = (value: unknown): number =>
    typeof value === "number" && Number.isFinite(value) ? value : 0;

  return {
    id,
    query: typeof row.query === "string" ? row.query : mealName,
    meal_name: mealName,
    serving_inferred:
      typeof row.serving_inferred === "string" ? row.serving_inferred : mealName,
    calories: asNumber(row.calories),
    protein_g: asNumber(row.protein_g),
    carbs_g: asNumber(row.carbs_g),
    fats_g: asNumber(row.fats_g),
    fiber: asNumber(row.fiber_g ?? row.fiber),
    fiber_g: asNumber(row.fiber_g ?? row.fiber),
    micros: {
      iron_mg: asNumber(row.iron_mg),
      zinc_mg: asNumber(row.zinc_mg),
      magnesium_mg: asNumber(row.magnesium_mg),
      vitamin_d_iu: asNumber(row.vitamin_d_iu),
      calcium_mg: asNumber(row.calcium_mg),
      vitamin_b12_mcg: asNumber(row.vitamin_b12_mcg),
    },
    micronutrients: {
      iron_mg: asNumber(row.iron_mg),
      zinc_mg: asNumber(row.zinc_mg),
      magnesium_mg: asNumber(row.magnesium_mg),
      vitamin_d_iu: asNumber(row.vitamin_d_iu),
      calcium_mg: asNumber(row.calcium_mg),
      vitamin_b12_mcg: asNumber(row.vitamin_b12_mcg),
    },
    breakdown_summary:
      typeof row.breakdown_summary === "string" ? row.breakdown_summary : "",
    logged_at: loggedAt,
  };
}

export async function fetchRemoteMealLogs(dayStartIso: string): Promise<MealLog[] | null> {
  const userId = await getUserId();
  if (!userId) {
    return null;
  }

  const { data, error } = await supabase
    .from("meal_logs")
    .select("*")
    .eq("user_id", userId)
    .gte("logged_at", dayStartIso)
    .order("logged_at", { ascending: false });

  if (error || !data) {
    return null;
  }

  return data
    .map((row) => fromRow(row as Record<string, unknown>))
    .filter((log): log is MealLog => log !== null);
}

export async function insertRemoteMealLog(log: MealLog): Promise<boolean> {
  const userId = await getUserId();
  if (!userId) {
    return false;
  }

  const { error } = await supabase.from("meal_logs").insert(toRow(log, userId));
  return !error;
}

export async function deleteRemoteMealLog(id: string): Promise<boolean> {
  const userId = await getUserId();
  if (!userId) {
    return false;
  }

  const { error } = await supabase
    .from("meal_logs")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  return !error;
}
