"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons/Icons";
import { useAuth } from "@/lib/auth/useAuth";
import { useNowViewing } from "@/lib/NowViewingContext";
import { useMutation } from "urql";
import { WATCHLIST_ADD_MUTATION, WATCHLIST_REMOVE_MUTATION } from "@/lib/graphql/watchlist";

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
  const { nowViewing } = useNowViewing();
  const { user } = useAuth();

  const [barState, setBarState] = useState<BarState>("default");
  const [lastTab, setLastTab] = useState<TabId>("browse");
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showListPicker, setShowListPicker] = useState(false);
  const [, executeWatchlistAdd] = useMutation(WATCHLIST_ADD_MUTATION);
  const [, executeWatchlistRemove] = useMutation(WATCHLIST_REMOVE_MUTATION);
  const [isOnWatchlist, setIsOnWatchlist] = useState(false);

  useEffect(() => {
    const tab = getTabFromPathname(pathname);
    if (tab) setLastTab(tab);
  }, [pathname]);

  useEffect(() => {
    // Close search when navigating away from /search
    if (!pathname.startsWith("/search")) {
      setBarState((prev) => prev === "search" ? (isDetailRoute(pathname) ? "detail" : "default") : prev);
      setSearchQuery("");
    }
    // Auto-set detail on detail routes, but don't override expanded
    if (isDetailRoute(pathname)) {
      setBarState((prev) => prev === "expanded" ? prev : "detail");
    } else if (!pathname.startsWith("/search")) {
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
    if (!user) {
      navigateTo("/login");
      return;
    }
    navigateTo("/log");
  }, [user, navigateTo]);

  // Sync watchlist state from context
  useEffect(() => {
    setIsOnWatchlist(nowViewing?.isOnWatchlist ?? false);
  }, [nowViewing?.isOnWatchlist]);

  const handleBack = useCallback(() => { router.back(); }, [router]);

  const handleWatchlistToggle = useCallback(async () => {
    if (!user) {
      navigateTo("/login");
      return;
    }
    if (!nowViewing?.showId) {
      return;
    }
    const wasOn = isOnWatchlist;
    setIsOnWatchlist(!wasOn);

    const execute = wasOn ? executeWatchlistRemove : executeWatchlistAdd;
    const result = await execute({ input: { showId: nowViewing.showId } });
    const payload = wasOn ? result.data?.watchlistRemove : result.data?.watchlistAdd;

    if (result.error || payload?.error) {
      setIsOnWatchlist(wasOn);
      setToast(result.error?.message || payload?.error || "Something went wrong");
      setTimeout(() => setToast(null), 3000);
    } else {
      setToast(wasOn ? "Removed from watchlist" : "Added to watchlist");
      setTimeout(() => setToast(null), 3000);
    }
  }, [nowViewing?.showId, isOnWatchlist, executeWatchlistAdd, executeWatchlistRemove]);

  const lastTabConfig = TAB_CONFIG.find((t) => t.id === lastTab)!;
  const currentTab = getTabFromPathname(pathname);

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)]">

      {/* Toast */}
      <div
        className="flex justify-center px-5 pb-2"
        style={{
          transition: `all ${DURATION} ${EASE}`,
          opacity: toast ? 1 : 0,
          transform: toast ? "translateY(0)" : "translateY(8px)",
          pointerEvents: toast ? "auto" : "none",
        }}
      >
        <div className="nav-bar inline-flex items-center gap-3 px-3 py-1.5 text-xs">
          <span className="text-curtn-cream">{toast}</span>
          <button
            type="button"
            onClick={() => { setToast(null); setShowListPicker(true); }}
            className="text-curtn-coral hover:text-curtn-red transition-colors"
          >
            Change list
          </button>
        </div>
      </div>

      {/* List picker */}
      {showListPicker && (
        <div className="px-5 pb-2">
          <div className="nav-bar p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-curtn-muted uppercase tracking-wider">Save to list</span>
              <button
                type="button"
                onClick={() => setShowListPicker(false)}
                className="text-curtn-muted hover:text-curtn-cream"
              >
                <Icon name="plus" weight="regular" size={14} className="rotate-45" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => { setShowListPicker(false); setToast("Added to watchlist"); setTimeout(() => setToast(null), 3000); }}
              className="w-full text-left px-2 py-1.5 text-sm text-curtn-cream hover:bg-curtn-cream/5 rounded-sm transition-colors"
            >
              Watchlist
            </button>
            <button
              type="button"
              onClick={() => { setShowListPicker(false); }}
              className="w-full text-left px-2 py-1.5 text-sm text-curtn-muted hover:bg-curtn-cream/5 rounded-sm transition-colors"
            >
              + Create new list
            </button>
          </div>
        </div>
      )}

      <div className="px-5 pb-0.5">

        {/* Bar + plus button */}
        <div className="flex items-center justify-center gap-2">
          {/* Nav bar */}
          <div
            className="nav-bar inline-flex"
            style={{ transition: `all ${DURATION} ${EASE}` }}
          >
            <div className="relative p-0.5 flex items-center justify-center" style={{ minHeight: 34 }}>

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
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(""); handleSearchInput(""); searchInputRef.current?.focus(); }}
                    className="flex items-center justify-center w-6 h-6 rounded-full text-curtn-muted hover:text-curtn-cream shrink-0 transition-opacity"
                    style={{ opacity: searchQuery ? 1 : 0, pointerEvents: searchQuery ? "auto" : "none" }}
                    aria-label="Clear search"
                  >
                    <Icon name="plus" weight="regular" size={14} className="rotate-45" />
                  </button>
                </div>
              </StateLayer>

              {/* DETAIL */}
              <StateLayer active={barState === "detail"}>
                <button type="button" onClick={handleTabTap} className={iconBtnMuted} aria-label={lastTabConfig.label}>
                  <Icon name={lastTabConfig.icon} weight="regular" size={20} />
                </button>
                <button type="button" onClick={handleSearch} className={iconBtnMuted} aria-label="Search">
                  <Icon name="magnifying-glass" size={20} />
                </button>
              </StateLayer>

            </div>
          </div>

          {/* Action button — morphs between + (log), × (close), and show info pill */}
          {barState === "detail" && nowViewing ? (
            <div
              className="nav-bar flex items-center gap-2 h-9 pl-1 pr-0.5 shrink-0"
              style={{ transition: `all ${DURATION} ${EASE}` }}
            >
              {/* Poster + info */}
              {nowViewing.posterUrl && (
                <img
                  src={nowViewing.posterUrl}
                  alt=""
                  className="w-7 h-7 rounded-full object-cover shrink-0"
                />
              )}
              <div className="flex flex-col justify-center truncate max-w-[120px]">
                <span className="text-xs font-bold text-curtn-cream leading-none truncate">{nowViewing.title}</span>
                {nowViewing.subtitle && (
                  <span className="flex items-baseline gap-1 mt-0.5">
                    {nowViewing.parentHref && (
                      <a
                        href={nowViewing.parentHref}
                        onClick={(e) => { e.stopPropagation(); }}
                        className="text-curtn-muted hover:text-curtn-coral transition-colors shrink-0 leading-none"
                        aria-label="Go to parent"
                      >
                        <Icon name="caret-down" size={8} className="rotate-90 inline-block" style={{ position: "relative", top: "1px" }} />
                      </a>
                    )}
                    {nowViewing.parentHref ? (
                      <a
                        href={nowViewing.parentHref}
                        onClick={(e) => { e.stopPropagation(); }}
                        className="text-[9px] text-curtn-muted hover:text-curtn-coral leading-none truncate transition-colors"
                      >
                        {nowViewing.subtitle}
                      </a>
                    ) : (
                      <span className="text-[9px] text-curtn-muted leading-none truncate">{nowViewing.subtitle}</span>
                    )}
                  </span>
                )}
              </div>
              {/* Add to list + Log on the right */}
              <button
                type="button"
                onClick={handleWatchlistToggle}
                className={`flex items-center justify-center w-8 h-8 transition-colors shrink-0 ${isOnWatchlist ? "text-curtn-coral" : "text-curtn-muted hover:text-curtn-cream"}`}
                aria-label={isOnWatchlist ? "Remove from watchlist" : "Add to watchlist"}
              >
                <Icon name={isOnWatchlist ? "folder-simple" : "folder-simple-plus"} weight={isOnWatchlist ? "fill" : "regular"} size={20} />
              </button>
              <button
                type="button"
                onClick={handleLog}
                className="flex items-center justify-center w-8 h-8 text-curtn-coral hover:text-curtn-red transition-colors shrink-0"
                aria-label={`Log ${nowViewing.title}`}
              >
                <Icon name="plus" weight="bold" size={20} />
              </button>
            </div>
          ) : (
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
          )}
        </div>

      </div>
    </div>
  );
}
