/** Cancelable probes reuse domain guards without running a real unload. */
export const unsavedProbe = "sim-form-unsaved-check";
export const pendingProbe = "sim-form-pending-check";
export function listenForUnsavedChanges(
  handler: (event: BeforeUnloadEvent) => void,
) {
  const probe = (event: Event) => handler(event as BeforeUnloadEvent);
  window.addEventListener("beforeunload", handler);
  window.addEventListener(unsavedProbe, probe);
  return () => {
    window.removeEventListener("beforeunload", handler);
    window.removeEventListener(unsavedProbe, probe);
  };
}
export function listenForPendingWrite(isPending: () => boolean) {
  const probe = (event: Event) => {
    if (isPending()) event.preventDefault();
  };
  window.addEventListener(pendingProbe, probe);
  return () => window.removeEventListener(pendingProbe, probe);
}
export function pageHasPendingWrite() {
  return !window.dispatchEvent(new Event(pendingProbe, { cancelable: true }));
}
export function pageHasUnsavedChanges() {
  return !window.dispatchEvent(new Event(unsavedProbe, { cancelable: true }));
}
