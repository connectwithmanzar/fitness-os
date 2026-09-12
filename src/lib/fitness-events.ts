export const FITNESS_DATA_CHANGED_EVENT = "fitness-os:data-changed";

export function notifyFitnessDataChanged(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(FITNESS_DATA_CHANGED_EVENT));
}
