"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { DuotoneExtractor } from "@/lib/duotone/DuotoneExtractor";

type RGB = [number, number, number];

let sharedExtractor: DuotoneExtractor | null = null;
function getExtractor() {
  if (!sharedExtractor) sharedExtractor = new DuotoneExtractor();
  return sharedExtractor;
}

export function useDuotone(src: string | null | undefined) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [colors, setColors] = useState<{ colorA: RGB; colorB: RGB } | null>(null);
  const processedRef = useRef<string | null>(null);

  const process = useCallback(async () => {
    if (!src || !canvasRef.current || processedRef.current === src) return;
    processedRef.current = src;
    setIsProcessing(true);
    try {
      const extractor = getExtractor();
      const result = await extractor.process(canvasRef.current, src);
      setColors(result);
    } catch {
      // Silently fail — show full-color image
    } finally {
      setIsProcessing(false);
    }
  }, [src]);

  useEffect(() => {
    if (!src || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          process();
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(canvas);
    return () => observer.disconnect();
  }, [src, process]);

  return { canvasRef, isProcessing, colors };
}
