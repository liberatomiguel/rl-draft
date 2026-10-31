"use client";

/**
 * Road to Worlds — career creation wizard (design doc §6).
 *
 * Five full-screen steps with progress dots; each step teaches its concept in
 * one kicker line. All state is local until the final "Found [ORG]" press,
 * which creates the save via careerStore.createCareer with the SAME seed the
 * step-4 roster preview used — so the created world matches what was shown.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CAREER_DIFFICULTY, CAREER_ECONOMY } from "@/config/balance";
import { useCopy } from "@/content/copy";
import { useCareerCopy } from "@/content/careerCopy";
import { lineups, orgById, orgs, playerCardById } from "@/data";
import { runwayWeeks, startingBudgetFor, weeklyWage, weeklyWageBill } from "@/engine/career/economy";
import type { CareerColors, CareerDifficulty } from "@/engine/career/types";
import type { StarterOffer } from "@/engine/career/worldSim";
import type { Region, StatKey } from "@/engine/types";
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
import { NewTag } from "@/components/ui/NewDot";
import { REGION_BADGE } from "@/components/regionStyle";
import { Badge, CountryChip } from "@/components/ui/Badge";
import {
  CheckIcon,
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
const PRESET_TONE: Record<CareerDifficulty, string> = {
  easy: "bg-good/15 text-good",
  normal: "bg-amber-400/15 text-amber-300",
  hard: "bg-bad/15 text-bad",
};

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
  const [crestLayout, setCrestLayout] = useState<LayoutId>("emblem");
  const [colors, setColors] = useState<CareerColors>({
    primary: DEFAULT_CREST_COLORS.primary,
    secondary: DEFAULT_CREST_COLORS.secondary,
  });
  const [buffType, setBuffType] = useState<StatKey>("offense");
  /** The composite crestId written to identity ("shape[:symbol[:pattern[:layout]]]"). */
  const crestId = composeCrestId({ shape: crestShape, symbol: crestSymbol, pattern: crestPattern, layout: crestLayout });
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

  return (
    <div className="mx-auto max-w-5xl px-3 py-6 sm:px-4">
      <SectionTitle
        kicker={C.meta.title}
        title={C.wizard.title}
        right={
          step === 1 ? (
            <Button variant="ghost" size="sm" onClick={quickStart} title={C.wizard.quickStartHint}>
              {C.wizard.quickStart}
            </Button>
          ) : undefined
        }
      />

      {/* Progress dots */}
      <div className="mt-4 flex items-center gap-3">
        <div className="flex items-center">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              disabled={n >= step}
              onClick={() => n < step && setStep(n)}
              aria-label={C.wizard.step(n, TOTAL_STEPS)}
              aria-current={n === step ? "step" : undefined}
              className="flex h-9 w-7 items-center justify-center disabled:cursor-default"
            >
              <span
                className={cx(
                  "h-2.5 rounded-full transition-all",
                  n === step ? "w-6 bg-orange" : "w-2.5",
                  n < step && "bg-orange/50",
                  n > step && "bg-white/15",
                )}
              />
            </button>
          ))}
        </div>
        <span className="kicker">{C.wizard.step(step, TOTAL_STEPS)}</span>
      </div>

      <div key={step} className="rise-in mt-6">
        {/* ------------------------------------------------ Step 1 · Identity */}
        {step === 1 ? (
          <>
            <StepHeader title={C.wizard.identityTitle} kicker={C.wizard.identityKicker} />
            <div className="grid gap-4 lg:grid-cols-[1fr_minmax(15rem,18rem)]">
              <Panel className="grid gap-5 p-5 sm:grid-cols-2">
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
                    className={cx(inputCls, "font-mono uppercase tracking-[0.2em]")}
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
              </Panel>

              {/* Live identity preview */}
              <Panel className="flex flex-col items-center justify-center gap-3 p-5 text-center">
                <UserCrest crestId={crestId} colors={colors} abbrev={abbrev || undefined} size="lg" />
                <p className="display text-lg font-bold uppercase tracking-wide text-ink">
                  {nameTrim || "—"}
                </p>
                <div className="flex items-center gap-2">
                  {abbrevOk ? <Badge tone="blue">{abbrev}</Badge> : null}
                  <CountryChip code={country} />
                  <Badge className={REGION_BADGE[region]}>{region}</Badge>
                </div>
                {managerOk ? <p className="text-xs text-sub">{managerName.trim()}</p> : null}
              </Panel>
            </div>
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
              pick={{ shape: crestShape, symbol: crestSymbol, pattern: crestPattern, layout: crestLayout }}
              onPick={(next) => {
                if (next.shape !== undefined) setCrestShape(next.shape);
                if (next.symbol !== undefined) setCrestSymbol(next.symbol);
                if (next.pattern !== undefined) setCrestPattern(next.pattern);
                if (next.layout !== undefined) setCrestLayout(next.layout);
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
            <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={C.wizard.regionTitle}>
              {REGION_ORDER.map((r) => {
                const active = region === r;
                const regionRivals = rivals[r];
                return (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setRegionPick(r)}
                    className={cx(
                      "panel p-4 text-left transition-all",
                      active && "panel-glow-orange !border-orange/60",
                      !active && "hover:!border-line-strong",
                    )}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <Badge className={REGION_BADGE[r]}>{r}</Badge>
                        <span className="display text-base font-bold uppercase tracking-wide text-ink">
                          {copy.SETUP.regionNames[r]}
                        </span>
                      </span>
                      {active ? <Badge tone="orange">{copy.SETUP.selected}</Badge> : null}
                    </div>
                    <p className="mb-2 text-xs leading-relaxed text-sub">
                      {C.wizard.regionStrength} · {C.wizard[STRENGTH_KEY[r]]}
                    </p>
                    <Badge tone="blue">{C.wizard.regionSlots(CAREER_SLOTS.worlds[r])}</Badge>
                    {regionRivals.length > 0 ? (
                      <div className="mt-3 border-t border-line pt-2.5">
                        <p className="kicker mb-1.5 !text-[10px]">{C.wizard.regionRivals}</p>
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
            <p className="mt-3 text-xs text-faint">{C.wizard.regionNote}</p>
          </>
        ) : null}

        {/* ------------------------------------------- Step 4 · Starter roster */}
        {step === 4 ? (
          <>
            <StepHeader title={C.wizard.rosterTitle} kicker={C.wizard.rosterKicker} />
            <div className="grid gap-3 lg:grid-cols-3" role="radiogroup" aria-label={C.wizard.rosterTitle}>
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
                    className={cx(
                      "panel flex flex-col p-4 text-left transition-all",
                      active && "panel-glow-orange !border-orange/60",
                      !active && "hover:!border-line-strong",
                    )}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={cx(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                            active ? "bg-orange/20 text-orange-bright" : "bg-white/5 text-sub",
                          )}
                        >
                          <RosterIcon className="h-5 w-5" />
                        </span>
                        <span className="display truncate text-base font-bold uppercase tracking-wide text-ink">
                          {labels[key].label}
                        </span>
                      </span>
                      {/* rc.35 (front C, Miguel): the middle offer is tagged "Balanced". */}
                      {key === "balanced" ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-400/50 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-300">
                          <ScaleIcon className="h-3 w-3" />
                          {C.wizard.rosterBalancedTag}
                        </span>
                      ) : null}
                    </div>
                    <p className="mb-3 text-xs leading-relaxed text-sub">{labels[key].desc}</p>

                    <div className="mb-3 space-y-2">
                      {offer.players.map((p) => {
                        // DEV-04: the band HQ shows once the career exists (never one centred on the truth).
                        const band = founderPotentialBandFor(p, seed);
                        return (
                          <div
                            key={p.id}
                            className="flex items-center gap-2.5 rounded-lg border border-line bg-black/20 px-2.5 py-2"
                          >
                            <span className="display w-8 shrink-0 text-center text-lg font-bold text-ink">
                              {Math.round(p.overall)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-ink">{p.name}</span>
                              <span className="block text-[11px] text-faint">
                                {C.player.archetype[p.archetype]} · {C.player.age(p.age)}
                              </span>
                            </span>
                            <Badge tone="blue" className="shrink-0">
                              {C.player.potBand(band.min, band.max)}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-auto space-y-2 border-t border-line pt-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-sub">{C.wizard.avgOverall}</span>
                        <span className="display font-bold text-ink">{avgOvr}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-sub">{C.wizard.avgAge}</span>
                        <span className="display font-bold text-ink">{avgAge}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-sub">{C.wizard.wageBill}</span>
                        <span className="display font-bold text-orange-bright">
                          {C.squad.perWeek(`~${formatMoney(weeklyWage(wage), { compact: true })}`)}
                        </span>
                      </div>
                      {/* rc.34 review: the budget on the difficulty picked (Normal until step 5 changes it). */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-sub">{C.wizard.rosterBudget(C.wizard.presets[difficulty].label)}</span>
                        <span className="display font-bold text-good">{formatMoney(budget)}</span>
                      </div>
                      <p className="text-[11px] text-faint">{C.wizard.rosterRunway(runway)}</p>
                    </div>
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
                player on a phone — a promise and three plain bullets each, the
                selected card unmistakable (orange frame, tint and check). */}
            {/* rc.35 (front C, Miguel on rc.34): an icon per preset, the promise as
                the headline, and Normal marked RECOMMENDED — an amber stroke, a
                tag over its top edge and a taller card, so it draws the eye
                before any pick (the pick itself stays the orange frame + check). */}
            <div className="grid items-stretch gap-3 pt-3 sm:grid-cols-3" role="radiogroup" aria-label={C.wizard.finalTitle}>
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
                    className={cx(
                      "panel relative flex min-h-11 flex-col p-4 text-left transition-all",
                      // rc.36 (UX-04): the recommended card keeps its emphasis in the NEW tag's green.
                      recommended && "!border-2 !border-good/60 shadow-[0_0_28px_-10px_rgba(74,222,128,0.45)] sm:-my-2 sm:py-6",
                      active && "panel-glow-orange !border-orange !bg-orange/10",
                      !active && !recommended && "hover:!border-line-strong",
                    )}
                  >
                    {recommended ? (
                      // rc.36 (UX-04, Miguel): "Recommended" is the special cards' NEW pill, the word from copy.
                      <NewTag className="absolute -top-2 left-4 !px-2 !py-0.5 !text-[10px]">{C.wizard.recommended}</NewTag>
                    ) : null}
                    <div className="flex items-center gap-3">
                      <span
                        className={cx(
                          "flex shrink-0 items-center justify-center rounded-xl",
                          recommended ? "h-12 w-12" : "h-10 w-10",
                          PRESET_TONE[id],
                        )}
                      >
                        <PresetIcon className={recommended ? "h-7 w-7" : "h-6 w-6"} />
                      </span>
                      <span
                        className={cx(
                          "display min-w-0 flex-1 font-bold uppercase tracking-wide",
                          recommended ? "text-xl" : "text-lg",
                          active ? "text-orange-bright" : "text-ink",
                        )}
                      >
                        {C.wizard.presets[id].label}
                      </span>
                      <span
                        aria-hidden
                        className={cx(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                          active ? "border-orange bg-orange text-white" : "border-line-strong",
                        )}
                      >
                        {active ? <CheckIcon className="h-4 w-4" /> : null}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-semibold leading-snug text-ink">{C.wizard.presets[id].promise}</p>
                    <div className="mt-3 border-t border-line pt-1">
                      <PresetEffects difficulty={id} C={C} />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Recap */}
            <Panel strong className="mt-6 p-5">
              <p className="kicker mb-4">{C.wizard.summaryTitle}</p>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-4">
                  <UserCrest crestId={crestId} colors={colors} abbrev={abbrev} size="lg" />
                  <div>
                    <p className="display text-xl font-bold uppercase tracking-wide text-ink">{nameTrim}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-sm text-sub">
                      <CountryChip code={country} />
                      {managerName.trim()}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                  <Badge className={REGION_BADGE[region]}>{region}</Badge>
                  <Badge tone="orange">{copy.STAT_LABELS[buffType]}</Badge>
                  <Badge tone="neutral">
                    {rosterKey === "prospects"
                      ? C.wizard.rosterProspects
                      : rosterKey === "journeymen"
                        ? C.wizard.rosterJourneymen
                        : C.wizard.rosterBalanced}
                  </Badge>
                  <Badge tone="neutral">{C.wizard.presets[difficulty].label}</Badge>
                  <Badge tone="blue">{formatMoney(budgetOf(offers.find((o) => o.key === rosterKey)))}</Badge>
                </div>
              </div>
              {slotsFull ? (
                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2.5">
                  <p className="text-sm font-semibold text-bad">{C.saves.slotsFull}</p>
                  <Button variant="secondary" size="sm" onClick={() => router.push("/career/saves")}>
                    {C.nav.saves}
                  </Button>
                </div>
              ) : null}
            </Panel>
          </>
        ) : null}
      </div>

      {/* Step navigation */}
      <div className="mt-8 flex items-center justify-between gap-3">
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

function StepHeader({ title, kicker }: { title: string; kicker: string }) {
  return (
    <div className="mb-4">
      <h3 className="display text-lg font-bold uppercase tracking-wide text-ink">{title}</h3>
      <p className="mt-1 text-sm text-sub">{kicker}</p>
    </div>
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
      {error ? (
        <p className="mt-1 text-xs font-semibold text-bad">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-[11px] text-faint">{hint}</p>
      ) : null}
    </div>
  );
}
