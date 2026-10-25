import { currentNavItem, navigationFor } from "@/config/account-navigation";

/** Page-level admission only. Record ownership and writes still require RPC/RLS checks. */
export function canAccessAccountPage(
  path: string,
  capabilities: readonly string[],
  isAdmin: boolean,
): boolean {
  if (!path.startsWith("/account") || path.includes("%") || path.includes("\\")) return false;
  const item = currentNavItem(path);
  // Unknown routes are denied even to admins; adding a page requires an explicit policy.
  if (!item) return false;
  const suffix = path.slice(item.href.length);
  if (suffix && !(
    ["/account/directory", "/account/biodata"].includes(item.href) &&
    /^\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(suffix)
  )) return false;
  return navigationFor(capabilities, isAdmin).some(group => group.items.some(link => link.href === item.href));
}
