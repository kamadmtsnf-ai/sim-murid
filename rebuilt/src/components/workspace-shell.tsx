"use client";
import { PwaInstallButton, PwaRequirement } from "@/components/pwa-install";
import { cancelActiveConfirmation } from "@/components/ui/confirm-action";
import { ContextualHelp } from "@/components/help/contextual-help";
import { FormNavigationGuard } from "@/components/forms/navigation-guard";
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  useId,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  School,
  Menu,
  Search,
  ChevronRight,
  LogOut,
  PanelLeft,
  LayoutDashboard,
  X,
} from "lucide-react";
import { NavigationIcon } from "./navigation-icon";
import {
  AcademicContextProvider,
  AcademicContextSummary,
  clearAcademicPreference,
} from "@/components/academic/academic-context";
import { clearSurveyDrafts } from "@/lib/services/survey-storage";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  currentNavItem,
  filterNavigation,
  type NavGroup,
} from "@/config/account-navigation";
import { FloatingLabel } from "@/components/ui/floating-label";

type Workspace = {
  navigation: NavGroup[];
  name: string;
  username: string;
  academicToday?: string;
  navigationUnavailable?: boolean;
  pwaRequired?: boolean;
};
const WorkspaceContext = createContext<Workspace | null>(null);
export const useWorkspace = () => useContext(WorkspaceContext);
export function WorkspaceShell({
  navigation,
  name,
  username,
  navigationUnavailable = false,
  pwaRequired = false,
  academicToday,
  children,
}: Workspace & { children: ReactNode }) {
  const searchId = useId();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const menuRef = useRef<HTMLButtonElement>(null);
  const desktopNav = useRef<HTMLElement>(null),
    mobileNav = useRef<HTMLElement>(null),
    desktopSearch = useRef<HTMLInputElement>(null),
    mobileSearch = useRef<HTMLInputElement>(null);
  const brandRef = useRef<HTMLAnchorElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const path = usePathname();
  const [navState, setNavState] = useState({ path, open: false, query: "", searchGroups: {} as Record<string, boolean> });
  // Reset route-owned UI before committing a new route, including back/forward.
  if (navState.path !== path) setNavState({ path, open: false, query: "", searchGroups: {} });
  const { open, query } = navState;
  const setOpen = useCallback(
    (value: boolean) => setNavState((state) => ({ ...state, open: value })),
    [],
  );
  const setQuery = useCallback(
    (value: string) => setNavState((state) => ({ ...state, query: value, searchGroups: {} })),
    [],
  );
  const drawerId = `${searchId}-drawer`;
  const displayName = name.trim() || username || "Pengguna";
  const initial = Array.from(displayName)[0]?.toLocaleUpperCase("id-ID") ?? "?";
  useEffect(() => {
    if (!open) return;
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (desktop.matches) {
        returnFocusRef.current = brandRef.current;
        setOpen(false);
      }
    };
    closeOnDesktop();
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, [open, setOpen]);
  useEffect(() => () => cancelActiveConfirmation(), [path]);
  const detailLabel = /^\/account\/directory\/[^/]+\/?$/.test(path)
    ? "Detail pengguna"
    : /^\/account\/biodata\/[^/]+\/?$/.test(path)
      ? "Detail biodata"
      : null;
  const item = currentNavItem(path, navigation),
    group = navigation.find((g) => g.items.some((i) => i.href === item?.href));
  const filtered = filterNavigation(navigation, query),
    resultCount = filtered.reduce((count, g) => count + g.items.length, 0);
  useEffect(() => {
    if (query.trim()) return;
    const frame = requestAnimationFrame(() => {
      const nav = open ? mobileNav.current : desktopNav.current;
      const current = nav?.querySelector<HTMLElement>('[aria-current="page"]');
      if (!nav || !current || !current.getClientRects().length) return;
      let scroller: HTMLElement | null = nav;
      while (scroller) {
        if (
          /auto|scroll/.test(getComputedStyle(scroller).overflowY) &&
          scroller.scrollHeight > scroller.clientHeight
        ) {
          const focused = document.activeElement;
          if (
            focused instanceof HTMLElement &&
            scroller.contains(focused) &&
            !nav.contains(focused)
          )
            return;
          const box = scroller.getBoundingClientRect(),
            link = current.getBoundingClientRect();
          if (link.top < box.top) scroller.scrollTop -= box.top - link.top;
          else if (link.bottom > box.bottom)
            scroller.scrollTop += link.bottom - box.bottom;
          break;
        }
        scroller = scroller.parentElement;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [open, path, query]);
  function clearSearch(mobile: boolean) {
    setQuery("");
    (mobile ? mobileSearch : desktopSearch).current?.focus();
  }
  function finishNavigation() {
    setOpen(false);
    setQuery("");
  }
  function signOut(compact: boolean) {
    return (
    <form
            action="/api/auth/logout"
            method="post"
            onSubmit={() => {
              clearSurveyDrafts();
              clearAcademicPreference(username);
            }}
          >
            <Button
              type="submit"
              size={compact ? "icon" : "default"}
              variant="ghost"
              aria-label="Keluar dari akun"
            >
              <LogOut aria-hidden="true" />{!compact && "Keluar akun"}
            </Button>
          </form>
    );
  }
  function navigationContent(mobile: boolean) {
    return (
      <>
        <Link
          ref={mobile ? undefined : brandRef}
          href="/account"
          prefetch={false}
          className="workspace-brand"
          onClick={finishNavigation}
        >
          <span className="brand-icon">
            <School aria-hidden="true" className="size-6" />
          </span>
          <span>
            <strong className="block text-lg">SiM-Murid</strong>
            <span className="text-xs text-muted-foreground">
              MTs Nurul Falah
            </span>
          </span>
        </Link>
        <div className="nav-search">
          <Search
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />

          <FloatingLabel htmlFor={`${searchId}-${mobile ? "mobile" : "desktop"}`} label={<>{mobile ? "Cari menu pada navigasi seluler" : "Cari menu navigasi"}</>}><input
            id={`${searchId}-${mobile ? "mobile" : "desktop"}`}
            ref={mobile ? mobileSearch : desktopSearch}
            type="search"
            placeholder="Cari menu…"
            maxLength={100}
            aria-controls={`${searchId}-nav-${mobile ? "mobile" : "desktop"}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && query) {
                e.preventDefault();
                e.stopPropagation();
                clearSearch(mobile);
              }
            }}
          /></FloatingLabel>
          {query && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="nav-search-clear"
              aria-label="Hapus pencarian menu"
              onClick={() => clearSearch(mobile)}
            >
              <X aria-hidden="true" />
            </Button>
          )}
        </div>
        {query.trim() && (
          <div role="status" className="nav-search-status space-y-1">
            <p>{resultCount} menu ditemukan</p>
            <p className="text-xs">Pencarian hanya mencakup menu yang diizinkan untuk akun Anda.</p>
            {item && group && !filtered.some(g=>g.items.some(i=>i.href===item.href)) && <p className="text-xs">Halaman saat ini: {item.label}, kelompok {group.label}. Hapus pencarian untuk melihat penandanya.</p>}
          </div>
        )}
        {navigationUnavailable && (
          <p className="navigation-notice" role="status">
            Status menu belum dapat diverifikasi. Lengkapi keamanan akun bila
            diminta; simpan pekerjaan sebelum memuat ulang.
          </p>
        )}
        <nav
          id={`${searchId}-nav-${mobile ? "mobile" : "desktop"}`}
          ref={mobile ? mobileNav : desktopNav}
          aria-label={mobile ? "Navigasi utama seluler" : "Navigasi utama"}
          className="workspace-nav"
        >
          {filtered.length ? (
            filtered.map((g) => {
              const searching = Boolean(query.trim());
              const expanded = searching ? navState.searchGroups[g.label] ?? true : expandedGroups[g.label] ?? false;
              const currentGroup = group?.label === g.label;
              const panelId = `${searchId}-${mobile ? "mobile" : "desktop"}-group-${navigation.findIndex(group => group.label === g.label)}`;
              return (
              <section key={g.label}>
                <h2 className="nav-group-heading"><button
                  type="button"
                  className="nav-group-toggle"
                  aria-label={g.label}
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  aria-describedby={currentGroup ? `${panelId}-current` : undefined}
                  data-current-group={currentGroup ? "true" : undefined}
                  onClick={() => searching
                    ? setNavState(previous=>({...previous,searchGroups:{...previous.searchGroups,[g.label]:!expanded}}))
                    : setExpandedGroups(previous => ({ ...previous, [g.label]: !expanded }))}
                >
                  <span className="min-w-0 flex-1 wrap-anywhere">{g.label}</span>
                  {currentGroup && <><span aria-hidden="true" className="nav-current-badge">Halaman aktif</span><span id={`${panelId}-current`} className="sr-only">Halaman aktif: {item?.label}. {expanded ? "Kelompok terbuka." : "Buka kelompok untuk melihat menunya."}</span></>}
                  <ChevronRight aria-hidden="true" className={expanded ? "rotate-90" : undefined} />
                </button></h2>
                <ul id={panelId} hidden={!expanded}>
                  {g.items.map((i) => (
                    <li key={i.href}>
                      <Link
                        prefetch={false}
                        href={i.href}
                        aria-current={
                          item?.href === i.href ? "page" : undefined
                        }
                        onClick={finishNavigation}
                      >
                        <NavigationIcon href={i.href} />
                        <span className="min-w-0 wrap-anywhere">{i.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
              );
            })
          ) : (
            <p
              className="px-3 text-sm text-muted-foreground"
              role={query.trim() ? undefined : "status"}
            >
              {query.trim()
                ? "Menu tidak ditemukan. Coba nama layanan atau istilah lain, atau hapus pencarian."
                : "Belum ada menu yang dapat ditampilkan untuk akun ini."}
            </p>
          )}
        </nav>
        <div className="workspace-user">
          <span className="user-avatar" aria-hidden="true">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-sm" title={displayName}>
              {displayName}
            </strong>
            <span
              className="block truncate text-xs text-muted-foreground"
              title={username}
            >
              {username}
            </span>
          </div>
          {signOut(true)}
        </div>
      </>
    );
  }
  return (
    <AcademicContextProvider
      key={username}
      username={username}
      today={academicToday}
    >
      <FormNavigationGuard>
        <PwaRequirement required={pwaRequired} signOut={signOut(false)}>
        <WorkspaceContext.Provider
          value={{ navigation, name, username, navigationUnavailable }}
        >
          <div className="workspace-shell">
            <aside
              className="workspace-sidebar"
              aria-label="Sidebar layanan madrasah"
            >
              {navigationContent(false)}
            </aside>
            <div className="workspace-body">
              <header className="workspace-topbar">
                <div className="flex min-w-0 items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 lg:hidden"
                    ref={menuRef}
                    onClick={() => {
                      returnFocusRef.current = menuRef.current;
                      setOpen(true);
                    }}
                    aria-label="Buka navigasi"
                    aria-expanded={open}
                    aria-haspopup="dialog"
                    aria-controls={open ? drawerId : undefined}
                  >
                    <Menu aria-hidden="true" />
                  </Button>
                  <PanelLeft
                    className="hidden size-4 text-muted-foreground lg:block"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <span className="block text-xs text-muted-foreground">
                      Ruang kerja madrasah
                    </span>
                    <span className="block text-sm font-semibold [overflow-wrap:anywhere]">
                      {detailLabel ?? item?.label ?? "Layanan madrasah"}
                    </span>
                  </div>
                </div>
                <AcademicContextSummary />
                <div className="workspace-identity">
                  <span className="user-avatar" aria-hidden="true">
                    {initial}
                  </span>
                  <span className="sr-only sm:hidden">
                    Masuk sebagai {displayName}
                  </span>
                  <span
                    className="hidden max-w-56 truncate text-sm sm:block"
                    title={displayName}
                  >
                    {displayName}
                  </span>
                </div>
              </header>
              <div className="workspace-content">
                <nav aria-label="Breadcrumb" className="workspace-breadcrumb">
                  <ol>
                    <li>
                      <span className="breadcrumb-home">
                        <LayoutDashboard
                          className="size-4"
                          aria-hidden="true"
                        />
                        <span
                          aria-current={
                            path === "/account" ? "page" : undefined
                          }
                        >
                          Dashboard
                        </span>
                      </span>
                    </li>
                    {item?.href !== "/account" && (
                      <>
                        {group && (
                          <li>
                            <ChevronRight aria-hidden="true" />
                            <span>{group.label}</span>
                          </li>
                        )}
                        <li>
                          <ChevronRight aria-hidden="true" />
                          <span aria-current={detailLabel ? undefined : "page"}>
                            {item?.label ?? "Detail"}
                          </span>
                        </li>
                        {detailLabel && (
                          <li>
                            <ChevronRight aria-hidden="true" />
                            <span aria-current="page">{detailLabel}</span>
                          </li>
                        )}
                      </>
                    )}
                  </ol>
                </nav>
                <ContextualHelp
                  key={path}
                  href={item?.href ?? "/account"}
                  label={detailLabel ?? item?.label ?? "Ruang kerja"}
                />
                {children}
              </div>
              <footer
                className="workspace-footer"
                aria-label="Informasi aplikasi"
              >
                <p className="font-medium">SiM-Murid · MTs Nurul Falah</p>
                <p>Data mengikuti hak akses akun Anda.</p>
                <PwaInstallButton />
              </footer>
            </div>
            <Dialog
              contentId={drawerId}
              returnFocusRef={returnFocusRef}
              open={open}
              onOpenChange={(next) => {
                setOpen(next);
                if (!next) setQuery("");
              }}
              onEscapeKeyDown={(event) => {
                if (query) {
                  event.preventDefault();
                  clearSearch(true);
                }
              }}
              title="Navigasi"
              description="Pilih layanan madrasah"
              className="workspace-drawer translate-x-0 translate-y-0"
            >
              <div className="drawer-inner">{navigationContent(true)}</div>
            </Dialog>
          </div>
        </WorkspaceContext.Provider>
        </PwaRequirement>
      </FormNavigationGuard>
    </AcademicContextProvider>
  );
}
