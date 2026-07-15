"use client";

import { useRef, useEffect, useCallback, useState, useMemo } from "react";

export interface CastHeadshot {
  name: string;
  url: string;
}

/** Map the GraphQL `Show.castHeadshots` shape to the poster's {name, url},
 *  dropping anyone without a headshot image. */
export function toCastHeadshots(
  cast?: { name: string; slug?: string; headshotUrl?: string | null }[] | null,
): CastHeadshot[] {
  return (cast ?? [])
    .filter((c) => !!c.headshotUrl)
    .map((c) => ({ name: c.name, url: c.headshotUrl as string }));
}

const FONT_WEIGHTS = [200, 300, 400, 700, 900];

function seededWeight(word: string, index: number): number {
  let hash = index * 31;
  for (let i = 0; i < word.length; i++) hash = (hash * 37 + word.charCodeAt(i)) | 0;
  return FONT_WEIGHTS[Math.abs(hash) % FONT_WEIGHTS.length];
}

// Deterministic PRNG so a given show always lays out the same way.
function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Poster is portrait (1 : 1.58); splits reason about the tile's *physical*
// aspect (w vs h·ratio) so we can bound how skinny a cell may get.
const POSTER_RATIO = 1.58;

// Max child aspect (long:short). Cuts stay within this so no tile becomes a
// sliver; below it, ratios are free to be uneven for size contrast.
const ASPECT_CAP = 2.4;

function partition(count: number, rand: () => number): Rect[] {
  let tiles: Rect[] = [{ x: 0, y: 0, w: 1, h: 1 }];
  while (tiles.length < count) {
    // Weighted-random pick by area (not always-largest): bigger tiles are
    // likelier to split, but not guaranteed — so some regions stay large while
    // others subdivide, giving real size contrast instead of a uniform grid.
    const areas = tiles.map((t) => t.w * t.h);
    const total = areas.reduce((a, b) => a + b, 0);
    let pick = rand() * total;
    let idx = 0;
    for (let i = 0; i < tiles.length; i++) {
      pick -= areas[i];
      if (pick <= 0) {
        idx = i;
        break;
      }
    }
    const t = tiles[idx];
    const physW = t.w;
    const physH = t.h * POSTER_RATIO;
    // Cut the longer physical side so children trend toward square.
    const cutVertical = physW > physH;
    const L = cutVertical ? physW : physH; // side being cut
    const S = cutVertical ? physH : physW; // the other side
    // Widest ratio window that keeps BOTH children within the aspect cap. For
    // near-square tiles this stays close to 0.5; elongated tiles get to split
    // very unevenly → offset cut lines and a spread of tile sizes.
    const lo = Math.max(S / (L * ASPECT_CAP), 1 - (S * ASPECT_CAP) / L);
    const hi = Math.min((S * ASPECT_CAP) / L, 1 - S / (L * ASPECT_CAP));
    const ratio = lo >= hi ? 0.5 : lo + rand() * (hi - lo);
    let children: Rect[];
    if (cutVertical) {
      const w1 = t.w * ratio;
      children = [
        { x: t.x, y: t.y, w: w1, h: t.h },
        { x: t.x + w1, y: t.y, w: t.w - w1, h: t.h },
      ];
    } else {
      const h1 = t.h * ratio;
      children = [
        { x: t.x, y: t.y, w: t.w, h: h1 },
        { x: t.x, y: t.y + h1, w: t.w, h: t.h - h1 },
      ];
    }
    tiles = [...tiles.slice(0, idx), ...children, ...tiles.slice(idx + 1)];
  }
  return tiles;
}

// Brand accents for Mondrian color blocks — the saturated pop plus the cream
// "white". Grid lines are curtn-deep, matching the poster frame.
const ACCENTS = [
  "var(--color-curtn-coral)",
  "var(--color-curtn-acid)",
  "var(--color-curtn-ice)",
  "var(--color-curtn-hot-pink)",
  "var(--color-curtn-red)",
];

const MAX_HEADSHOTS = 5;
// Negative = tiles overlap by a hair so no sub-pixel seams show through — the
// grid reads as one solid poster with no gaps between tiles.
const GRID_GAP = -0.5;
// Readable floor for the fitted title (px). Small tiles get bumped up to this
// even if the text then overflows and clips slightly.
const MIN_FONT_PX = 15;

type TileKind = "title" | "headshot" | "block";
interface Tile extends Rect {
  kind: TileKind;
  headshot?: CastHeadshot;
  color?: string;
}

const TITLE_LINE_HEIGHT = 0.92;

// Group words into `k` lines, balanced by character count so lines come out
// roughly equal width (keeps each line filling the tile evenly).
function packLines(words: string[], k: number): string[] {
  if (k >= words.length) return words.slice();
  const totalChars = words.reduce((s, w) => s + w.length, 0);
  const target = totalChars / k;
  const lines: string[] = [];
  let cur: string[] = [];
  let curLen = 0;
  let linesLeft = k;
  for (let i = 0; i < words.length; i++) {
    cur.push(words[i]);
    curLen += words[i].length + (cur.length > 1 ? 1 : 0);
    const wordsRemaining = words.length - 1 - i;
    // Close the line once it's hit the target width, but only if enough words
    // remain to fill the lines still owed.
    if (linesLeft > 1 && curLen >= target && wordsRemaining >= linesLeft - 1) {
      lines.push(cur.join(" "));
      cur = [];
      curLen = 0;
      linesLeft--;
    }
  }
  if (cur.length) lines.push(cur.join(" "));
  return lines;
}

/**
 * Title in the seeded-weight display face. Instead of one word per line, it
 * tries every line grouping and renders the one that lets the text grow
 * largest for the tile's actual shape — so a wide-short tile packs words onto
 * fewer, longer lines (filling the width) rather than a skinny centered column.
 */
function FittedTitle({ title }: { title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const words = useMemo(() => title.split(/\s+/).filter(Boolean), [title]);
  const [layout, setLayout] = useState<{ lines: string[]; font: number }>({
    lines: [title],
    font: MIN_FONT_PX,
  });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    // Breathing room scales with the tile — ~14% of its shorter side, floored.
    const pad = Math.max(8, Math.min(cw, ch) * 0.14);
    const availW = cw - pad * 2;
    const availH = ch - pad * 2;
    if (availW <= 0 || availH <= 0) return;

    // Measure in the real DOM (in the same display font) rather than canvas, so
    // the chosen size matches what actually renders — no clipping from metric
    // mismatch. A hidden probe holds each candidate grouping at 100px.
    const probe = document.createElement("div");
    probe.className = "font-display";
    probe.style.cssText =
      "position:absolute;left:-99999px;top:0;visibility:hidden;pointer-events:none";
    el.appendChild(probe);

    const lineHtml = (line: string, startIdx: number): string => {
      let idx = startIdx;
      const inner = line
        .split("")
        .map((ch) => {
          if (ch === " ") return '<span style="font-weight:400">&nbsp;</span>';
          const w = seededWeight(ch, idx++);
          return `<span style="font-weight:${w}">${ch}</span>`;
        })
        .join("");
      return `<span data-probe-line style="display:block;white-space:nowrap;font-size:100px;line-height:${TITLE_LINE_HEIGHT};text-transform:uppercase">${inner}</span>`;
    };

    // Try every line grouping; keep the one whose text grows largest in the tile.
    let best = { font: -1, widthFont: -1, lines: [title] };
    for (let k = 1; k <= words.length; k++) {
      const lines = packLines(words, k);
      let charIdx = 0;
      probe.innerHTML = lines
        .map((line) => {
          const html = lineHtml(line, charIdx);
          charIdx += line.replace(/\s/g, "").length;
          return html;
        })
        .join("");
      const lineEls = probe.querySelectorAll<HTMLElement>("[data-probe-line]");
      let widest = 0;
      let totalH = 0;
      lineEls.forEach((le) => {
        widest = Math.max(widest, le.scrollWidth);
        totalH += le.offsetHeight;
      });
      const widthFont = widest > 0 ? (availW * 100) / widest : availH;
      const heightFont = totalH > 0 ? (availH * 100) / totalH : availH;
      const font = Math.min(widthFont, heightFont);
      if (font > best.font) best = { font, widthFont, lines };
    }
    el.removeChild(probe);

    // Honor the readable floor, but never past what fits the tile's width, so a
    // long single word stays complete instead of clipping.
    const font = Math.min(Math.max(best.font, MIN_FONT_PX), best.widthFont);
    setLayout({ lines: best.lines, font });
  }, [words, title]);

  useEffect(() => {
    measure();
    const obs = new ResizeObserver(measure);
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [measure]);

  let charIndex = 0;
  return (
    <div
      ref={ref}
      className="flex h-full w-full flex-col items-center justify-center overflow-hidden font-display"
    >
      {layout.lines.map((line, i) => {
        const chars = line.split("").map((ch) => {
          if (ch === " ") return { ch, weight: 400 };
          const weight = seededWeight(ch, charIndex);
          charIndex++;
          return { ch, weight };
        });
        return (
          <span
            key={i}
            className="block whitespace-nowrap uppercase leading-[0.92] text-curtn-cream"
            style={{ fontSize: `${layout.font}px` }}
          >
            {chars.map((c, j) => (
              <span key={j} style={{ fontWeight: c.weight }}>
                {c.ch}
              </span>
            ))}
          </span>
        );
      })}
    </div>
  );
}

export function MondrianPoster({
  title,
  cast,
  seed,
}: {
  title: string;
  cast: CastHeadshot[];
  seed?: string;
}) {
  const [failed, setFailed] = useState<Set<number>>(new Set());

  const tiles = useMemo(() => {
    const rand = mulberry32(hashSeed(seed || title));
    const headshots = cast.filter((c) => c.url).slice(0, MAX_HEADSHOTS);
    const nBlocks = headshots.length >= 3 ? 2 : 1;
    const count = Math.max(4, headshots.length + 1 + nBlocks);
    const rects = partition(count, rand);

    // Physical aspect of each tile (accounts for the portrait poster ratio);
    // squareness = how far from 1:1 it is, on a log scale.
    const withMeta = rects.map((r, i) => {
      const physAspect = r.w / (r.h * POSTER_RATIO);
      return { r, i, area: r.w * r.h, squareness: Math.abs(Math.log(physAspect)) };
    });

    // Title → the largest tile (keeps the wordmark big). Headshots → the
    // squarest of the rest, so cover-cropping barely touches them and the
    // faces keep their original proportions. Blocks → the leftover odd shapes.
    const byArea = [...withMeta].sort((a, b) => b.area - a.area);
    const titleTile = byArea[0];
    const rest = byArea.slice(1).sort((a, b) => a.squareness - b.squareness);
    const headshotTiles = rest.slice(0, headshots.length);
    const blockTiles = rest.slice(headshots.length);

    // Seeded starting hue, then step around the palette so two blocks in the
    // same poster never land on the same (or an adjacent, similar) accent.
    const baseHue = hashSeed((seed || title) + "block") % ACCENTS.length;
    const assigned: Tile[] = [{ ...titleTile.r, kind: "title" }];
    headshotTiles.forEach((t, k) =>
      assigned.push({ ...t.r, kind: "headshot", headshot: headshots[k] }),
    );
    blockTiles.forEach((t, k) =>
      assigned.push({
        ...t.r,
        kind: "block",
        color: ACCENTS[(baseHue + k * 2) % ACCENTS.length],
      }),
    );
    return assigned;
  }, [cast, title, seed]);

  return (
    <div className="relative h-full w-full bg-curtn-deep">
      {tiles.map((tile, i) => {
        const style: React.CSSProperties = {
          left: `calc(${tile.x * 100}% + ${GRID_GAP}px)`,
          top: `calc(${tile.y * 100}% + ${GRID_GAP}px)`,
          width: `calc(${tile.w * 100}% - ${GRID_GAP * 2}px)`,
          height: `calc(${tile.h * 100}% - ${GRID_GAP * 2}px)`,
        };

        // A failed headshot degrades to an accent block rather than a broken img.
        const isBrokenShot = tile.kind === "headshot" && failed.has(i);

        if (tile.kind === "block" || isBrokenShot) {
          const color =
            tile.color ??
            ACCENTS[hashSeed((seed || title) + "f" + i) % ACCENTS.length];
          return (
            <div
              key={i}
              className="absolute"
              style={{ ...style, backgroundColor: color }}
            />
          );
        }

        if (tile.kind === "headshot" && tile.headshot) {
          return (
            <div
              key={i}
              className="absolute overflow-hidden bg-curtn-surface"
              style={style}
            >
              <img
                src={tile.headshot.url}
                alt={tile.headshot.name}
                className="h-full w-full object-cover"
                loading="lazy"
                // Decorative tile — excluded from carousel orientation measurement.
                data-mondrian-tile
                onError={() =>
                  setFailed((prev) => {
                    const next = new Set(prev);
                    next.add(i);
                    return next;
                  })
                }
              />
            </div>
          );
        }

        // Title tile
        return (
          <div
            key={i}
            className="absolute bg-curtn-surface"
            style={style}
          >
            <FittedTitle title={title} />
          </div>
        );
      })}
    </div>
  );
}
