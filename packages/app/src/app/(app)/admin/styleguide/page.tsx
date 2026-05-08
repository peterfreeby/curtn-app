"use client";

import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { StarRating } from "@/components/StarRating";
import { Icon, type IconName } from "@/components/icons/Icons";
import { Avatar } from "@/components/Avatar";
import { PosterCard } from "@/components/PosterCard";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { BackdropHero } from "@/components/BackdropHero";
import { PosterStrip } from "@/components/PosterStrip";

const ALL_ICONS: IconName[] = [
  "magnifying-glass", "house", "compass", "map-pin", "plus", "user",
  "sign-out", "caret-down", "star", "heart", "ticket", "calendar",
  "globe", "phone", "envelope", "arrow-left", "buildings", "eye", "eye-slash",
];

const ICON_WEIGHTS = ["regular", "bold", "light", "thin", "fill", "duotone"] as const;

const COLORS = [
  { name: "curtn-deep", hex: "#161316", text: "text-curtn-cream", bg: "bg-curtn-deep" },
  { name: "curtn-surface", hex: "#1E1B1E", text: "text-curtn-cream", bg: "bg-curtn-surface" },
  { name: "curtn-dark", hex: "#393E41", text: "text-curtn-cream", bg: "bg-curtn-dark" },
  { name: "curtn-muted", hex: "#B5BBBF", text: "text-curtn-deep", bg: "bg-curtn-muted" },
  { name: "curtn-cream", hex: "#F5F1E3", text: "text-curtn-deep", bg: "bg-curtn-cream" },
  { name: "curtn-coral", hex: "#FE5F55", text: "text-curtn-deep", bg: "bg-curtn-coral" },
  { name: "curtn-red", hex: "#FE4134", text: "text-curtn-deep", bg: "bg-curtn-red" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium uppercase tracking-widest text-curtn-muted">{title}</h2>
      {children}
    </div>
  );
}

function VariableWeightDemo() {
  const [weight, setWeight] = useState(400);
  const [animating, setAnimating] = useState(false);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (!animating) return;
    let start: number | null = null;
    const duration = 2000;

    function animate(ts: number) {
      if (!start) start = ts;
      const elapsed = ts - start;
      const progress = (elapsed % duration) / duration;
      // Ping-pong between 100 and 900
      const t = progress < 0.5 ? progress * 2 : 2 - progress * 2;
      setWeight(Math.round(100 + t * 800));
      frameRef.current = requestAnimationFrame(animate);
    }

    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [animating]);

  return (
    <Card>
      <div className="space-y-6">
        <div className="space-y-3">
          <p
            className="text-2xl text-curtn-cream leading-tight"
            style={{ fontWeight: weight, fontVariationSettings: `'wght' ${weight}` }}
          >
            The stage is yours.
          </p>
          <p
            className="text-lg text-curtn-muted"
            style={{ fontWeight: weight, fontVariationSettings: `'wght' ${weight}` }}
          >
            Inter Variable — weight {weight}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={100}
            max={900}
            step={1}
            value={weight}
            onChange={(e) => { setAnimating(false); setWeight(Number(e.target.value)); }}
            className="flex-1 accent-curtn-coral"
          />
          <button
            onClick={() => setAnimating(!animating)}
            className="px-3 py-1.5 text-xs rounded-lg bg-curtn-surface border border-curtn-dark text-curtn-muted hover:text-curtn-cream hover:border-curtn-muted transition-colors cursor-pointer"
          >
            {animating ? "Stop" : "Animate"}
          </button>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((w) => (
            <span
              key={w}
              className={`text-sm cursor-pointer transition-colors ${w === weight ? "text-curtn-coral" : "text-curtn-muted/50 hover:text-curtn-muted"}`}
              style={{ fontWeight: w }}
              onClick={() => { setAnimating(false); setWeight(w); }}
            >
              {w}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}

export default function StyleGuidePage() {
  const [rating, setRating] = useState(3.5);
  const [inputValue, setInputValue] = useState("");

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto space-y-12">
      <div>
        <h1 className="text-xl font-bold text-curtn-cream">Style Guide</h1>
        <p className="mt-1 text-sm text-curtn-muted">Component library and design tokens.</p>
      </div>

      {/* Colors */}
      <Section title="Colors">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {COLORS.map((c) => (
            <div key={c.name} className="space-y-2">
              <div className={`${c.bg} rounded-lg h-16 border border-curtn-dark/30`} />
              <div>
                <p className="text-xs font-medium text-curtn-cream">{c.name}</p>
                <p className="text-xs text-curtn-muted font-mono">{c.hex}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Typography */}
      <Section title="Typography">
        <Card>
          <div className="space-y-6">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-widest text-curtn-muted/50">Display — Neue Regrade</p>
              <h3 className="text-2xl font-bold text-curtn-cream">Heading XL</h3>
              <h3 className="text-xl font-bold text-curtn-cream">Heading Large</h3>
              <h3 className="text-lg font-semibold text-curtn-cream">Heading Medium</h3>
            </div>
            <div className="border-t border-curtn-dark/30 pt-6 space-y-1">
              <p className="text-xs uppercase tracking-widest text-curtn-muted/50">Body — Inter</p>
              <p className="text-sm font-medium text-curtn-cream">Body — Medium (500)</p>
              <p className="text-sm text-curtn-cream">Body — Regular (400)</p>
              <p className="text-sm font-light text-curtn-muted">Body — Light (300)</p>
              <p className="text-xs text-curtn-muted/60">Caption — Subdued</p>
              <p className="text-xs uppercase tracking-widest text-curtn-muted">Label — Uppercase</p>
            </div>
          </div>
        </Card>
      </Section>

      {/* Variable Font Weight */}
      <Section title="Inter Variable Weight">
        <VariableWeightDemo />
      </Section>

      {/* Buttons */}
      <Section title="Buttons">
        <Card>
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="tertiary">Ghost</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" disabled>Primary Disabled</Button>
              <Button variant="secondary" disabled>Secondary Disabled</Button>
              <Button variant="tertiary" disabled>Ghost Disabled</Button>
            </div>
            <div>
              <Button variant="primary" fullWidth>Full Width</Button>
            </div>
          </div>
        </Card>
      </Section>

      {/* Inputs */}
      <Section title="Inputs">
        <Card>
          <div className="space-y-6 max-w-sm">
            <Input
              label="Default Input"
              placeholder="Type something…"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
            <Input label="Email" type="email" placeholder="you@example.com" />
            <Input label="Password" type="password" placeholder="••••••••" />
            <Input label="With Value" value="Pre-filled content" onChange={() => {}} />
          </div>
        </Card>
      </Section>

      {/* Star Rating */}
      <Section title="Star Rating">
        <Card>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-xs text-curtn-muted w-20">Interactive</span>
              <StarRating value={rating} onChange={setRating} />
              <span className="text-sm text-curtn-muted">{rating}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-curtn-muted w-20">Read-only</span>
              <StarRating value={4} readOnly />
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-curtn-muted w-20">Half star</span>
              <StarRating value={2.5} readOnly />
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-curtn-muted w-20">Small</span>
              <StarRating value={3} readOnly size={16} />
            </div>
          </div>
        </Card>
      </Section>

      {/* Cards */}
      <Section title="Cards">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <h3 className="text-sm font-medium text-curtn-cream">Default Card</h3>
            <p className="mt-1 text-xs text-curtn-muted/60">
              Standard card with surface background and subtle border.
            </p>
          </Card>
          <Card className="transition-colors hover:border-curtn-muted/30 cursor-pointer">
            <h3 className="text-sm font-medium text-curtn-cream">Interactive Card</h3>
            <p className="mt-1 text-xs text-curtn-muted/60">
              Hover to see the border highlight.
            </p>
          </Card>
        </div>
      </Section>

      {/* Icons */}
      <Section title="Icons — All Names">
        <Card>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-4">
            {ALL_ICONS.map((name) => (
              <div key={name} className="flex flex-col items-center gap-2">
                <Icon name={name} size={24} className="text-curtn-cream" />
                <span className="text-[10px] text-curtn-muted text-center leading-tight">{name}</span>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      {/* Icon Weights */}
      <Section title="Icons — Weights">
        <Card>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-6">
            {ICON_WEIGHTS.map((weight) => (
              <div key={weight} className="flex flex-col items-center gap-2">
                <Icon name="star" weight={weight} size={28} className="text-curtn-coral" />
                <span className="text-[10px] text-curtn-muted">{weight}</span>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      {/* Spacing Scale */}
      <Section title="Spacing Scale — 7px Base">
        <Card>
          <div className="space-y-[var(--spacing-1)]">
            {[
              { token: "0.5", px: "3.5px" },
              { token: "1", px: "7px" },
              { token: "1.5", px: "10.5px" },
              { token: "2", px: "14px" },
              { token: "3", px: "21px" },
              { token: "4", px: "28px" },
              { token: "5", px: "35px" },
              { token: "6", px: "42px" },
              { token: "8", px: "56px" },
              { token: "10", px: "70px" },
              { token: "12", px: "84px" },
            ].map((s) => (
              <div key={s.token} className="flex items-center gap-[var(--spacing-1_5)]">
                <div
                  className="h-[var(--spacing-1)] bg-curtn-coral/40 rounded-full shrink-0"
                  style={{ width: `var(--spacing-${s.token.replace(".", "_")})` }}
                />
                <span className="text-xs text-curtn-muted font-mono whitespace-nowrap">--spacing-{s.token}</span>
                <span className="text-[10px] text-curtn-muted/50">{s.px}</span>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      {/* Border Radii */}
      <Section title="Border Radii">
        <Card>
          <div className="flex items-end gap-[var(--spacing-2)]">
            <div className="flex flex-col items-center gap-[var(--spacing-1)]">
              <div className="w-[var(--spacing-5)] h-[var(--spacing-5)] rounded-[var(--spacing-0_5)] bg-curtn-coral/20 border border-curtn-coral/40" />
              <span className="text-[10px] text-curtn-muted">3.5px</span>
            </div>
            <div className="flex flex-col items-center gap-[var(--spacing-1)]">
              <div className="w-[var(--spacing-5)] h-[var(--spacing-5)] rounded-[var(--spacing-1)] bg-curtn-coral/20 border border-curtn-coral/40" />
              <span className="text-[10px] text-curtn-muted">7px</span>
            </div>
            <div className="flex flex-col items-center gap-[var(--spacing-1)]">
              <div className="w-[var(--spacing-5)] h-[var(--spacing-5)] rounded-xl bg-curtn-coral/20 border border-curtn-coral/40" />
              <span className="text-[10px] text-curtn-muted">xl (cards)</span>
            </div>
            <div className="flex flex-col items-center gap-[var(--spacing-1)]">
              <div className="w-[var(--spacing-5)] h-[var(--spacing-5)] rounded-full bg-curtn-coral/20 border border-curtn-coral/40" />
              <span className="text-[10px] text-curtn-muted">full</span>
            </div>
          </div>
        </Card>
      </Section>

      {/* Status Colors */}
      <Section title="Status Patterns">
        <Card>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-curtn-coral/10 text-curtn-coral">Accent / CTA</span>
              <span className="text-xs text-curtn-muted">coral on coral/10</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-curtn-red/10 text-curtn-red">Error / Destructive</span>
              <span className="text-xs text-curtn-muted">red on red/10</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-green-500/10 text-green-400">Success</span>
              <span className="text-xs text-curtn-muted">green-400 on green-500/10</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-curtn-dark text-curtn-muted">Neutral / Default</span>
              <span className="text-xs text-curtn-muted">muted on dark</span>
            </div>
          </div>
        </Card>
      </Section>

      {/* Avatars */}
      <Section title="Avatars">
        <Card>
          <div className="flex items-end gap-4">
            <div className="flex flex-col items-center gap-2">
              <Avatar name="Ada Enechi" size="sm" />
              <span className="text-[10px] text-curtn-muted">sm</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Avatar name="Jordan Lee" size="md" />
              <span className="text-[10px] text-curtn-muted">md</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Avatar name="Sam Torres" size="lg" />
              <span className="text-[10px] text-curtn-muted">lg</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Avatar name="Kim Park" size="xl" />
              <span className="text-[10px] text-curtn-muted">xl</span>
            </div>
          </div>
          <p className="mt-4 text-xs text-curtn-muted/50">Initial fallback shown above. Pass <code className="text-curtn-muted">src</code> for image avatars.</p>
        </Card>
      </Section>

      {/* Poster Cards */}
      <Section title="Poster Cards">
        <div className="flex flex-wrap gap-[var(--spacing-2)]">
          <PosterCard
            title="Sleep No More"
            subtitle="Punchdrunk"
            size="sm"
          />
          <PosterCard
            title="Hadestown"
            subtitle="Walter Kerr Theatre"
            size="md"
          />
          <PosterCard
            title="A Chorus Line"
            subtitle="NYC Center"
            size="lg"
            actions={[
              { icon: "eye", activeIcon: "eye", active: true, label: "Seen" },
              { icon: "heart", activeIcon: "heart", active: true, label: "Liked" },
              { icon: "ticket", label: "Watchlist" },
            ]}
          />
        </div>
        <p className="mt-[var(--spacing-1)] text-xs text-curtn-muted/50">Hover posters for overlay + actions. Default actions: seen, like, watchlist. Sizes: sm (98px), md (147px), lg (196px).</p>
      </Section>

      {/* Poster Strip */}
      <Section title="Poster Strip">
        <PosterStrip title="Just Reviewed">
          {["Sleep No More", "Hadestown", "A Chorus Line", "Hamilton", "Wicked", "The Lehman Trilogy", "Six", "Company"].map((title) => (
            <PosterCard key={title} title={title} size="sm" />
          ))}
        </PosterStrip>
      </Section>

      {/* Backdrop Hero */}
      <Section title="Backdrop Hero">
        <div className="rounded-xl overflow-hidden border border-curtn-dark/30">
          <div className="px-6 pt-8">
            <BackdropHero
              title="Wuthering Heights"
              subtitle="Directed by Robert Icke · St. Ann's Warehouse"
              meta="2h 45m · Drama · English"
            >
              <div className="mt-3 flex items-center gap-3">
                <Button variant="primary" className="!px-4 !py-2 !text-xs">
                  <span className="flex items-center gap-1.5">
                    <Icon name="eye" size={14} /> Log
                  </span>
                </Button>
                <Button variant="secondary" className="!px-4 !py-2 !text-xs">
                  <span className="flex items-center gap-1.5">
                    <Icon name="heart" size={14} /> Like
                  </span>
                </Button>
                <Button variant="tertiary" className="!px-4 !py-2 !text-xs">
                  <span className="flex items-center gap-1.5">
                    <Icon name="ticket" size={14} /> Watchlist
                  </span>
                </Button>
              </div>
            </BackdropHero>
          </div>
          <div className="h-8" />
        </div>
        <p className="mt-2 text-xs text-curtn-muted/50">Shown without images. Add backdropUrl and posterUrl for the full effect.</p>
      </Section>

      {/* Review Cards */}
      <Section title="Review Cards">
        <div className="space-y-3">
          <ReviewCard
            review={{
              id: "sg-1",
              rating: 4.5,
              text: "The McKittrick Hotel swallowed me whole. Three hours of chasing masked dancers through dark corridors and I've never felt more alive in a theater.",
              createdAt: "2026-03-15T00:00:00.000Z",
              user: { id: "sg-u1", username: "adae", fullName: "Ada E.", avatarUrl: null },
            }}
          />
          <ReviewCard
            review={{
              id: "sg-2",
              rating: 3,
              text: "Beautiful staging but the second act drags. Amber Gray is magnetic though.",
              createdAt: "2026-03-10T00:00:00.000Z",
              user: { id: "sg-u2", username: "jordanl", fullName: "Jordan L.", avatarUrl: null },
            }}
          />
        </div>
      </Section>

      {/* Composition Example */}
      <Section title="Composition — Performance Card">
        <Card>
          <div className="flex items-start gap-4">
            <div className="w-[60px] shrink-0">
              <div className="aspect-[2/3] rounded-md bg-curtn-dark/30 border border-curtn-dark/50 flex items-center justify-center">
                <Icon name="ticket" weight="thin" size={20} className="text-curtn-dark" />
              </div>
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <h3 className="text-sm font-medium text-curtn-cream">A Chorus Line</h3>
              <p className="text-xs text-curtn-muted">NYC Center · Mar 15, 2026</p>
              <div className="flex items-center gap-2 mt-2">
                <StarRating value={4.5} readOnly size={14} />
                <span className="text-xs text-curtn-muted">4.5</span>
              </div>
            </div>
            <button
              type="button"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-curtn-dark/30 transition-colors cursor-pointer"
            >
              <Icon name="heart" weight="regular" size={16} className="text-curtn-muted" />
            </button>
          </div>
        </Card>
      </Section>

      {/* Avatar Row */}
      <Section title="Composition — Following">
        <Card>
          <div className="flex flex-wrap gap-2">
            {["Ada", "Jordan", "Sam", "Kim", "Tracy", "Alex", "Morgan", "Riley", "Casey", "Drew"].map((name) => (
              <Avatar key={name} name={name} size="md" />
            ))}
          </div>
        </Card>
      </Section>
    </div>
  );
}
