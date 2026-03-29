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

// Routes that trigger the detail bar state
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

// Quintic ease-out: cubic-bezier(0.22, 1, 0.36, 1)
const TRANSITION = "all 220ms cubic-bezier(0.22, 1, 0.36, 1)";

export function MobileFloatingBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  const [barState, setBarState] = useState<BarState>("default");
  const [lastTab, setLastTab] = useState<TabId>("browse");
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Track last visited tab
  useEffect(() => {
    const tab = getTabFromPathname(pathname);
    if (tab) setLastTab(tab);
  }, [pathname]);

  // Auto-set detail state on detail routes
  useEffect(() => {
    if (isDetailRoute(pathname)) {
      setBarState("detail");
    } else if (barState === "detail") {
      setBarState("default");
    }
  }, [pathname]);

  // Focus search input when entering search state
  useEffect(() => {
    if (barState === "search") {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [barState]);

  const navigateTo = useCallback((href: string) => {
    router.push(href);
  }, [router]);

  const handleTabTap = useCallback(() => {
    const tab = TAB_CONFIG.find((t) => t.id === lastTab);
    if (tab) navigateTo(tab.href);
    setBarState("expanded");
  }, [lastTab, navigateTo]);

  const handleExpandedTab = useCallback((tab: typeof TAB_CONFIG[number]) => {
    navigateTo(tab.href);
    // Stay expanded briefly to show selection, then collapse
    setTimeout(() => setBarState("default"), 300);
  }, [navigateTo]);

  const handleSearch = useCallback(() => {
    setBarState("search");
    setSearchQuery("");
  }, []);

  const handleSearchSubmit = useCallback(() => {
    if (searchQuery.trim()) {
      navigateTo(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setBarState("default");
      setSearchQuery("");
    }
  }, [searchQuery, navigateTo]);

  const handleCloseSearch = useCallback(() => {
    setBarState(isDetailRoute(pathname) ? "detail" : "default");
    setSearchQuery("");
  }, [pathname]);

  const handleLog = useCallback(() => {
    navigateTo("/log");
  }, [navigateTo]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const lastTabConfig = TAB_CONFIG.find((t) => t.id === lastTab)!;
  const currentTab = getTabFromPathname(pathname);

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="px-4 pb-3">
        <div
          className="mx-auto max-w-sm rounded-2xl border border-curtn-dark/40 bg-curtn-surface/90 backdrop-blur-md shadow-lg shadow-black/30"
          style={{ transition: TRANSITION }}
        >
          <div className="flex items-center justify-center gap-1 p-1.5" style={{ transition: TRANSITION }}>

            {/* === DEFAULT STATE === */}
            {barState === "default" && (
              <>
                <button
                  type="button"
                  onClick={handleTabTap}
                  className="flex items-center justify-center w-12 h-10 rounded-xl text-curtn-cream transition-colors hover:bg-curtn-cream/5"
                  aria-label={lastTabConfig.label}
                >
                  <Icon name={lastTabConfig.icon} weight={currentTab === lastTab ? "fill" : "regular"} size={20} />
                </button>
                <button
                  type="button"
                  onClick={handleSearch}
                  className="flex items-center justify-center w-12 h-10 rounded-xl text-curtn-muted transition-colors hover:bg-curtn-cream/5 hover:text-curtn-cream"
                  aria-label="Search"
                >
                  <Icon name="magnifying-glass" size={20} />
                </button>
                <button
                  type="button"
                  onClick={handleLog}
                  className="flex items-center justify-center w-12 h-10 rounded-xl bg-curtn-coral text-curtn-deep transition-colors hover:bg-curtn-red"
                  aria-label="Log a performance"
                >
                  <Icon name="plus" weight="bold" size={18} />
                </button>
              </>
            )}

            {/* === EXPANDED STATE === */}
            {barState === "expanded" && (
              <>
                {TAB_CONFIG.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleExpandedTab(tab)}
                    className={`flex flex-col items-center justify-center gap-0.5 w-14 h-12 rounded-xl transition-colors ${
                      currentTab === tab.id
                        ? "text-curtn-cream bg-curtn-cream/10"
                        : "text-curtn-muted hover:text-curtn-cream hover:bg-curtn-cream/5"
                    }`}
                  >
                    <Icon name={tab.icon} weight={currentTab === tab.id ? "fill" : "regular"} size={18} />
                    <span className="text-[9px] font-medium leading-none">{tab.label}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setBarState("default")}
                  className="flex items-center justify-center w-10 h-10 rounded-xl text-curtn-muted transition-colors hover:text-curtn-cream hover:bg-curtn-cream/5"
                  aria-label="Close"
                >
                  <Icon name="plus" weight="regular" size={16} className="rotate-45" />
                </button>
              </>
            )}

            {/* === SEARCH STATE === */}
            {barState === "search" && (
              <>
                <div className="flex-1 flex items-center gap-2 pl-3">
                  <Icon name="magnifying-glass" size={16} className="text-curtn-muted shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()}
                    placeholder="Shows, venues, people..."
                    className="flex-1 bg-transparent text-sm text-curtn-cream placeholder:text-curtn-muted/50 outline-none py-2.5 min-w-0"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCloseSearch}
                  className="flex items-center justify-center w-10 h-10 rounded-xl text-curtn-muted transition-colors hover:text-curtn-cream hover:bg-curtn-cream/5 shrink-0"
                  aria-label="Close search"
                >
                  <Icon name="plus" weight="regular" size={16} className="rotate-45" />
                </button>
              </>
            )}

            {/* === DETAIL STATE === */}
            {barState === "detail" && (
              <>
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex items-center justify-center w-12 h-10 rounded-xl text-curtn-muted transition-colors hover:bg-curtn-cream/5 hover:text-curtn-cream"
                  aria-label="Back"
                >
                  <Icon name="arrow-left" size={20} />
                </button>
                <button
                  type="button"
                  onClick={handleSearch}
                  className="flex items-center justify-center w-12 h-10 rounded-xl text-curtn-muted transition-colors hover:bg-curtn-cream/5 hover:text-curtn-cream"
                  aria-label="Search"
                >
                  <Icon name="magnifying-glass" size={20} />
                </button>
                <button
                  type="button"
                  onClick={handleLog}
                  className="flex items-center justify-center w-12 h-10 rounded-xl bg-curtn-coral text-curtn-deep transition-colors hover:bg-curtn-red"
                  aria-label="Log this show"
                >
                  <Icon name="plus" weight="bold" size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => {/* TODO: watchlist toggle */}}
                  className="flex items-center justify-center w-12 h-10 rounded-xl text-curtn-muted transition-colors hover:bg-curtn-cream/5 hover:text-curtn-cream"
                  aria-label="Watchlist"
                >
                  <Icon name="heart" size={20} />
                </button>
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
