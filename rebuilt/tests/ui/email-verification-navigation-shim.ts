export function usePathname() {
  return "/account/email";
}
export function useRouter() {
  return {
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
}
