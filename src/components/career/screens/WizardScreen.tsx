"use client";

/**
 * Road to Worlds — career creation wizard (design doc §6).
 *
 * Five full-screen steps with a progress strip; each step teaches its concept
 * in one line. All state is local until the final "Found [ORG]" press, which
 * creates the save via careerStore.createCareer with the SAME seed the step-4
 * roster preview used, so the created world matches what was shown.
 *
 * DESIGN.md: one decision per step and one filled button (Next, then Found).
 * An option card marks the pick with its hairline (`panel-glow-orange`) and
 * nothing else; "Recommended" is a plain tag beside the preset's name.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useEffectEvent, useMemo, useState } from "react";
import { CAREER_DIFFICULTY, CAREER_ECONOMY } from "@/config/balance";
import { useCopy } from "@/content/copy";
import { useCareerCopy } from "@/content/careerCopy";
import { lineups, orgById, orgs, playerCardById } from "@/data";
import { runwayWeeks, startingBudgetFor, weeklyWage, weeklyWageBill } from "@/engine/career/economy";
import type { CareerColors, CareerDifficulty } from "@/engine/career/types";
import type { StarterOffer } from "@/engine/career/worldSim";
import type { Region, StatKey } from "@/engine/types";
import { wantsQuickStart } from "@/lib/careerEntry";
import { formatMoney } from "@/lib/format";
import { randomSeed } from "@/lib/rng";
import { cx } from "@/lib/util";
import { CAREER_SLOTS } from "@/components/career/careerUi";
import {
  WIZARD_CREST_IDS,
  WIZARD_PATTERN_IDS,
  WIZARD_SYMBOL_IDS,
  composeCrestId,
  CREST_WIZARD_PALETTE,
  CREST_WIZARD_KITS,
  LAYOUT_IDS,
  UserCrest,
} from "@/components/career/UserCrest";
import type { CrestId, LayoutId, PatternId, SymbolId } from "@/components/career/UserCrest";
import { CrestStep } from "@/components/career/wizard/CrestStep";
import { crestContrastOf } from "@/components/career/wizard/crestContrast";
import { REGION_BADGE } from "@/components/regionStyle";
import { Badge, CountryChip } from "@/components/ui/Badge";
import {
  FlameIcon,
  PeakIcon,
  ScaleIcon,
  ShieldIcon,
  TargetIcon,
  TrendUpIcon,
} from "@/components/ui/icons";
import { Button } from "@/components/ui/Button";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { useCareerStore } from "@/store/careerStore";
import { founderPotentialBandFor, foundingWageOf, starterOffersForRegion } from "@/store/careerFlow";
import { useMounted } from "@/store/useMounted";
import { CountrySelect } from "@/components/career/wizard/CountrySelect";
import { FoundingSplash } from "@/components/career/wizard/FoundingSplash";
import { PresetEffects } from "@/components/career/wizard/PresetEffects";
import {
  QUICKSTART_MANAGER_NAMES,
  QUICKSTART_ORG_NAMES,
  countryByCode,
  regionForCountry,
  suggestAbbrev,
} from "@/components/career/wizard/countries";

const TOTAL_STEPS = 5;
const REGION_ORDER: Region[] = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"];
const STAT_KEYS: StatKey[] = ["offense", "defense", "mechanics", "consistency", "experience", "clutch"];
const DIFFICULTIES: CareerDifficulty[] = ["easy", "normal", "hard"];
// rc.35 (front C, Miguel): Balanced sits in the middle, between the long game and the ready-now.
const ROSTER_KEYS = ["prospects", "balanced", "journeymen"] as const;
type RosterKey = (typeof ROSTER_KEYS)[number];
const ROSTER_ICON: Record<RosterKey, typeof ShieldIcon> = {
  prospects: TrendUpIcon,
  balanced: ScaleIcon,
  journeymen: PeakIcon,
};
/** rc.35 (front C): each preset's icon; Normal is the recommended one (CAREER_DIFFICULTY.defaultPreset). */
const PRESET_ICON: Record<CareerDifficulty, typeof ShieldIcon> = {
  easy: ShieldIcon,
  normal: TargetIcon,
  hard: FlameIcon,
};
/** How deep a region's field is, on the three-bar meter of its card (3 = the hard road). */
const REGION_LEVEL: Record<Region, { bars: 1 | 2 | 3; key: "hard" | "mid" | "easy" }> = {
  NA: { bars: 3, key: "hard" },
  EU: { bars: 3, key: "hard" },
  SAM: { bars: 2, key: "mid" },
  MENA: { bars: 2, key: "mid" },
  OCE: { bars: 2, key: "mid" },
  APAC: { bars: 1, key: "easy" },
  SSA: { bars: 1, key: "easy" },
};
/** An option card (region, roster, preset): the pick is the orange hairline, nothing more. */
const optionCard = (active: boolean): string =>
  cx("panel text-left transition-colors", active ? "panel-glow-orange" : "hover:!border-line-strong");

/** null = the "None" tile in the pattern picker / randomizer pool. */
const DEFAULT_CREST_COLORS = CREST_WIZARD_KITS.find((k) => k.id === "navy-gold") ?? CREST_WIZARD_KITS[0];
const PATTERN_OPTIONS = [null, ...WIZARD_PATTERN_IDS] as const;

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Region field-strength copy key (design §6: telegraphed difficulty lever). */
const STRENGTH_KEY: Record<Region, "strengthDeep" | "strengthStrong" | "strengthDeveloping"> = {
  NA: "strengthDeep",
  EU: "strengthDeep",
  SAM: "strengthStrong",
  MENA: "strengthStrong",
  OCE: "strengthStrong",
  APAC: "strengthDeveloping",
  SSA: "strengthDeveloping",
};

/**
 * Notable Season X rivals per region — elite/strong RLCS X lineups first, then
 * the rest of the Season X field for regions without a marquee tier (OCE).
 * Regions with no Season X dataset presence (MENA/APAC/SSA — they join later)
 * show no rivals row: their career worlds open with filler orgs, and listing
 * later-season real orgs would breach the spoiler horizon (design §11).
 */
let rivalsCache: Record<Region, { orgId: string; name: string }[]> | null = null;
function rivalsByRegion(): Record<Region, { orgId: string; name: string }[]> {
  if (rivalsCache) return rivalsCache;
  const map = Object.fromEntries(
    REGION_ORDER.map((r) => [r, [] as { orgId: string; name: string }[]]),
  ) as Record<Region, { orgId: string; name: string }[]>;
  const rating = (l: (typeof lineups)[number]) => l.playerCardIds.reduce((n, id) => n + (playerCardById.get(id)?.overall ?? 0), 0) / l.playerCardIds.length;
  for (const l of lineups.filter((l) => l.seasonId === "rlcs-x").sort((a, b) => rating(b) - rating(a) || a.orgId.localeCompare(b.orgId))) {
    const bucket = map[l.region];
    if (bucket.length < 3 && !bucket.some((b) => b.orgId === l.orgId)) bucket.push({ orgId: l.orgId, name: orgById.get(l.orgId)?.name ?? l.orgId });
  }
  rivalsCache = map;
  return map;
}

export function WizardScreen() {
  const copy = useCopy();
  const C = useCareerCopy();
  const router = useRouter();
  const mounted = useMounted();
  const slots = useCareerStore((s) => s.slots);
  const createCareer = useCareerStore((s) => s.createCareer);

  // The wizard's world seed: kept for the whole session so the step-4 roster
  // preview and the created world are the SAME world (passed as customSeed).
  const [seed] = useState(() => randomSeed());
  const [step, setStep] = useState(1);

  // Step 1 — identity
  const [orgName, setOrgName] = useState("");
  const [abbrev, setAbbrev] = useState("");
  const [abbrevTouched, setAbbrevTouched] = useState(false);
  const [managerName, setManagerName] = useState("");
  const [country, setCountry] = useState("US");
  // Step 2 — crest & colors & identity buff (crest v2: shape + symbol + pattern; rc.36: + layout)
  const [crestShape, setCrestShape] = useState<CrestId>("shield");
  const [crestSymbol, setCrestSymbol] = useState<SymbolId | null>(null);
  const [crestPattern, setCrestPattern] = useState<PatternId | null>(null);
  const [iconColor, setIconColor] = useState<"primary" | "secondary" | "tertiary">("secondary");
  const [crestLayout, setCrestLayout] = useState<LayoutId>("emblem");
  const [colors, setColors] = useState<CareerColors>({
    primary: DEFAULT_CREST_COLORS.primary,
    secondary: DEFAULT_CREST_COLORS.secondary,
    tertiary: "#f5f7fa",
  });
  const [buffType, setBuffType] = useState<StatKey>("offense");
  /** The composite crestId written to identity ("shape[:symbol[:pattern[:layout]]]"). */
  const crestId = composeCrestId({ shape: crestShape, symbol: crestSymbol, pattern: crestPattern, layout: crestLayout, iconColor });
  // Step 3 — region (null = derived from country)
  const [regionPick, setRegionPick] = useState<Region | null>(null);
  // Step 4 — starter roster
  const [rosterKey, setRosterKey] = useState<RosterKey>("balanced");
  // Step 5 — the career preset (rc.32, BAL-02: it replaces the Management Style step)
  const [difficulty, setDifficulty] = useState<CareerDifficulty>(CAREER_DIFFICULTY.defaultPreset);

  const [slotsFull, setSlotsFull] = useState(false);
  const [founding, setFounding] = useState(false);

  // Locale-appropriate country default (design §6: defaults from locale).
  // Deferred a tick — reading navigator is an external-system sync, and the
  // set must not run synchronously inside the effect body (React Compiler rule).
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        const cc = navigator.language?.split("-")[1]?.toUpperCase();
        if (cc && countryByCode(cc)) setCountry(cc);
      } catch {
        /* keep the default */
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  const nameTrim = orgName.trim();
  const nameLenOk = nameTrim.length >= 2 && nameTrim.length <= 18;
  const nameTaken = orgs.some((o) => o.name.toLowerCase() === nameTrim.toLowerCase());
  const abbrevOk = /^[A-Z0-9]{2,4}$/.test(abbrev);
  const managerOk = managerName.trim().length >= 2;
  const step1Ok = nameLenOk && !nameTaken && abbrevOk && managerOk;

  const region: Region = regionPick ?? regionForCountry(country) ?? "EU";
  const offers = useMemo(() => starterOffersForRegion(region, seed), [region, seed]);
  /** Each founder's per-split wage (the founding deal the flow writes — rc.35: foundingWageOf). */
  const salariesOf = useCallback(
    (offer: StarterOffer, full = false) => offer.players.map((p) => foundingWageOf(p, difficulty, seed, full)),
    [difficulty, seed],
  );
  const wageBillOf = useCallback(
    (offer: StarterOffer) => salariesOf(offer).reduce((sum, w) => sum + w, 0),
    [salariesOf],
  );
  /** rc.34 (BAL-05): the start budget scales with the roster's wage bill (startingBudgetFor, the flow's rule). */
  const budgetOf = useCallback(
    (offer: StarterOffer | undefined) =>
      offer
        ? startingBudgetFor(difficulty, weeklyWageBill(salariesOf(offer, true), null))
        : CAREER_ECONOMY.startingBudget[difficulty],
    [difficulty, salariesOf],
  );

  /** Randomize every crest layer + a legibility-checked color pair (step 2 + quick start). */
  const randomizeCrest = () => {
    setCrestShape(pickRandom(WIZARD_CREST_IDS));
    setCrestSymbol(pickRandom(WIZARD_SYMBOL_IDS));
    setCrestPattern(pickRandom(PATTERN_OPTIONS));
    setCrestLayout(pickRandom(LAYOUT_IDS));
    // rc.36 (UX-04): a random pair the contrast guard is happy with (a few re-rolls at most).
    let pair: CareerColors = { primary: DEFAULT_CREST_COLORS.primary, secondary: DEFAULT_CREST_COLORS.secondary };
    for (let i = 0; i < 12; i++) {
      const primaryIdx = Math.floor(Math.random() * CREST_WIZARD_PALETTE.length);
      const secondaryIdx = (primaryIdx + 1 + Math.floor(Math.random() * (CREST_WIZARD_PALETTE.length - 1))) % CREST_WIZARD_PALETTE.length;
      pair = { primary: CREST_WIZARD_PALETTE[primaryIdx].hex, secondary: CREST_WIZARD_PALETTE[secondaryIdx].hex };
      const guard = crestContrastOf(pair);
      if (guard.pairOk && guard.cardOk) break;
    }
    setColors(pair);
  };

  const quickStart = () => {
    const taken = new Set(orgs.map((o) => o.name.toLowerCase()));
    const free = QUICKSTART_ORG_NAMES.filter((n) => !taken.has(n.toLowerCase()));
    const name = pickRandom(free.length ? free : QUICKSTART_ORG_NAMES);
    setOrgName(name);
    setAbbrev(suggestAbbrev(name));
    setAbbrevTouched(false);
    if (managerName.trim().length < 2) setManagerName(pickRandom(QUICKSTART_MANAGER_NAMES));
    randomizeCrest();
    setBuffType(pickRandom(STAT_KEYS));
    setRosterKey("balanced");
    setDifficulty(CAREER_DIFFICULTY.defaultPreset);
    setStep(TOTAL_STEPS);
  };

  // v2.0.33: the search pages link here with ?start=quick (through CareerShell):
  // run the Quick start once, as if its button had been pressed. Deferred a tick
  // like the country default above, so the set calls are not in the effect body.
  const runLinkedQuickStart = useEffectEvent(() => quickStart());
  useEffect(() => {
    if (!wantsQuickStart(window.location.search)) return;
    const t = window.setTimeout(runLinkedQuickStart, 0);
    return () => window.clearTimeout(t);
  }, []);

  const found = () => {
    const slot = slots.findIndex((s) => !s);
    if (slot === -1) {
      setSlotsFull(true);
      return;
    }
    createCareer(
      slot,
      {
        identity: {
          orgName: nameTrim,
          abbrev,
          managerName: managerName.trim(),
          country,
          region,
          crestId,
          colors,
          buffType,
        },
        difficulty,
        rosterKey,
      },
      seed,
    );
    setFounding(true);
  };

  const onFounded = useCallback(() => router.push("/career"), [router]);

  if (!mounted) return <div className="min-h-[60vh]" />;

  const canContinue = step === 1 ? step1Ok : true;
  const rivals = rivalsByRegion();
  const rosterLabel =
    rosterKey === "prospects" ? C.wizard.rosterProspects : rosterKey === "journeymen" ? C.wizard.rosterJourneymen : C.wizard.rosterBalanced;

  // Job: found a new organisation. One decision per step (identity, crest,
  // region, first signings, difficulty); the one filled button moves on.
  return (
    <div className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
      <SectionTitle
        kicker={C.wizard.step(step, TOTAL_STEPS)}
        title={C.wizard.title}
        right={
          step === 1 ? (
            <Button variant="ghost" size="sm" onClick={quickStart} title={C.wizard.quickStartHint}>
              {C.wizard.quickStart}
            </Button>
          ) : undefined
        }
      />

      {/* Progress: five flat segments (a finished one goes back to its step).
          The count reads under the title, as a sentence. */}
      <div className="mt-3 flex items-center gap-1">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            disabled={n >= step}
            onClick={() => n < step && setStep(n)}
            aria-label={C.wizard.step(n, TOTAL_STEPS)}
            aria-current={n === step ? "step" : undefined}
            className="group flex h-9 w-10 items-center disabled:cursor-default"
          >
            <span
              className={cx(
                "h-1 w-full rounded-sm transition-colors",
                n === step && "bg-ink",
                n < step && "bg-white/35 group-hover:bg-white/60",
                n > step && "bg-white/12",
              )}
            />
          </button>
        ))}
      </div>

      <div key={step} className="rise-in mt-5">
        {/* ------------------------------------------------ Step 1 · Identity */}
        {step === 1 ? (
          <>
            <StepHeader title={C.wizard.identityTitle} kicker={C.wizard.identityKicker} />
            {/* One board: the four fields, and beside them (under them on a
                phone) what they make, past a hairline. */}
            <Panel className="grid lg:grid-cols-[1fr_minmax(15rem,18rem)]">
              <div className="grid content-start gap-5 p-5 sm:grid-cols-2">
                <Field
                  label={C.wizard.orgName}
                  hint={`${nameTrim.length}/18`}
                  error={
                    nameTrim.length > 0 && !nameLenOk
                      ? C.wizard.orgNameLength
                      : nameTaken
                        ? C.wizard.orgNameTaken
                        : undefined
                  }
                >
                  <input
                    value={orgName}
                    onChange={(e) => {
                      setOrgName(e.target.value);
                      if (!abbrevTouched) setAbbrev(suggestAbbrev(e.target.value));
                    }}
                    maxLength={18}
                    placeholder={C.wizard.orgNamePlaceholder}
                    aria-label={C.wizard.orgName}
                    className={inputCls}
                  />
                </Field>
                <Field
                  label={C.wizard.abbrev}
                  hint={C.wizard.abbrevHint}
                  error={abbrev.length > 0 && !abbrevOk ? C.wizard.abbrevHint : undefined}
                >
                  <input
                    value={abbrev}
                    onChange={(e) => {
                      const next = e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, "")
                        .slice(0, 4);
                      setAbbrev(next);
                      setAbbrevTouched(next.length > 0);
                      if (next.length === 0) setAbbrev(suggestAbbrev(orgName));
                    }}
                    maxLength={4}
                    aria-label={C.wizard.abbrev}
                    className={cx(inputCls, "display uppercase tracking-[0.06em]")}
                  />
                </Field>
                <Field label={C.wizard.managerName}>
                  <input
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    maxLength={24}
                    placeholder={C.wizard.managerNamePlaceholder}
                    aria-label={C.wizard.managerName}
                    className={inputCls}
                  />
                </Field>
                <Field label={C.wizard.country}>
                  <CountrySelect value={country} onChange={setCountry} label={C.wizard.country} />
                </Field>
              </div>

              {/* Live identity preview: the crest, the name, then the tag and the manager on one quiet line. */}
              <div className="flex flex-col items-center justify-center gap-3 border-t border-line p-5 text-center lg:border-l lg:border-t-0">
                <UserCrest crestId={crestId} colors={colors} abbrev={abbrev || undefined} size="lg" />
                <p className="display min-h-[1.125rem] text-lg font-bold uppercase leading-none text-ink">{nameTrim}</p>
                <div className="flex items-center gap-2">
                  <CountryChip code={country} />
                  <Badge className={REGION_BADGE[region]}>{region}</Badge>
                </div>
                {abbrevOk || managerOk ? (
                  <p className="text-xs text-sub">{[abbrevOk ? abbrev : null, managerOk ? managerName.trim() : null].filter(Boolean).join(" · ")}</p>
                ) : null}
              </div>
            </Panel>
          </>
        ) : null}

        {/* -------------------------------------------- Step 2 · Crest & colors */}
        {/* rc.36 (UX-04, R88): more shapes / symbols / layouts, free colours, the contrast guard. */}
        {step === 2 ? (
          <>
            <StepHeader title={C.wizard.crestTitle} kicker={C.wizard.crestKicker} />
            <CrestStep
              C={C}
              statLabels={copy.STAT_LABELS}
              statKeys={STAT_KEYS}
              orgName={nameTrim}
              abbrev={abbrev}
              pick={{ shape: crestShape, symbol: crestSymbol, pattern: crestPattern, layout: crestLayout, iconColor }}
              onPick={(next) => {
                if (next.shape !== undefined) setCrestShape(next.shape);
                if (next.symbol !== undefined) setCrestSymbol(next.symbol);
                if (next.pattern !== undefined) setCrestPattern(next.pattern);
                if (next.layout !== undefined) setCrestLayout(next.layout);
                if (next.iconColor !== undefined) setIconColor(next.iconColor);
              }}
              colors={colors}
              onColors={setColors}
              buffType={buffType}
              onBuff={setBuffType}
              onRandomize={randomizeCrest}
            />
          </>
        ) : null}

        {/* ------------------------------------------------- Step 3 · Region */}
        {step === 3 ? (
          <>
            <StepHeader title={C.wizard.regionTitle} kicker={C.wizard.regionKicker} />
            <div className="grid gap-4 sm:grid-cols-2" role="radiogroup" aria-label={C.wizard.regionTitle}>
              {REGION_ORDER.map((r) => {
                const active = region === r;
                const regionRivals = rivals[r];
                const level = REGION_LEVEL[r];
                return (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setRegionPick(r)}
                    className={cx(optionCard(active), "p-4")}
                  >
                    {/* The region, and the number that decides the road: its Worlds seats. */}
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <Badge className={REGION_BADGE[r]}>{r}</Badge>
                        <span className="display truncate text-lg font-bold uppercase leading-none text-ink">
                          {copy.SETUP.regionNames[r]}
                        </span>
                      </span>
                      <span className="display shrink-0 text-sm font-semibold uppercase leading-none text-sub">
                        {C.wizard.regionSlots(CAREER_SLOTS.worlds[r])}
                      </span>
                    </div>
                    {/* Field depth: a three-bar meter and its word. */}
                    <div className="mt-3 flex items-center gap-2">
                      <span className="flex gap-0.5" aria-hidden>
                        {[1, 2, 3].map((n) => (
                          <span key={n} className={cx("h-1.5 w-5 rounded-sm", n <= level.bars ? "bg-ink" : "bg-white/12")} />
                        ))}
                      </span>
                      <span className="text-xs text-ink">{C.wizard.regionLevels[level.key]}</span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-sub">
                      {C.wizard.regionStrength}: {C.wizard[STRENGTH_KEY[r]]}
                    </p>
                    {regionRivals.length > 0 ? (
                      <div className="mt-3 border-t border-line pt-2.5">
                        <p className="kicker mb-1.5">{C.wizard.regionRivals}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                          {regionRivals.map((rv) => (
                            <span key={rv.orgId} className="flex items-center gap-1.5 text-xs text-sub">
                              <TeamLogo orgId={rv.orgId} seasonId="rlcs-x" size="sm" />
                              {rv.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-sub">{C.wizard.regionNote}</p>
          </>
        ) : null}

        {/* ------------------------------------------- Step 4 · Starter roster */}
        {step === 4 ? (
          <>
            <StepHeader title={C.wizard.rosterTitle} kicker={C.wizard.rosterKicker} />
            <div className="grid gap-4 lg:grid-cols-3" role="radiogroup" aria-label={C.wizard.rosterTitle}>
              {ROSTER_KEYS.map((key) => {
                const offer = offers.find((o) => o.key === key);
                if (!offer) return null;
                const active = rosterKey === key;
                const RosterIcon = ROSTER_ICON[key];
                const wage = wageBillOf(offer);
                const budget = budgetOf(offer);
                // rc.34 review: the weeks of this roster's wages the start budget covers (no income) —
                // the budget scales with the wage bill (BAL-05), so a wage/budget bar read the same everywhere.
                const runway = runwayWeeks(budget, -weeklyWageBill(salariesOf(offer), null)) ?? 0;
                const avgOvr = Math.round(
                  offer.players.reduce((s, p) => s + p.overall, 0) / offer.players.length,
                );
                const avgAge =
                  Math.round(
                    (offer.players.reduce((s, p) => s + p.age, 0) / offer.players.length) * 10,
                  ) / 10;
                const labels: Record<RosterKey, { label: string; desc: string }> = {
                  prospects: { label: C.wizard.rosterProspects, desc: C.wizard.rosterProspectsDesc },
                  journeymen: { label: C.wizard.rosterJourneymen, desc: C.wizard.rosterJourneymenDesc },
                  balanced: { label: C.wizard.rosterBalanced, desc: C.wizard.rosterBalancedDesc },
                };
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setRosterKey(key)}
                    className={cx(optionCard(active), "flex flex-col p-4")}
                  >
                    {/* The offer's name says what it is (the old "Balanced" tag on
                        the card called Balanced is gone). */}
                    <span className="flex min-w-0 items-center gap-2">
                      <RosterIcon className="h-5 w-5 shrink-0 text-sub" />
                      <span className="display truncate text-lg font-bold uppercase leading-none text-ink">{labels[key].label}</span>
                    </span>
                    <p className="mt-2 text-sm leading-snug text-sub">{labels[key].desc}</p>

                    {/* The three players: a list, one row each. */}
                    <div className="mt-3 border-t border-line">
                      {offer.players.map((p) => {
                        // DEV-04: the band HQ shows once the career exists (never one centred on the truth).
                        const band = founderPotentialBandFor(p, seed);
                        return (
                          <div key={p.id} className="flex items-center gap-3 border-b border-line py-2">
                            <span className="display w-8 shrink-0 text-xl font-bold leading-none text-ink">{Math.round(p.overall)}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-ink">{p.name}</span>
                              <span className="block text-xs text-sub">
                                {C.player.archetype[p.archetype]} · {C.player.age(p.age)}
                              </span>
                            </span>
                            <span className="shrink-0 text-xs text-sub">{C.player.potBand(band.min, band.max)}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* The offer in four figures. rc.34 review: the budget is the one on the
                        difficulty picked (Normal until step 5 changes it). */}
                    <div className="mt-auto grid grid-cols-2 gap-x-4 gap-y-3 pt-4">
                      <Figure value={avgOvr} label={C.wizard.avgOverall} />
                      <Figure value={avgAge} label={C.wizard.avgAge} />
                      <Figure value={C.squad.perWeek(`~${formatMoney(weeklyWage(wage), { compact: true })}`)} label={C.wizard.wageBill} />
                      <Figure value={formatMoney(budget)} label={C.wizard.rosterBudget(C.wizard.presets[difficulty].label)} />
                    </div>
                    <p className="mt-3 text-xs text-sub">{C.wizard.rosterRunway(runway)}</p>
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        {/* ------------------------------------- Step 5 · Difficulty & summary */}
        {step === 5 ? (
          <>
            <StepHeader title={C.wizard.finalTitle} kicker={C.wizard.finalKicker} />
            {/* rc.34 (front I, Miguel 31/10): three clear choices for a first-time
                player on a phone: a promise and three plain bullets each.
                DESIGN.md: the three cards are the same size; the pick is the
                orange hairline and Normal carries a plain "Recommended" tag. */}
            <div className="grid items-stretch gap-4 sm:grid-cols-3" role="radiogroup" aria-label={C.wizard.finalTitle}>
              {DIFFICULTIES.map((id) => {
                const active = difficulty === id;
                const recommended = id === CAREER_DIFFICULTY.defaultPreset;
                const PresetIcon = PRESET_ICON[id];
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setDifficulty(id)}
                    className={cx(optionCard(active), "flex min-h-11 flex-col p-4")}
                  >
                    <span className="flex items-center gap-2">
                      <PresetIcon className="h-5 w-5 shrink-0 text-sub" />
                      <span className="display min-w-0 flex-1 text-lg font-bold uppercase leading-none text-ink">{C.wizard.presets[id].label}</span>
                      {recommended ? <Badge tone="blue">{C.wizard.recommended}</Badge> : null}
                    </span>
                    <p className="mt-3 text-sm leading-snug text-ink">{C.wizard.presets[id].promise}</p>
                    <div className="mt-3 border-t border-line">
                      <PresetEffects difficulty={id} C={C} />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Recap: what the Found button is about to create. Not a board: the
                organisation on the left, the four earlier picks as labelled
                figures on the right (the budget's label names the difficulty). */}
            <section className="mt-8 border-t border-line pt-5" aria-label={C.wizard.summaryTitle}>
              <h3 className="card-title">{C.wizard.summaryTitle}</h3>
              <div className="mt-4 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <UserCrest crestId={crestId} colors={colors} abbrev={abbrev} size="lg" />
                  <div className="min-w-0">
                    <p className="display truncate text-xl font-bold uppercase leading-none text-ink">{nameTrim}</p>
                    <p className="mt-1.5 flex items-center gap-2 text-sm text-sub">
                      <CountryChip code={country} />
                      {managerName.trim()}
                    </p>
                  </div>
                </div>
                <div className="grid shrink-0 grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-[repeat(4,auto)]">
                  <Figure value={copy.SETUP.regionNames[region]} label={C.wizard.regionTitle} />
                  <Figure value={copy.STAT_LABELS[buffType]} label={C.wizard.identityBuff} />
                  <Figure value={rosterLabel} label={C.wizard.rosterTitle} />
                  <Figure
                    value={formatMoney(budgetOf(offers.find((o) => o.key === rosterKey)))}
                    label={C.wizard.rosterBudget(C.wizard.presets[difficulty].label)}
                  />
                </div>
              </div>
              {slotsFull ? (
                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2.5">
                  <p className="text-sm text-bad">{C.saves.slotsFull}</p>
                  <Button variant="secondary" size="sm" onClick={() => router.push("/career/saves")}>
                    {C.nav.saves}
                  </Button>
                </div>
              ) : null}
            </section>
          </>
        ) : null}
      </div>

      {/* Step navigation. Phone: on ground (`.action-dock`); it was a card floating over the form. */}
      <div className="action-dock mt-6 flex items-center justify-between gap-3 sm:mt-8">
        {step > 1 ? (
          <Button variant="ghost" onClick={() => setStep(step - 1)}>
            {C.common.back}
          </Button>
        ) : (
          <span />
        )}
        {step < TOTAL_STEPS ? (
          <Button variant="primary" size="lg" disabled={!canContinue} onClick={() => setStep(step + 1)}>
            {C.common.next}
          </Button>
        ) : (
          <Button variant="primary" size="lg" disabled={!step1Ok || founding} onClick={found}>
            {C.wizard.found(nameTrim)}
          </Button>
        )}
      </div>

      {founding ? (
        <FoundingSplash
          orgName={nameTrim}
          abbrev={abbrev}
          crestId={crestId}
          colors={colors}
          establishedLabel={C.wizard.founded}
          tagline={C.wizard.foundedSplash}
          onDone={onFounded}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local presentational bits
// ---------------------------------------------------------------------------

const inputCls =
  "h-11 w-full rounded-lg border border-line-strong bg-white/5 px-3 text-sm text-ink " +
  "placeholder:text-faint transition-colors focus:border-orange/60 focus:outline-none";

/** The step's name and its one line: the largest thing on the step after the slab. */
function StepHeader({ title, kicker }: { title: string; kicker: string }) {
  return (
    <div className="mb-5">
      <h3 className="display text-2xl uppercase leading-none text-ink">{title}</h3>
      <p className="mt-2 max-w-xl text-sm leading-snug text-sub">{kicker}</p>
    </div>
  );
}

/** A figure with its quiet label under it (spans: it also sits inside the option buttons). */
function Figure({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <span className="block min-w-0">
      <span className="display block whitespace-nowrap text-xl font-bold uppercase leading-none text-ink">{value}</span>
      <span className="mt-1 block text-xs leading-snug text-sub">{label}</span>
    </span>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="kicker mb-1.5">{label}</p>
      {children}
      {error ? <p className="mt-1 text-xs text-bad">{error}</p> : hint ? <p className="mt-1 text-xs text-sub">{hint}</p> : null}
    </div>
  );
}
