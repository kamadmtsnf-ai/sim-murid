import { useSyncExternalStore } from "react";
export { useRouter } from "./access-navigation-shim";
function subscribe(notify: () => void) {
  window.addEventListener("popstate", notify);
  return () => window.removeEventListener("popstate", notify);
}
function snapshot() {
  return location.pathname === "/" ? "/account" : location.pathname;
}
export function usePathname() {
  return useSyncExternalStore(subscribe, snapshot, () => "/account");
}
