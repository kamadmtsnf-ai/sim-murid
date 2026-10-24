export function usePathname() {
  return "/account/sessions";
}
const router = {
  refresh: () => {
    document.documentElement.dataset.refreshes = String(
      Number(document.documentElement.dataset.refreshes ?? 0) + 1,
    );
  },
  replace: (url: string) => {
    document.documentElement.dataset.destination = url;
  },
  push: () => {},
  prefetch: () => {},
};
export function useRouter() {
  return router;
}
