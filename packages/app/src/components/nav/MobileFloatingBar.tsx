"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icons/Icons";
import { useAuth } from "@/lib/auth/useAuth";

type BarState = "default" | "expanded" | "search" | "detail";
type TabId = "browse" | "upcoming" | "feed";

const TAB_CONFIG: { id: TabId; icon: IconName; label: string; href: string }[] = [
  { id: "browse", icon: "compass", label: "Browse", href: "/browse" },
  { id: "upcoming", icon: "map-pin", label: "Map", href: "/upcoming" },
  { id: "feed", icon: "lightning", label: "Feed", href: "/feed" },
];

const DETAIL_ROUTES = ["/performances/", "/runs/", "/showings/", "/venues/", "/people/", "/companies/"];

function isDetailRoute(pathname: string): boolean {
  return DETAIL_ROUTES.some((r) => pathname.startsWith(r));
}

function getTabFromPathname(pathname: string): TabId | null {
  for (const tab of TAB_CONFIG) {
    if (pathname.startsWith(tab.href)) return tab.id;
  }
  return null;
}

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const DURATION = "220ms";

const iconBtn = "flex items-center justify-center w-8 h-8 rounded-full transition-all";
const iconBtnMuted = `${iconBtn} text-curtn-muted hover:bg-curtn-cream/5 hover:text-curtn-cream`;
const iconBtnActive = `${iconBtn} text-curtn-coral hover:bg-curtn-cream/5`;

function StateLayer({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-center gap-1 w-full"
      style={{
        position: active ? "relative" : "absolute",
        top: active ? undefined : 0,
        left: active ? undefined : 0,
        right: active ? undefined : 0,
        opacity: active ? 1 : 0,
        transform: active ? "scale(1)" : "scale(0.95)",
        pointerEvents: active ? "auto" : "none",
        transition: `opacity ${DURATION} ${EASE}, transform ${DURATION} ${EASE}`,
      }}
    >
      {children}
    </div>
  );
}

export function MobileFloatingBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  const [barState, setBarState] = useState<BarState>("default");
  const [lastTab, setLastTab] = useState<TabId>("browse");
  const [searchQuery, setSearchQuery] = useState("");
  const [shrunk, setShrunk] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const tab = getTabFromPathname(pathname);
    if (tab) setLastTab(tab);
  }, [pathname]);

  useEffect(() => {
    if (isDetailRoute(pathname)) {
      setBarState("detail");
    } else if (barState === "detail") {
      setBarState("default");
    }
  }, [pathname]);

  useEffect(() => {
    if (barState === "search") {
      setTimeout(() => searchInputRef.current?.focus(), 80);
    }
  }, [barState]);

  useEffect(() => {
    function handleScroll() {
      const y = window.scrollY;
      const delta = y - lastScrollY.current;
      if (delta > 8 && y > 60) setShrunk(true);
      else if (delta < -8) setShrunk(false);
      lastScrollY.current = y;
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const unShrink = useCallback(() => { if (shrunk) setShrunk(false); }, [shrunk]);

  const navigateTo = useCallback((href: string) => { router.push(href); }, [router]);

  const handleTabTap = useCallback(() => {
    unShrink();
    const tab = TAB_CONFIG.find((t) => t.id === lastTab);
    if (tab) navigateTo(tab.href);
    setBarState("expanded");
  }, [lastTab, navigateTo, unShrink]);

  const handleExpandedTab = useCallback((tab: typeof TAB_CONFIG[number]) => {
    navigateTo(tab.href);
    setTimeout(() => setBarState("default"), 300);
  }, [navigateTo]);

  const handleSearch = useCallback(() => {
    unShrink();
    setBarState("search");
    setSearchQuery("");
    navigateTo("/search");
  }, [navigateTo, unShrink]);

  const handleSearchInput = useCallback((value: string) => {
    setSearchQuery(value);
    if (value.trim()) {
      router.replace(`/search?q=${encodeURIComponent(value.trim())}`, { scroll: false });
    } else {
      router.replace("/search", { scroll: false });
    }
  }, [router]);

  const handleSearchSubmit = useCallback(() => {
    if (searchQuery.trim()) {
      navigateTo(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setBarState("default");
      setSearchQuery("");
    }
  }, [searchQuery, navigateTo]);

  const handleCloseSearch = useCallback(() => {
    setSearchQuery("");
    router.back();
  }, [router]);

  const handleLog = useCallback(() => {
    unShrink();
    navigateTo("/log");
  }, [navigateTo, unShrink]);

  const handleBack = useCallback(() => { router.back(); }, [router]);

  const lastTabConfig = TAB_CONFIG.find((t) => t.id === lastTab)!;
  const currentTab = getTabFromPathname(pathname);

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="px-5 pb-0.5">

        {/* Compact pill when shrunk */}
        <div
          className="flex justify-center"
          style={{
            transition: `all 300ms ${EASE}`,
            opacity: shrunk ? 1 : 0,
            transform: shrunk ? "scale(1)" : "scale(0.8)",
            pointerEvents: shrunk ? "auto" : "none",
            position: shrunk ? "relative" : "absolute",
            height: shrunk ? "auto" : 0,
            left: 0, right: 0,
          }}
          onClick={unShrink}
        >
          <div className="w-12 h-8 rounded-full bg-curtn-coral/80 backdrop-blur-md flex items-center justify-center cursor-pointer shadow-md shadow-black/20">
            <div className="w-1.5 h-1.5 rounded-full bg-curtn-deep" />
          </div>
        </div>

        {/* Full bar + plus button */}
        <div
          className="flex items-center justify-center gap-2"
          style={{
            transition: `all 300ms ${EASE}`,
            opacity: shrunk ? 0 : 1,
            transform: shrunk ? "translateY(8px) scale(0.95)" : "translateY(0) scale(1)",
            pointerEvents: shrunk ? "none" : "auto",
            position: shrunk ? "absolute" : "relative",
            left: shrunk ? "1.25rem" : undefined,
            right: shrunk ? "1.25rem" : undefined,
            bottom: shrunk ? "0.125rem" : undefined,
          }}
        >
          {/* Nav bar */}
          <div
            className="nav-bar inline-flex"
            style={{ transition: `all ${DURATION} ${EASE}` }}
          >
            <div className="relative p-0.5 flex items-center justify-center">

              {/* DEFAULT */}
              <StateLayer active={barState === "default"}>
                <button type="button" onClick={handleTabTap} className={iconBtnActive} aria-label={lastTabConfig.label}>
                  <Icon name={lastTabConfig.icon} weight={currentTab === lastTab ? "fill" : "regular"} size={20} />
                </button>
                <button type="button" onClick={handleSearch} className={iconBtnMuted} aria-label="Search">
                  <Icon name="magnifying-glass" size={20} />
                </button>
              </StateLayer>

              {/* EXPANDED */}
              <StateLayer active={barState === "expanded"}>
                {TAB_CONFIG.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleExpandedTab(tab)}
                    className={`flex flex-col items-center justify-center gap-0.5 w-8 h-8 rounded-full transition-all ${
                      currentTab === tab.id
                        ? "text-curtn-coral bg-curtn-cream/5"
                        : "text-curtn-muted hover:text-curtn-cream hover:bg-curtn-cream/5"
                    }`}
                  >
                    <Icon name={tab.icon} weight={currentTab === tab.id ? "fill" : "regular"} size={16} />
                    <span className="text-[8px] font-medium leading-none">{tab.label}</span>
                  </button>
                ))}
                <button type="button" onClick={() => setBarState("default")} className={`${iconBtn} w-8 text-curtn-muted hover:text-curtn-cream hover:bg-curtn-cream/5`} aria-label="Close">
                  <Icon name="plus" weight="regular" size={18} className="rotate-45" />
                </button>
              </StateLayer>

              {/* SEARCH */}
              <StateLayer active={barState === "search"}>
                <div className="flex-1 flex items-center gap-2 pl-3">
                  <Icon name="magnifying-glass" size={16} className="text-curtn-muted shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()}
                    placeholder="Shows, venues, people..."
                    className="flex-1 bg-transparent text-sm text-curtn-cream placeholder:text-curtn-muted/50 outline-none py-2 min-w-0"
                  />
                </div>
                <button type="button" onClick={handleCloseSearch} className={`${iconBtn} w-8 text-curtn-muted hover:text-curtn-cream hover:bg-curtn-cream/5 shrink-0`} aria-label="Close search">
                  <Icon name="plus" weight="regular" size={18} className="rotate-45" />
                </button>
              </StateLayer>

              {/* DETAIL */}
              <StateLayer active={barState === "detail"}>
                <button type="button" onClick={handleBack} className={iconBtnMuted} aria-label="Back">
                  <Icon name="arrow-left" size={20} />
                </button>
                <button type="button" onClick={handleSearch} className={iconBtnMuted} aria-label="Search">
                  <Icon name="magnifying-glass" size={20} />
                </button>
                <button type="button" onClick={() => {}} className={iconBtnMuted} aria-label="Watchlist">
                  <Icon name="heart" size={20} />
                </button>
              </StateLayer>

            </div>
          </div>

          {/* Plus button — always outside the bar, to the right */}
          <button
            type="button"
            onClick={handleLog}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-curtn-coral text-curtn-deep transition-all hover:bg-curtn-red active:scale-95 shadow-lg shadow-black/20 shrink-0"
            aria-label="Log a performance"
          >
            <Icon name="plus" weight="bold" size={20} />
          </button>
        </div>

      </div>
    </div>
  );
}
