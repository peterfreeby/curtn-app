"use client";

import { createContext, useContext, useState, useCallback, useMemo } from "react";

interface NowViewing {
  title: string;
  posterUrl?: string | null;
  href: string;
}

interface NowViewingContextValue {
  nowViewing: NowViewing | null;
  setNowViewing: (data: NowViewing | null) => void;
}

const NowViewingContext = createContext<NowViewingContextValue>({
  nowViewing: null,
  setNowViewing: () => {},
});

export function NowViewingProvider({ children }: { children: React.ReactNode }) {
  const [nowViewing, setNowViewingState] = useState<NowViewing | null>(null);

  const setNowViewing = useCallback((data: NowViewing | null) => {
    setNowViewingState(data);
  }, []);

  const value = useMemo(() => ({ nowViewing, setNowViewing }), [nowViewing, setNowViewing]);

  return (
    <NowViewingContext.Provider value={value}>
      {children}
    </NowViewingContext.Provider>
  );
}

export function useNowViewing() {
  return useContext(NowViewingContext);
}
