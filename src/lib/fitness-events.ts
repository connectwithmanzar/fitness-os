export const FITNESS_DATA_CHANGED_EVENT = "fitness-os:data-changed";
export const WORKOUT_SESSION_CHANGED_EVENT = "fitness-os:session-changed";

export function notifyFitnessDataChanged(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(FITNESS_DATA_CHANGED_EVENT));
}

export function notifyWorkoutSessionChanged(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(WORKOUT_SESSION_CHANGED_EVENT));
}
