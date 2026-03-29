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
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const tab = getTabFromPathname(pathname);
    if (tab) setLastTab(tab);
  }, [pathname]);

  useEffect(() => {
    // Only auto-set state on navigation — don't override expanded/search
    if (isDetailRoute(pathname)) {
      setBarState((prev) => prev === "expanded" || prev === "search" ? prev : "detail");
    } else {
      setBarState((prev) => prev === "detail" ? "default" : prev);
    }
  }, [pathname]);

  useEffect(() => {
    if (barState === "search") {
      setTimeout(() => searchInputRef.current?.focus(), 80);
    }
  }, [barState]);

  const navigateTo = useCallback((href: string) => { router.push(href); }, [router]);

  const handleTabTap = useCallback(() => {
    const tab = TAB_CONFIG.find((t) => t.id === lastTab);
    if (tab) navigateTo(tab.href);
    setBarState("expanded");
  }, [lastTab, navigateTo]);

  const handleExpandedTab = useCallback((tab: typeof TAB_CONFIG[number]) => {
    navigateTo(tab.href);
    setTimeout(() => setBarState("default"), 300);
  }, [navigateTo]);

  const handleSearch = useCallback(() => {
    setBarState("search");
    setSearchQuery("");
    navigateTo("/search");
  }, [navigateTo]);

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
    setBarState("default");
    router.back();
  }, [router]);

  const handleLog = useCallback(() => {
    navigateTo("/log");
  }, [navigateTo]);

  const handleBack = useCallback(() => { router.back(); }, [router]);

  const lastTabConfig = TAB_CONFIG.find((t) => t.id === lastTab)!;
  const currentTab = getTabFromPathname(pathname);

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="px-5 pb-0.5">

        {/* Bar + plus button */}
        <div className="flex items-center justify-center gap-2">
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
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => { setSearchQuery(""); handleSearchInput(""); searchInputRef.current?.focus(); }}
                      className="flex items-center justify-center w-6 h-6 rounded-full text-curtn-muted hover:text-curtn-cream shrink-0"
                      aria-label="Clear search"
                    >
                      <Icon name="plus" weight="regular" size={14} className="rotate-45" />
                    </button>
                  )}
                </div>
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

          {/* Plus button — doubles as close button when rotated */}
          <button
            type="button"
            onClick={
              barState === "expanded" ? () => setBarState("default") :
              barState === "search" ? handleCloseSearch :
              handleLog
            }
            className="flex items-center justify-center w-9 h-9 rounded-full bg-curtn-coral text-curtn-deep hover:bg-curtn-red active:scale-95 shadow-lg shadow-black/20 shrink-0"
            style={{
              transition: `transform ${DURATION} ${EASE}`,
              transform: (barState === "expanded" || barState === "search") ? "rotate(45deg)" : "rotate(0deg)",
            }}
            aria-label={
              barState === "expanded" || barState === "search" ? "Close" : "Log a performance"
            }
          >
            <Icon name="plus" weight="bold" size={20} />
          </button>
        </div>

      </div>
    </div>
  );
}
