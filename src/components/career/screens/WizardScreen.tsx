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
import { CAREER_ECONOMY, CAREER_REP } from "@/config/balance";
import { useCopy } from "@/content/copy";
import { useCareerCopy } from "@/content/careerCopy";
import { lineups, orgById, orgs } from "@/data";
import { computeSalaryAsk } from "@/engine/career/economy";
import type { CareerColors, CareerDifficulty, ManagementStyle } from "@/engine/career/types";
import type { StarterOffer } from "@/engine/career/worldSim";
import type { Region, StatKey } from "@/engine/types";
import { formatMoney } from "@/lib/format";
import { randomSeed } from "@/lib/rng";
import { cx } from "@/lib/util";
import { CAREER_SLOTS } from "@/components/career/careerUi";
import { proceduralCrestFor } from "@/components/career/OrgMark";
import {
  CREST_IDS,
  CREST_PALETTE,
  PATTERN_IDS,
  SYMBOL_IDS,
  UserCrest,
  composeCrestId,
  contrastingSecondaryIndex,
} from "@/components/career/UserCrest";
import type { CrestId, PatternId, SymbolId } from "@/components/career/UserCrest";
import { REGION_BADGE } from "@/components/regionStyle";
import { Badge, CountryChip } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { useCareerStore } from "@/store/careerStore";
import { starterOffersForRegion } from "@/store/careerFlow";
import { useMounted } from "@/store/useMounted";
import { CountrySelect } from "@/components/career/wizard/CountrySelect";
import { FoundingSplash } from "@/components/career/wizard/FoundingSplash";
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
const STYLES: ManagementStyle[] = ["handsOn", "balanced", "delegate"];
const ROSTER_KEYS = ["prospects", "journeymen", "balanced"] as const;
type RosterKey = (typeof ROSTER_KEYS)[number];

/** null = the "None" tile in the pattern picker / randomizer pool. */
const PATTERN_OPTIONS = [null, ...PATTERN_IDS] as const;

/** Dimmed neighbor crests for the step-2 table-row mock (deterministic filler orgs). */
const MOCK_ROW_ABOVE = proceduralCrestFor("fill:wizard-mock-above");
const MOCK_ROW_BELOW = proceduralCrestFor("fill:wizard-mock-below");

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
  const fill = (strengths: string[]) => {
    for (const l of lineups) {
      if (l.seasonId !== "rlcs-x" || !strengths.includes(l.historicalStrength)) continue;
      const bucket = map[l.region];
      if (bucket.length >= 3 || bucket.some((b) => b.orgId === l.orgId)) continue;
      bucket.push({ orgId: l.orgId, name: orgById.get(l.orgId)?.name ?? l.orgId });
    }
  };
  fill(["elite"]);
  fill(["strong"]);
  fill(["solid", "underdog"]);
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
  // Step 2 — crest & colors & identity buff (crest v2: shape + symbol + pattern)
  const [crestShape, setCrestShape] = useState<CrestId>("shield");
  const [crestSymbol, setCrestSymbol] = useState<SymbolId | null>(null);
  const [crestPattern, setCrestPattern] = useState<PatternId | null>(null);
  const [colors, setColors] = useState<CareerColors>({
    primary: CREST_PALETTE[0].hex,
    secondary: CREST_PALETTE[1].hex,
  });
  const [buffType, setBuffType] = useState<StatKey>("offense");
  /** The composite crestId written to identity ("shape[:symbol[:pattern]]"). */
  const crestId = composeCrestId({ shape: crestShape, symbol: crestSymbol, pattern: crestPattern });
  // Step 3 — region (null = derived from country)
  const [regionPick, setRegionPick] = useState<Region | null>(null);
  // Step 4 — starter roster
  const [rosterKey, setRosterKey] = useState<RosterKey>("balanced");
  // Step 5 — difficulty & style
  const [difficulty, setDifficulty] = useState<CareerDifficulty>("normal");
  const [style, setStyle] = useState<ManagementStyle>("balanced");

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
  const budget = CAREER_ECONOMY.startingBudget[difficulty];

  const wageBillOf = useCallback(
    (offer: StarterOffer) =>
      offer.players.reduce(
        (sum, p) =>
          sum +
          computeSalaryAsk({
            overall: p.overall,
            age: p.age,
            potential: p.potential,
            rep: CAREER_REP.start,
            role: "starter",
            seasonIndex: 0,
            lengthSeasons: 2,
            difficulty,
            careerSeed: seed,
            playerId: p.id,
          }),
        0,
      ),
    [difficulty, seed],
  );

  /** Randomize every crest layer + a legibility-checked color pair (step 2 + quick start). */
  const randomizeCrest = () => {
    setCrestShape(pickRandom(CREST_IDS));
    setCrestSymbol(pickRandom(SYMBOL_IDS));
    setCrestPattern(pickRandom(PATTERN_OPTIONS));
    const primaryIdx = Math.floor(Math.random() * CREST_PALETTE.length);
    const secondaryIdx = contrastingSecondaryIndex(
      primaryIdx,
      Math.floor(Math.random() * CREST_PALETTE.length),
    );
    setColors({
      primary: CREST_PALETTE[primaryIdx].hex,
      secondary: CREST_PALETTE[secondaryIdx].hex,
    });
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
    setDifficulty("normal");
    setStyle("balanced");
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
        style,
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
        {step === 2 ? (
          <>
            <StepHeader title={C.wizard.crestTitle} kicker={C.wizard.crestKicker} />
            <div className="grid gap-4 lg:grid-cols-[1fr_minmax(16rem,19rem)]">
              <Panel className="p-5">
                {/* Shape */}
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="kicker">{C.wizard.crestLabel}</p>
                  <Button variant="secondary" size="sm" onClick={randomizeCrest}>
                    {C.wizard.randomizeCrest}
                  </Button>
                </div>
                <div
                  className="grid grid-cols-4 gap-2 sm:grid-cols-6"
                  role="radiogroup"
                  aria-label={C.wizard.crestLabel}
                >
                  {CREST_IDS.map((id) => (
                    <CrestTile
                      key={id}
                      active={crestShape === id}
                      ariaLabel={id}
                      onClick={() => setCrestShape(id)}
                      className="min-h-14"
                    >
                      <UserCrest crestId={id} colors={colors} size="md" />
                    </CrestTile>
                  ))}
                </div>

                {/* Symbol */}
                <p className="kicker mb-3 mt-6">{C.wizard.crestSymbol}</p>
                <div
                  className="grid grid-cols-3 gap-2 sm:grid-cols-5"
                  role="radiogroup"
                  aria-label={C.wizard.crestSymbol}
                >
                  <CrestTile
                    active={crestSymbol === null}
                    ariaLabel={C.wizard.crestNone}
                    onClick={() => setCrestSymbol(null)}
                    className="min-h-[5.25rem]"
                  >
                    <NoneLabel active={crestSymbol === null}>{C.wizard.crestNone}</NoneLabel>
                  </CrestTile>
                  {SYMBOL_IDS.map((sy) => (
                    <CrestTile
                      key={sy}
                      active={crestSymbol === sy}
                      ariaLabel={sy}
                      onClick={() => setCrestSymbol(sy)}
                      className="min-h-[5.25rem]"
                    >
                      <UserCrest
                        crestId={composeCrestId({ shape: crestShape, symbol: sy })}
                        colors={colors}
                        size="lg"
                      />
                    </CrestTile>
                  ))}
                </div>

                {/* Pattern */}
                <p className="kicker mb-3 mt-6">{C.wizard.crestPattern}</p>
                <div
                  className="grid grid-cols-3 gap-2 sm:grid-cols-6"
                  role="radiogroup"
                  aria-label={C.wizard.crestPattern}
                >
                  <CrestTile
                    active={crestPattern === null}
                    ariaLabel={C.wizard.crestNone}
                    onClick={() => setCrestPattern(null)}
                    className="min-h-14"
                  >
                    <NoneLabel active={crestPattern === null}>{C.wizard.crestNone}</NoneLabel>
                  </CrestTile>
                  {PATTERN_IDS.map((pt) => (
                    <CrestTile
                      key={pt}
                      active={crestPattern === pt}
                      ariaLabel={pt}
                      onClick={() => setCrestPattern(pt)}
                      className="min-h-14"
                    >
                      <UserCrest
                        crestId={composeCrestId({ shape: crestShape, pattern: pt })}
                        colors={colors}
                        size="md"
                      />
                    </CrestTile>
                  ))}
                </div>

                {/* Colors — independent primary/secondary swatches */}
                <p className="kicker mb-3 mt-6">{C.wizard.primaryColor}</p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={C.wizard.primaryColor}>
                  {CREST_PALETTE.map((c) => (
                    <Swatch
                      key={c.id}
                      hex={c.hex}
                      name={c.id}
                      active={colors.primary === c.hex}
                      disabled={colors.secondary === c.hex}
                      onClick={() => setColors((prev) => ({ ...prev, primary: c.hex }))}
                    />
                  ))}
                </div>
                <p className="kicker mb-3 mt-6">{C.wizard.secondaryColor}</p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={C.wizard.secondaryColor}>
                  {CREST_PALETTE.map((c) => (
                    <Swatch
                      key={c.id}
                      hex={c.hex}
                      name={c.id}
                      active={colors.secondary === c.hex}
                      disabled={colors.primary === c.hex}
                      onClick={() => setColors((prev) => ({ ...prev, secondary: c.hex }))}
                    />
                  ))}
                </div>

                <p className="kicker mb-1 mt-6">{C.wizard.identityBuff}</p>
                <p className="mb-3 text-xs text-sub">{C.wizard.identityBuffHint}</p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={C.wizard.identityBuff}>
                  {STAT_KEYS.map((key) => {
                    const active = buffType === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setBuffType(key)}
                        className={cx(
                          "display h-11 rounded-lg border px-3.5 text-xs font-bold uppercase tracking-[0.12em] transition-all",
                          active
                            ? "border-orange/60 bg-orange/15 text-orange-bright"
                            : "border-line-strong bg-white/5 text-sub hover:border-line-strong hover:text-ink",
                        )}
                      >
                        {copy.STAT_LABELS[key]}
                      </button>
                    );
                  })}
                </div>
              </Panel>

              {/* Live crest preview + small-size legibility strip */}
              <Panel strong className="relative flex flex-col items-center justify-center gap-4 overflow-hidden p-6 text-center">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-16 h-56 w-56 rounded-full opacity-20 blur-3xl"
                  style={{ background: `radial-gradient(circle, ${colors.primary}, transparent 70%)` }}
                />
                <UserCrest crestId={crestId} colors={colors} abbrev={abbrev || undefined} size="xl" />
                <div>
                  <p className="display text-xl font-bold uppercase tracking-wide text-ink">
                    {nameTrim || "—"}
                  </p>
                  <div className="mt-2 flex items-center justify-center gap-2">
                    {abbrev ? <Badge tone="blue">{abbrev}</Badge> : null}
                    <Badge tone="orange">{copy.STAT_LABELS[buffType]}</Badge>
                  </div>
                </div>

                {/* Standings-row mock: the crest at sm size between dimmed filler rows */}
                <div className="relative w-full rounded-xl border border-line bg-black/30 p-1 text-left">
                  <MockStandingRow pos="3" crest={MOCK_ROW_ABOVE} />
                  <div className="flex items-center gap-2.5 rounded-lg border border-orange/40 bg-orange/10 px-2 py-1.5">
                    <span className="w-4 shrink-0 text-center font-mono text-[11px] font-semibold text-orange-bright">
                      4
                    </span>
                    <UserCrest crestId={crestId} colors={colors} abbrev={abbrev || undefined} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">
                      {nameTrim || abbrev || "—"}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-sub">7–2</span>
                  </div>
                  <MockStandingRow pos="5" crest={MOCK_ROW_BELOW} />
                </div>
              </Panel>
            </div>
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
                const wage = wageBillOf(offer);
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
                      <span className="display text-base font-bold uppercase tracking-wide text-ink">
                        {labels[key].label}
                      </span>
                      {key === "balanced" ? <Badge tone="gold">{C.wizard.recommended}</Badge> : null}
                    </div>
                    <p className="mb-3 text-xs leading-relaxed text-sub">{labels[key].desc}</p>

                    <div className="mb-3 space-y-2">
                      {offer.players.map((p) => {
                        const lo = Math.max(Math.round(p.overall), p.potential - 5);
                        const hi = Math.min(99, p.potential + 5);
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
                              {C.player.potBand(lo, hi)}
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
                          {C.squad.perSplit(`~${formatMoney(wage, { compact: true })}`)}
                        </span>
                      </div>
                      <ProgressBar
                        value={wage / budget}
                        tone={wage > budget / 2 ? "orange" : "blue"}
                        label={C.wizard.wageBill}
                      />
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-sub">{C.finances.balance}</span>
                        <span className="display font-bold text-good">{formatMoney(budget)}</span>
                      </div>
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
            <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label={C.wizard.finalTitle}>
              {DIFFICULTIES.map((id) => {
                const active = difficulty === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setDifficulty(id)}
                    className={cx(
                      "panel p-4 text-left transition-all",
                      active && "panel-glow-orange !border-orange/60",
                      !active && "hover:!border-line-strong",
                    )}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="display text-base font-bold uppercase tracking-wide text-ink">
                        {copy.DIFFICULTY_LABELS[id].label}
                      </span>
                      {active ? <Badge tone="orange">{copy.SETUP.selected}</Badge> : null}
                    </div>
                    <p className="mb-3 text-xs leading-relaxed text-sub">
                      {copy.DIFFICULTY_LABELS[id].tagline}
                    </p>
                    <Badge tone="blue">
                      {C.finances.balance}: {formatMoney(CAREER_ECONOMY.startingBudget[id])}
                    </Badge>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-faint">{C.common.difficultyNote}</p>

            <p className="kicker mb-3 mt-6">{C.wizard.styleTitle}</p>
            <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label={C.wizard.styleTitle}>
              {STYLES.map((id) => {
                const active = style === id;
                const labels: Record<ManagementStyle, { label: string; desc: string }> = {
                  handsOn: { label: C.wizard.styleHandsOn, desc: C.wizard.styleHandsOnDesc },
                  balanced: { label: C.wizard.styleBalanced, desc: C.wizard.styleBalancedDesc },
                  delegate: { label: C.wizard.styleDelegate, desc: C.wizard.styleDelegateDesc },
                };
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setStyle(id)}
                    className={cx(
                      "panel p-4 text-left transition-all",
                      active && "panel-glow-blue !border-blue/60",
                      !active && "hover:!border-line-strong",
                    )}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="display text-base font-bold uppercase tracking-wide text-ink">
                        {labels[id].label}
                      </span>
                      {active ? <Badge tone="blue">{copy.SETUP.selected}</Badge> : null}
                    </div>
                    <p className="text-xs leading-relaxed text-sub">{labels[id].desc}</p>
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
                  <Badge tone="neutral">{copy.DIFFICULTY_LABELS[difficulty].label}</Badge>
                  <Badge tone="blue">{formatMoney(budget)}</Badge>
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

/** Radio-grid tile for the step-2 shape/symbol/pattern pickers (44px+ targets). */
function CrestTile({
  active,
  ariaLabel,
  onClick,
  className,
  children,
}: {
  active: boolean;
  ariaLabel: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cx(
        "flex items-center justify-center rounded-xl border p-1 transition-all",
        active
          ? "border-orange/60 bg-orange/10 panel-glow-orange"
          : "border-line bg-white/[0.03] hover:border-line-strong hover:bg-white/[0.06]",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** "None" tile content for the symbol/pattern pickers. */
function NoneLabel({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cx(
        "display text-[11px] font-bold uppercase tracking-[0.12em]",
        active ? "text-orange-bright" : "text-sub",
      )}
    >
      {children}
    </span>
  );
}

/**
 * Single color swatch (44px target). The swatch already used by the OTHER
 * role is disabled so primary/secondary can never collapse into one color.
 */
function Swatch({
  hex,
  name,
  active,
  disabled,
  onClick,
}: {
  hex: string;
  name: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={name}
      title={name}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "h-11 w-11 rounded-full border-2 transition-all",
        active ? "scale-110 border-white/80" : "border-white/15",
        !active && !disabled && "hover:border-white/40",
        disabled && "cursor-not-allowed opacity-30",
      )}
      style={{ background: hex }}
    />
  );
}

/** Dimmed neighbor row for the step-2 legibility mock (skeleton bars, no fake copy). */
function MockStandingRow({
  pos,
  crest,
}: {
  pos: string;
  crest: ReturnType<typeof proceduralCrestFor>;
}) {
  return (
    <div
      aria-hidden
      className="flex items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 opacity-45"
    >
      <span className="w-4 shrink-0 text-center font-mono text-[11px] text-faint">{pos}</span>
      <UserCrest crestId={crest.crestId} colors={crest.colors} size="sm" />
      <span className="h-2 w-16 rounded-full bg-white/15" />
      <span className="ml-auto h-2 w-6 shrink-0 rounded-full bg-white/10" />
    </div>
  );
}

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
