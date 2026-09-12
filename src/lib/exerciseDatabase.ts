export const MUSCLE_GROUPS = [
  "Chest",
  "Back",
  "Legs",
  "Shoulders",
  "Arms",
  "Core",
] as const;

export const EQUIPMENT_TYPES = [
  "Barbell",
  "Dumbbell",
  "Cable",
  "Machine",
  "Bodyweight",
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];
export type EquipmentType = (typeof EQUIPMENT_TYPES)[number];

export type LibraryExercise = {
  id: string;
  name: string;
  muscle: MuscleGroup;
  equipment: EquipmentType;
  gifUrl: string;
  stillUrl: string;
  instructions: string[];
  defaultSets: number;
};

const STILL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";
const GIF = "https://static.exercisedb.dev/media";

function still(path: string): string {
  return `${STILL}/${path}`;
}

function gif(id: string): string {
  return `${GIF}/${id}.gif`;
}

function entry(
  id: string,
  name: string,
  muscle: MuscleGroup,
  equipment: EquipmentType,
  gifId: string | null,
  stillPath: string,
  instructions: string[],
  defaultSets = 3
): LibraryExercise {
  return {
    id,
    name,
    muscle,
    equipment,
    gifUrl: gifId ? gif(gifId) : still(stillPath),
    stillUrl: still(stillPath),
    instructions,
    defaultSets,
  };
}

export const EXERCISE_DATABASE: LibraryExercise[] = [
  entry("bench-press", "Barbell Bench Press", "Chest", "Barbell", "EIeI8Vf", "Barbell_Bench_Press_-_Medium_Grip/0.jpg", ["Retract scapula and plant feet", "Lower with control to mid-chest", "Drive bar up without bouncing"]),
  entry("incline-db-press", "Incline Dumbbell Press", "Chest", "Dumbbell", "ns0SIbU", "Incline_Dumbbell_Press/0.jpg", ["Set bench ~30°", "Keep elbows ~45° from torso", "Squeeze chest at the top"]),
  entry("decline-bench", "Decline Barbell Bench Press", "Chest", "Barbell", "GrO65fd", "Decline_Barbell_Bench_Press/0.jpg", ["Secure legs on the pads", "Touch lower chest, not the neck", "Control the eccentric"]),
  entry("cable-crossover", "Cable Crossover", "Chest", "Cable", "lJJ7Yq8", "Cable_Crossover/0.jpg", ["Slight forward lean, soft elbows", "Sweep hands together at midline", "Pause the squeeze, then resist back"]),
  entry("chest-press-machine", "Chest Press Machine", "Chest", "Machine", "DOoWcnA", "Leverage_Chest_Press/0.jpg", ["Set handles at mid-chest", "Keep back glued to the pad", "Don't lock out aggressively"]),
  entry("chest-dips", "Chest Dips", "Chest", "Bodyweight", "9WTm7dq", "Dips_-_Chest_Version/0.jpg", ["Lean torso slightly forward", "Descend until shoulders are below elbows", "Press up without shrugging"]),
  entry("push-ups", "Push-ups", "Chest", "Bodyweight", "I4hDWkc", "Pushups/0.jpg", ["Brace core, body in one line", "Elbows 30–45° from torso", "Chest to floor, full lockout"]),
  entry("deadlift", "Barbell Deadlift", "Back", "Barbell", "ila4NZS", "Barbell_Deadlift/0.jpg", ["Bar over mid-foot, lats tight", "Push the floor away", "Stand tall, don't hyperextend"]),
  entry("pull-ups", "Pull-ups", "Back", "Bodyweight", "0V2YQjW", "Pullups/0.jpg", ["Full hang, ribs down", "Lead with elbows to the hips", "Chin over bar, control down"]),
  entry("chin-ups", "Chin-ups", "Back", "Bodyweight", "T2mxWqc", "Chin-Up/0.jpg", ["Supinated grip, shoulders packed", "Pull chest to the bar", "Lower to a dead hang"]),
  entry("lat-pulldown", "Lat Pulldown", "Back", "Cable", "LEprlgG", "Close-Grip_Front_Lat_Pulldown/0.jpg", ["Sit tall, slight lean back", "Pull bar to upper chest", "Don't yank with the arms only"]),
  entry("seated-cable-row", "Seated Cable Row", "Back", "Cable", "fUBheHs", "Seated_Cable_Rows/0.jpg", ["Neutral spine, proud chest", "Retract scapula before the pull", "Stop at the torso, don't shrug"]),
  entry("barbell-row", "Barbell Bent-Over Row", "Back", "Barbell", "eZyBC3j", "Bent_Over_Barbell_Row/0.jpg", ["Hinge ~45°, back flat", "Row to the hip, not the neck", "Control eccentric"]),
  entry("db-row", "One-Arm Dumbbell Row", "Back", "Dumbbell", "C0MA9bC", "One-Arm_Dumbbell_Row/0.jpg", ["Bench-supported, square hips", "Pull elbow to hip pocket", "Pause, then lower slowly"]),
  entry("back-squat", "Barbell Back Squat", "Legs", "Barbell", "qXTaZnJ", "Barbell_Squat/0.jpg", ["Brace, break at hips and knees", "Knees track over toes", "Drive up through mid-foot"]),
  entry("front-squat", "Barbell Front Squat", "Legs", "Barbell", "zG0zs85", "Front_Squat_Clean_Grip/0.jpg", ["Elbows high, torso vertical", "Sit between the heels", "Don't let the bar peel away"]),
  entry("leg-press", "Leg Press", "Legs", "Machine", "7zdxRTl", "Leg_Press/0.jpg", ["Feet mid-platform, full foot contact", "Don't let lumbar peel off the pad", "Control the descent"]),
  entry("rdl", "Romanian Deadlift", "Legs", "Barbell", "wQ2c4XD", "Romanian_Deadlift/0.jpg", ["Soft knees, push hips back", "Bar stays close to legs", "Hamstring stretch, then squeeze glutes"]),
  entry("leg-extension", "Leg Extension", "Legs", "Machine", "my33uHU", "Leg_Extensions/0.jpg", ["Pad on lower shin, not the foot", "Extend without swinging", "Squeeze quads at lockout"]),
  entry("leg-curl", "Lying Leg Curl", "Legs", "Machine", "17lJ1kr", "Lying_Leg_Curls/0.jpg", ["Hips pinned to the pad", "Curl heels to glutes", "Don't let the weight slam"]),
  entry("db-lunge", "Dumbbell Walking Lunge", "Legs", "Dumbbell", "IZVHb27", "Dumbbell_Lunges/0.jpg", ["Long enough stride to stay tall", "Front knee tracks the toes", "Push off the front heel"]),
  entry("calf-raise", "Standing Calf Raise", "Legs", "Machine", "8ozhUIZ", "Standing_Calf_Raises/0.jpg", ["Full stretch at the bottom", "Don't bounce out of the hole", "Pause the squeeze at the top"]),
  entry("ohp", "Barbell Overhead Press", "Shoulders", "Barbell", "CggQhII", "Seated_Barbell_Military_Press/0.jpg", ["Ribs down, glutes tight", "Bar path close to the face", "Head through at lockout"]),
  entry("arnold-press", "Arnold Press", "Shoulders", "Dumbbell", "Xy4jlWA", "Arnold_Dumbbell_Press/0.jpg", ["Start palms in, rotate as you press", "Don't flare elbows behind the body", "Control the reverse rotation"]),
  entry("lateral-raise", "Dumbbell Lateral Raise", "Shoulders", "Dumbbell", "DsgkuIt", "Side_Lateral_Raise/0.jpg", ["Soft elbows, lead with elbows", "Stop at shoulder height", "Lower slower than you lift"]),
  entry("face-pulls", "Face Pulls", "Shoulders", "Cable", "wqNPGCg", "Face_Pull/0.jpg", ["Rope to eye line", "Externally rotate at the end", "Don't turn it into a row"]),
  entry("rear-delt-fly", "Rear Delt Fly", "Shoulders", "Dumbbell", "v1qBec9", "Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench/0.jpg", ["Hinge, arms almost straight", "Sweep out, not back to the hips", "Pinch rear delts, not traps"]),
  entry("cable-lateral", "Cable Lateral Raise", "Shoulders", "Cable", "goJ6ezq", "Cable_Seated_Lateral_Raise/0.jpg", ["Cable behind the body", "Raise to shoulder height", "Constant tension, no swing"]),
  entry("barbell-curl", "Barbell Bicep Curl", "Arms", "Barbell", "25GPyDY", "Barbell_Curl/0.jpg", ["Elbows pinned to the sides", "Don't swing the torso", "Squeeze hard, lower under control"]),
  entry("hammer-curl", "Hammer Curl", "Arms", "Dumbbell", "slDvUAU", "Hammer_Curls/0.jpg", ["Neutral grip, wrists straight", "Curl without rolling the shoulders", "Full stretch at the bottom"]),
  entry("preacher-curl", "Preacher Curl", "Arms", "Barbell", "qOgPVf6", "Preacher_Curl/0.jpg", ["Upper arms glued to the pad", "Don't hyperextend the bottom", "Curl to ~90% lockout"]),
  entry("cable-curl", "Cable Bicep Curl", "Arms", "Cable", "G08RZcQ", "Lying_Cable_Curl/0.jpg", ["Stand close enough for tension", "Elbows stay still", "Squeeze 1s at the top"]),
  entry("rope-pushdown", "Tricep Rope Pushdown", "Arms", "Cable", "3ZflifB", "Triceps_Pushdown/0.jpg", ["Elbows glued to ribs", "Spread the rope at lockout", "Don't let the stack yank up"]),
  entry("skull-crushers", "Skull Crushers", "Arms", "Barbell", "mpKZGWz", "EZ-Bar_Skullcrusher/0.jpg", ["Upper arms vertical", "Lower to forehead / hairline", "Extend without flaring wildly"]),
  entry("cg-bench", "Close-Grip Bench Press", "Arms", "Barbell", "J6Dx1Mu", "Close-Grip_Barbell_Bench_Press/0.jpg", ["Grip just inside shoulders", "Elbows tuck, not flare", "Touch lower chest"]),
  entry("plank", "Plank", "Core", "Bodyweight", "VBAWRPG", "Plank/0.jpg", ["Elbows under shoulders", "Ribs down, glutes on", "Don't let hips pike or sag"]),
  entry("hanging-leg-raise", "Hanging Leg Raise", "Core", "Bodyweight", "I3tsCnC", "Hanging_Leg_Raise/0.jpg", ["Dead hang, scapula packed", "Lift with the abs, not swing", "Control the descent"]),
  entry("cable-crunch", "Cable Crunch", "Core", "Cable", "WW95auq", "Cable_Crunch/0.jpg", ["Round the spine, not the hips", "Pull ribs to pelvis", "Pause the crunch"]),
  entry("ab-wheel", "Ab Wheel Rollout", "Core", "Bodyweight", "NAgVB3t", "Ab_Roller/0.jpg", ["Posterior pelvic tilt", "Roll out without losing brace", "Stop before the low back dumps"]),
  entry("russian-twist", "Russian Twist", "Core", "Bodyweight", "XVDdcoj", "Russian_Twist/0.jpg", ["Lean back with a long spine", "Rotate shoulders, not just hands", "Tap each side with control"]),
];

export function findExerciseByName(name: string): LibraryExercise | undefined {
  const needle = name.trim().toLowerCase();
  return EXERCISE_DATABASE.find((exercise) => exercise.name.toLowerCase() === needle);
}

export function filterExerciseDatabase(
  query: string,
  muscle: MuscleGroup | "All",
  equipment: EquipmentType | "All"
): LibraryExercise[] {
  const normalized = query.trim().toLowerCase();
  return EXERCISE_DATABASE.filter((exercise) => {
    const matchesMuscle = muscle === "All" || exercise.muscle === muscle;
    const matchesEquipment = equipment === "All" || exercise.equipment === equipment;
    const matchesQuery =
      normalized.length === 0 ||
      exercise.name.toLowerCase().includes(normalized) ||
      exercise.muscle.toLowerCase().includes(normalized) ||
      exercise.equipment.toLowerCase().includes(normalized);
    return matchesMuscle && matchesEquipment && matchesQuery;
  });
}
