export const GUEST_MODE_KEY = "fitness_os_guest_mode";

export function isGuestMode(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(GUEST_MODE_KEY) === "1";
}

export function setGuestMode(enabled: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  if (enabled) {
    window.localStorage.setItem(GUEST_MODE_KEY, "1");
    return;
  }
  window.localStorage.removeItem(GUEST_MODE_KEY);
}
