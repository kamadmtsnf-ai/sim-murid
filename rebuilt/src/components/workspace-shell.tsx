"use client";
import { FormNavigationGuard } from "@/components/forms/navigation-guard";
import {
  createContext,
  useContext,
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
type Workspace = {
  navigation: NavGroup[];
  name: string;
  username: string;
  academicToday?: string;
  navigationUnavailable?: boolean;
};
const WorkspaceContext = createContext<Workspace | null>(null);
export const useWorkspace = () => useContext(WorkspaceContext);
export function WorkspaceShell({
  navigation,
  name,
  username,
  navigationUnavailable = false,
  academicToday,
  children,
}: Workspace & { children: ReactNode }) {
  const searchId = useId();
  const menuRef = useRef<HTMLButtonElement>(null);
  const desktopNav = useRef<HTMLElement>(null),
    mobileNav = useRef<HTMLElement>(null),
    desktopSearch = useRef<HTMLInputElement>(null),
    mobileSearch = useRef<HTMLInputElement>(null);
  const brandRef = useRef<HTMLAnchorElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const path = usePathname(),
    [open, setOpen] = useState(false),
    [query, setQuery] = useState("");
  useEffect(() => {
    if (!open) return;
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (desktop.matches) {
        returnFocusRef.current = brandRef.current;
        setOpen(false);
      }
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, [open]);
  const isDirectoryDetail = /^\/account\/directory\/[^/]+\/?$/.test(path);
  const item = currentNavItem(path),
    group = navigation.find((g) => g.items.some((i) => i.href === item?.href));
  const filtered = filterNavigation(navigation, query),
    resultCount = filtered.reduce((count, g) => count + g.items.length, 0);
  useEffect(() => {
    if (query.trim()) return;
    const frame = requestAnimationFrame(() => {
      const nav = open ? mobileNav.current : desktopNav.current;
      const current = nav?.querySelector<HTMLElement>('[aria-current="page"]');
      if (!nav || !current) return;
      let scroller: HTMLElement | null = nav;
      while (scroller) {
        if (
          /auto|scroll/.test(getComputedStyle(scroller).overflowY) &&
          scroller.scrollHeight > scroller.clientHeight
        ) {
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
          <label className="sr-only" htmlFor={`${searchId}-${mobile ? "mobile" : "desktop"}`}>
            {mobile ? "Cari menu pada navigasi seluler" : "Cari menu navigasi"}
          </label>
          <input
            id={`${searchId}-${mobile ? "mobile" : "desktop"}`}
            ref={mobile ? mobileSearch : desktopSearch}
            type="search"
            placeholder="Cari menu…"
            maxLength={100}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && query) {
                e.preventDefault();
                e.stopPropagation();
                clearSearch(mobile);
              }
            }}
          />
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
          <p role="status" className="nav-search-status">
            {resultCount} menu ditemukan
          </p>
        )}
        <nav
          ref={mobile ? mobileNav : desktopNav}
          aria-label={mobile ? "Navigasi utama seluler" : "Navigasi utama"}
          className="workspace-nav"
        >
          {filtered.length ? (
            filtered.map((g) => (
              <section key={g.label}>
                <h2>{g.label}</h2>
                <ul>
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
            ))
          ) : (
            <p className="px-3 text-sm text-muted-foreground" role="status">
              Menu tidak ditemukan. Coba kata lain.
            </p>
          )}
        </nav>
        <div className="workspace-user">
          <span className="user-avatar" aria-hidden="true">
            {name.slice(0, 1).toLocaleUpperCase("id-ID")}
          </span>
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-sm" title={name}>
              {name}
            </strong>
            <span
              className="block truncate text-xs text-muted-foreground"
              title={username}
            >
              {username}
            </span>
          </div>
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
              size="icon"
              variant="ghost"
              aria-label="Keluar dari akun"
            >
              <LogOut aria-hidden="true" />
            </Button>
          </form>
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
                  >
                    <Menu aria-hidden="true" />
                  </Button>
                  <PanelLeft
                    className="hidden size-4 text-muted-foreground lg:block"
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium">
                    Ruang kerja madrasah
                  </span>
                </div>
                <AcademicContextSummary />
                <div className="workspace-identity">
                  <span className="user-avatar" aria-hidden="true">
                    {name.slice(0, 1).toLocaleUpperCase("id-ID")}
                  </span>
                  <span className="hidden max-w-56 truncate text-sm sm:block">
                    {name}
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
                          <span
                            aria-current={
                              isDirectoryDetail ? undefined : "page"
                            }
                          >
                            {item?.label ?? "Detail"}
                          </span>
                        </li>
                        {isDirectoryDetail && (
                          <li>
                            <ChevronRight aria-hidden="true" />
                            <span aria-current="page">Detail pengguna</span>
                          </li>
                        )}
                      </>
                    )}
                  </ol>
                </nav>
                {children}
              </div>
              <footer className="workspace-footer">
                SiM-Murid · MTs Nurul Falah
                <span>Data mengikuti hak akses akun Anda.</span>
              </footer>
            </div>
            <Dialog
              returnFocusRef={returnFocusRef}
              open={open}
              onOpenChange={(next) => {
                setOpen(next);
                if (!next) setQuery("");
              }}
              onEscapeKeyDown={event => { if(query) { event.preventDefault(); clearSearch(true); } }}
              title="Navigasi"
              description="Pilih layanan madrasah"
              className="workspace-drawer translate-x-0 translate-y-0"
            >
              <div className="drawer-inner">{navigationContent(true)}</div>
            </Dialog>
          </div>
        </WorkspaceContext.Provider>
      </FormNavigationGuard>
    </AcademicContextProvider>
  );
}
