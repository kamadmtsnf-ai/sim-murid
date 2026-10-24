export function usePathname() { return "/account/classes"; }
const router = {
  push: (url: string) => { document.documentElement.dataset.pushed = url; },
  replace: (url: string) => { document.documentElement.dataset.destination = url; },
  refresh: () => {},
  prefetch: () => {},
};
export function useRouter() { return router; }
