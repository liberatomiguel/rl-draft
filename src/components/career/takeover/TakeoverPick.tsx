"use client";

/**
 * v2.2 rc.6 (ORGMODE UI-A): the pick. rc9 ORG-UI (#270): rebuilt around the
 * decision the player makes here, which house to take over.
 *
 * Desktop (lg): the region's organizations on the left, one board of rows per
 * tier. The tier's heading says how big the house is and what its board asks
 * (the same for every org of the tier, so said once); each row is the org's
 * mark and name, its place in the region, its most pressing problem, and the
 * squad's level as the figure. The selected org's file on the right. Phone: the
 * list is its own step; a tap opens the file, the action docked at the bottom.
 *
 * The file is read from the save the takeover would create (`takeoverPreviewOf`,
 * same input and seed as the button), so it is day one: the starters as the
 * game's own squad cards, the coach, the money (cash, the board's budget and
 * the one sentence that relates them), the structure in the org catalogue's
 * terms, the deal in force, the board's mandate. No reputation number anywhere.
 * The rows' problem lines are read the same way, one org per idle slice.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { CAREER_DIFFICULTY } from "@/config/balance";
import { useCopy } from "@/content/copy";
import { useCareerCopy, type CareerCopy } from "@/content/careerCopy";
import { abbrevFor, realOrgChoicesFor, type RealOrgChoice } from "@/engine/career/orgProfile";
import type { Stature } from "@/engine/career/boardTypes";
import { orgIssuesOf } from "@/engine/career/mandate";
import { takeoverStartEraFor } from "@/engine/career/era";
import { seasonLabelFor } from "@/engine/career/calendar";
import type { CareerDifficulty } from "@/engine/career/types";
import { buildWorldAtCreation, computeStars } from "@/engine/career/worldSim";
import type { Region } from "@/engine/types";
import { sponsorBrandById } from "@/data/career/sponsors";
import { formatMoney } from "@/lib/format";
import { randomSeed } from "@/lib/rng";
import { cx } from "@/lib/util";
import { SquadCard } from "@/components/career/hub/SquadBlock";
import { proceduralCrestFor } from "@/components/career/OrgMark";
import { QUICKSTART_MANAGER_NAMES, regionForCountry } from "@/components/career/wizard/countries";
import { formatDateShort } from "@/components/career/dateText";
import { moneyGapSentenceOf } from "@/components/career/finances/budgetLines";
import { dealViewOf } from "@/components/career/sponsors/dealView";
import { WhistleIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui/Button";
import { SectionTitle } from "@/components/ui/Panel";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { useCareerStore } from "@/store/careerStore";
import type { CreateCareerInput } from "@/store/careerFlow";
import { takeoverPreviewOf, type TakeoverPreview } from "@/store/takeoverPreview";
import { ArrivalSplash } from "./ArrivalSplash";
import { MandateDossier } from "@/components/career/board/MandateParts";

const REGIONS: Region[] = ["EU", "NA", "SAM", "MENA", "OCE", "APAC", "SSA"];
const TIERS: Stature[] = ["elite", "contender", "mid", "underdog"];
const DIFFICULTIES: CareerDifficulty[] = ["easy", "normal", "hard"];

/** The takeover's input: the button and the dossier build the SAME one (the manager's name aside, which no rule reads). */
export function takeoverInputOf(c: RealOrgChoice, difficulty: CareerDifficulty, managerName: string, startSeasonIndex?: number): CreateCareerInput {
  const crest = proceduralCrestFor(c.ref, c.name);
  return {
    identity: {
      orgName: c.name,
      abbrev: abbrevFor(c.name),
      managerName,
      // The roster's nationality; the org's procedural crest is kept for old readers (UserOrgMark shows the real logo).
      country: c.country,
      region: c.region,
      crestId: crest.crestId,
      colors: crest.colors,
      buffType: "offense",
    },
    difficulty,
    rosterKey: "balanced",
    realOrgRef: c.ref,
    ...(startSeasonIndex ? { startSeasonIndex } : {}),
  };
}

/** v2.2 ORGMODE-2027 (E4): the takeover's era: the default, or the staging build's `?era=N`. */
function startEraOfPage(): number {
  try {
    return takeoverStartEraFor(globalThis.location?.search ?? "");
  } catch {
    return takeoverStartEraFor("");
  }
}

function initialRegion(): Region {
  try {
    const cc = navigator.language?.split("-")[1]?.toUpperCase();
    return (cc && regionForCountry(cc)) || "EU";
  } catch {
    return "EU";
  }
}

/** The org's most pressing problem on day one (the mandate's first issue), as its title; "" when none. */
function topProblemOf(preview: TakeoverPreview, C: CareerCopy): string {
  const issues = preview.mandate?.issues ?? orgIssuesOf(preview.save);
  const first = issues[0];
  return first ? (C.board.mandate.issue[first.kind] ?? "") : "";
}

// ---------------------------------------------------------------------------
// The list
// ---------------------------------------------------------------------------

function OrgRow({
  c,
  problem,
  active,
  focusable,
  onPick,
  onKey,
  C,
}: {
  c: RealOrgChoice;
  /** The top problem's title; undefined while it is read, "" when the house has none. */
  problem: string | undefined;
  active: boolean;
  focusable: boolean;
  onPick: () => void;
  onKey: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  C: CareerCopy;
}) {
  const P = C.takeover.pick;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      tabIndex={focusable ? 0 : -1}
      data-ref={c.ref}
      onClick={onPick}
      onKeyDown={onKey}
      className={cx(
        "flex min-h-[4.25rem] w-full items-center gap-3 border-b border-line px-3 py-3 text-left transition-colors last:border-b-0",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-bright",
        // The selected row is a state: its hairline turns orange (DESIGN.md "State"), never a bar on the edge.
        active ? "bg-white/[0.04] outline outline-1 -outline-offset-1 outline-orange" : "hover:bg-white/[0.03]",
      )}
    >
      <TeamLogo orgId={c.ref} size="md" />
      <span className="min-w-0 flex-1">
        <span className="display block truncate text-[15px] font-bold leading-tight text-ink">{c.name}</span>
        <span className="mt-0.5 block truncate text-xs text-faint">{P.rank(c.rank, c.teams)}</span>
        <span className={cx("mt-0.5 block min-h-4 truncate text-xs", problem ? "text-sub" : "text-faint")}>
          {problem === undefined ? "" : problem || P.problemNone}
        </span>
      </span>
      <span className="shrink-0 text-right leading-none">
        <span className="display block text-2xl font-bold tabular-nums text-ink">{Math.round(c.rating)}</span>
        <span className="mt-1 block text-[11px] text-faint">{P.squadLabel}</span>
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// The dossier
// ---------------------------------------------------------------------------

/** A figure: the number large, its label quiet under it. */
function Figure({ value, label, tone = "text-ink" }: { value: string; label: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <p className={cx("display truncate text-2xl font-bold leading-none tabular-nums sm:text-[1.75rem]", tone)}>{value}</p>
      <p className="mt-1.5 text-xs text-faint">{label}</p>
    </div>
  );
}

/** One line of the structure: its name, its state on the right. */
function StructureRow({ name, value, quiet }: { name: string; value: string; quiet?: boolean }) {
  return (
    <li className="flex min-h-11 items-center justify-between gap-3 border-b border-line py-2 last:border-b-0">
      <span className="min-w-0 text-sm text-ink">{name}</span>
      <span className={cx("shrink-0 text-right text-sm tabular-nums", quiet ? "text-faint" : "text-sub")}>{value}</span>
    </li>
  );
}

function Dossier({
  c,
  preview,
  difficulty,
  onDifficulty,
  manager,
  onManager,
  managerDefault,
}: {
  c: RealOrgChoice;
  preview: TakeoverPreview;
  difficulty: CareerDifficulty;
  onDifficulty: (d: CareerDifficulty) => void;
  manager: string;
  onManager: (v: string) => void;
  managerDefault: string;
}) {
  const C = useCareerCopy();
  const copy = useCopy();
  const D = C.takeover.dossier;
  const P = C.takeover.pick;
  const O = C.orgmode.org;
  const save = preview.save;
  const ceiling = preview.wageCeiling;
  const over = ceiling !== null && preview.weekWages > ceiling;
  const money = preview.money;
  const org = preview.org;
  const deal = preview.sponsor ? dealViewOf(save) : null;
  const brand = deal ? sponsorBrandById.get(deal.sponsorId) : null;
  const staffed = org ? org.departments.filter((d) => d.staffed) : [];

  return (
    <div className="panel p-4 sm:p-6">
      {/* Who: the logo, the name, how big the house is, the one line on its pull. */}
      <div className="flex items-center gap-4">
        <TeamLogo orgId={c.ref} size="xl" loading="eager" className="max-sm:!h-14 max-sm:!w-14" />
        <div className="min-w-0">
          <h2 className="display text-[1.6rem] font-bold uppercase leading-[1.05] text-ink [overflow-wrap:break-word] sm:text-4xl">{c.name}</h2>
          <p className="mt-2 text-sm text-ink">
            {C.board.stature[c.stature]}
            <span className="text-faint"> · {copy.SETUP.regionNames[c.region]} · {P.rank(c.rank, c.teams)}</span>
          </p>
          <p className="mt-0.5 text-sm text-sub">{C.board.statureNote[c.stature]}</p>
          {preview.sense ? <p className="mt-0.5 text-xs text-faint">{C.orgmode.sense.pull(preview.sense.signCap)}</p> : null}
          {c.returningFrom !== undefined && <p className="mt-0.5 text-xs text-faint">{P.returning(seasonLabelFor(c.returningFrom))}</p>}
        </div>
      </div>

      {/* The roster: the game's own squad cards, then the coach as one row. */}
      <h3 className="card-title mt-7">{D.squad}</h3>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
        {preview.starters.map((p) => (
          <SquadCard key={p.id} save={save} p={p} C={C} className="sm:min-h-56" />
        ))}
      </div>
      <div className="mt-2.5 flex min-h-12 items-center gap-3 rounded-xl border border-line px-3 py-2">
        <WhistleIcon className="h-5 w-5 shrink-0 text-sub" />
        {preview.coach ? (
          <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="display block truncate text-[15px] font-bold text-ink">{preview.coach.name}</span>
              <span className="block text-xs text-faint">{D.coach}</span>
            </span>
            <span className="display shrink-0 text-xl font-bold leading-none tabular-nums text-ink">
              {Math.round(preview.coach.overall)} <span className="text-[11px] font-semibold text-faint">{C.common.ovr}</span>
            </span>
          </span>
        ) : (
          <span className="text-sm text-sub">{D.noCoach}</span>
        )}
      </div>

      {/* The money: cash and the board's budget as figures, the sentence that relates them, the wages against the ceiling. */}
      <h3 className="card-title mt-8">{D.inherit}</h3>
      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4">
        <Figure value={formatMoney(preview.cash)} label={D.cash} />
        <Figure value={formatMoney(money ? money.budget.amount : (preview.proposed?.budget ?? c.money.grant))} label={D.budget} />
      </div>
      {money ? <p className="mt-3 text-sm leading-snug text-sub">{moneyGapSentenceOf(C, money, (n) => formatMoney(n, { compact: true }))}</p> : null}
      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs text-faint">{D.wages}</span>
          <span className="display text-lg font-bold leading-none tabular-nums text-ink">
            {formatMoney(preview.weekWages)}
            {ceiling !== null ? <span className="ml-2 text-xs font-semibold text-faint">{D.ceiling(formatMoney(ceiling))}</span> : null}
          </span>
        </div>
        {ceiling !== null ? (
          <ProgressBar value={preview.weekWages / ceiling} tone={over ? "orange" : "blue"} className="mt-2 h-1.5" label={D.wages} />
        ) : null}
        {over ? <p className="mt-1 text-xs text-orange-bright">{D.overCeiling}</p> : null}
      </div>

      {/* The structure in the org's own terms, and the deal in force: rows, a state on the right. */}
      {org ? (
        <div className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">
          <div className="min-w-0">
            <p className="kicker mb-1">{D.structure}</p>
            <ul className="border-t border-line">
              {org.facilities.map((f) => (
                <StructureRow key={f.id} name={O.name[f.id]} value={f.level > 0 ? O.level(f.level, f.maxLevel) : O.notBuilt} quiet={f.level === 0} />
              ))}
            </ul>
          </div>
          <div className="min-w-0">
            <p className="kicker mb-1">{D.departments}</p>
            {staffed.length ? (
              <ul className="border-t border-line">
                {staffed.map((d) => (
                  <StructureRow key={d.id} name={O.name[d.id]} value={O.perWeek(formatMoney(d.weekly, { compact: true }))} />
                ))}
              </ul>
            ) : (
              <p className="border-t border-line py-2 text-sm text-faint">{D.noDepartments}</p>
            )}
          </div>
        </div>
      ) : null}
      {org ? (
        <div className="mt-5">
          <p className="kicker mb-1">{D.sponsor}</p>
          {deal ? (
            <div className="flex min-h-11 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t border-line pt-2">
              <span className="display text-[15px] font-bold text-ink">{brand?.name ?? deal.sponsorId}</span>
              <span className="text-sm tabular-nums text-sub">
                {D.sponsorTerms(formatMoney(deal.weekly, { compact: true }), formatDateShort(C.dates, deal.endsOn))}
              </span>
            </div>
          ) : (
            <p className="border-t border-line pt-2 text-sm text-faint">{D.noSponsor}</p>
          )}
        </div>
      ) : null}

      {/* The board: the demand, the house's problems and the three goals, before the player accepts. */}
      {preview.mandate ? (
        <div className="mt-8">
          <MandateDossier m={preview.mandate} C={C} />
          <p className="mt-3 text-xs text-faint">{D.grace(c.graceSeasons)}</p>
        </div>
      ) : (
        <p className="mt-8 text-sm text-sub">{D.noBoard}</p>
      )}

      {/* The career's two settings: difficulty and the manager's name. */}
      <div className="mt-8 grid gap-5 border-t border-line pt-5 sm:grid-cols-2">
        <div>
          <p className="kicker mb-2" id="takeover-difficulty">{D.difficulty}</p>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby="takeover-difficulty">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={difficulty === d}
                onClick={() => onDifficulty(d)}
                className={cx(
                  "display min-h-11 rounded-[7px] border px-2 text-sm font-semibold uppercase transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-bright",
                  difficulty === d ? "border-orange text-ink" : "border-line text-sub hover:border-line-strong hover:text-ink",
                )}
              >
                {C.wizard.presets[d].label}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="kicker mb-2 block">{D.manager}</span>
          <input
            value={manager}
            maxLength={24}
            onChange={(e) => onManager(e.target.value)}
            placeholder={managerDefault}
            className="h-11 w-full rounded-[7px] border border-line-strong bg-white/5 px-3 text-sm text-ink placeholder:text-faint transition-colors focus:border-orange/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-bright"
          />
        </label>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------

export function TakeoverPick({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const C = useCareerCopy();
  const copy = useCopy();
  const P = C.takeover.pick;
  const slots = useCareerStore((s) => s.slots);
  const createCareer = useCareerStore((s) => s.createCareer);
  const [seed] = useState(() => randomSeed());
  const [era] = useState(startEraOfPage);
  const [managerDefault] = useState(() => QUICKSTART_MANAGER_NAMES[Math.floor(Math.random() * QUICKSTART_MANAGER_NAMES.length)]);
  const [region, setRegion] = useState<Region>(initialRegion);
  const [difficulty, setDifficulty] = useState<CareerDifficulty>(CAREER_DIFFICULTY.defaultPreset);
  const [pick, setPick] = useState<string | null>(null);
  const [phoneStep, setPhoneStep] = useState<"list" | "dossier">("list");
  const [manager, setManager] = useState("");
  const [full, setFull] = useState(false);
  const [arrived, setArrived] = useState(false);
  // The rows' problem lines, read one org per idle slice (key: ref|difficulty).
  const [problems, setProblems] = useState<Record<string, string>>({});
  const listRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const world = useMemo(() => computeStars(buildWorldAtCreation(seed, era), { seasonIndex: era, careerSeed: seed, difficulty: "normal" }), [seed, era]);
  // Only the regions with an organization to take over get a tab (APAC and SSA have none in the first season).
  const regions = useMemo(
    () => REGIONS.filter((r) => realOrgChoicesFor(r, { careerSeed: seed, seasonIndex: era, difficulty: "normal", world }).length > 0),
    [seed, era, world],
  );
  const regionShown = regions.includes(region) ? region : (regions[0] ?? region);
  const choices = useMemo(
    () => realOrgChoicesFor(regionShown, { careerSeed: seed, seasonIndex: era, difficulty, world }),
    [regionShown, seed, era, difficulty, world],
  );
  // The region's first organization reads until the player picks (the desktop dossier is never empty).
  const chosen = choices.find((c) => c.ref === pick) ?? choices[0] ?? null;
  const groups = TIERS.map((t) => ({ tier: t, orgs: choices.filter((c) => c.stature === t) })).filter((g) => g.orgs.length > 0);

  // The dossier: the save this org's takeover creates (memoized per org, difficulty and seed).
  const preview = useMemo(
    () => (chosen ? takeoverPreviewOf(takeoverInputOf(chosen, difficulty, managerDefault, era), seed) : null),
    [chosen, difficulty, managerDefault, seed, era],
  );

  // The rows' problem lines: each org's day-one file, one per idle slice so the list never stalls.
  useEffect(() => {
    const todo = choices.filter((c) => problems[`${c.ref}|${difficulty}`] === undefined);
    if (!todo.length) return;
    const c = todo[0];
    const idle = (globalThis as { requestIdleCallback?: (f: () => void) => number }).requestIdleCallback;
    const run = () => {
      let line = "";
      try {
        line = topProblemOf(takeoverPreviewOf(takeoverInputOf(c, difficulty, managerDefault, era), seed), C);
      } catch {
        line = "";
      }
      setProblems((m) => ({ ...m, [`${c.ref}|${difficulty}`]: line }));
    };
    const id = idle ? idle(run) : window.setTimeout(run, 16);
    return () => {
      const cancel = (globalThis as { cancelIdleCallback?: (n: number) => void }).cancelIdleCallback;
      if (idle && cancel) cancel(id);
      else window.clearTimeout(id);
    };
  }, [choices, problems, difficulty, managerDefault, era, seed, C]);

  const choose = (ref: string, toDossier: boolean) => {
    setPick(ref);
    if (toDossier) {
      setPhoneStep("dossier");
      topRef.current?.scrollIntoView({ block: "start" });
    }
  };

  /** Arrow keys move the pick inside the list (the radiogroup's own keys). */
  const onKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const i = choices.findIndex((c) => c.ref === chosen?.ref);
    const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!step || i < 0) return;
    e.preventDefault();
    const next = choices[(i + step + choices.length) % choices.length];
    setPick(next.ref);
    listRef.current?.querySelector<HTMLButtonElement>(`[data-ref="${CSS.escape(next.ref)}"]`)?.focus();
  };

  const go = () => {
    if (!chosen) return;
    const slot = slots.findIndex((s) => !s);
    if (slot === -1) {
      setFull(true);
      return;
    }
    createCareer(slot, takeoverInputOf(chosen, difficulty, manager.trim().length >= 2 ? manager.trim() : managerDefault, era), seed);
    setArrived(true);
  };

  const action = chosen ? (
    <Button variant="primary" size="lg" disabled={arrived} onClick={go} className="max-sm:flex-1">
      <span className="truncate sm:hidden">{P.goShort}</span>
      <span className="truncate max-sm:hidden">{P.go(chosen.name)}</span>
    </Button>
  ) : null;

  return (
    <div ref={topRef} className="mx-auto max-w-6xl scroll-mt-16 px-3 py-4 sm:px-4 sm:py-6">
      <SectionTitle title={P.title} kicker={P.kicker(seasonLabelFor(era))} className={cx(phoneStep === "dossier" && "max-lg:hidden")} />

      <div className={cx("mt-5 grid grid-cols-1 gap-6 lg:mt-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start lg:gap-8", phoneStep === "dossier" && "max-lg:mt-0")}>
        {/* ---- The list (a step of its own on a phone) ---- */}
        <div className={cx("min-w-0", phoneStep === "dossier" && "max-lg:hidden")}>
          <div className="phone-tabs flex border-b border-line" role="tablist" aria-label={P.regions}>
            {regions.map((r) => (
              <button
                key={r}
                type="button"
                role="tab"
                aria-selected={regionShown === r}
                title={copy.SETUP.regionNames[r]}
                onClick={() => {
                  setRegion(r);
                  setPick(null);
                }}
                className={cx(
                  "display -mb-px flex min-h-11 flex-1 items-center justify-center border-b-2 px-1 text-[13px] uppercase tracking-[0.05em] transition-colors",
                  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-bright",
                  regionShown === r ? "border-orange font-bold text-ink" : "border-transparent font-semibold text-sub hover:text-ink",
                )}
              >
                {r}
              </button>
            ))}
          </div>

          <div ref={listRef} className="mt-5" role="radiogroup" aria-label={P.orgs}>
            {choices.length === 0 ? <p className="py-6 text-sm text-sub">{P.empty(seasonLabelFor(era))}</p> : null}
            {choices.length > 0 && choices.length < 4 ? <p className="mb-3 text-xs text-sub">{P.fewOrgs(choices.length)}</p> : null}
            {groups.map((g) => (
              <section key={g.tier} className="mb-6 last:mb-0" aria-label={C.board.stature[g.tier]}>
                {/* How big the house is, and what its board asks: the same for the whole tier, so said once here. */}
                <div className="mb-2">
                  <h3 className="card-title">{C.board.stature[g.tier]}</h3>
                  <p className="mt-0.5 text-xs text-sub">{P.ask[g.tier]}</p>
                </div>
                <div className="overflow-hidden rounded-xl border border-line bg-surface">
                  {g.orgs.map((c) => (
                    <OrgRow
                      key={c.ref}
                      c={c}
                      C={C}
                      problem={problems[`${c.ref}|${difficulty}`]}
                      active={c.ref === chosen?.ref}
                      focusable={c.ref === chosen?.ref}
                      onPick={() => choose(c.ref, true)}
                      onKey={onKey}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        {/* ---- The dossier (the next step on a phone) ---- */}
        <div className={cx("min-w-0", phoneStep === "list" && "max-lg:hidden")}>
          <Button variant="ghost" size="sm" className="mb-2 lg:hidden" onClick={() => setPhoneStep("list")}>
            {P.allOrgs}
          </Button>
          {chosen && preview ? (
            <Dossier
              c={chosen}
              preview={preview}
              difficulty={difficulty}
              onDifficulty={setDifficulty}
              manager={manager}
              onManager={setManager}
              managerDefault={managerDefault}
            />
          ) : (
            <div className="panel p-6 text-sm text-sub">{choices.length === 0 ? P.empty(seasonLabelFor(era)) : P.none}</div>
          )}
          {full ? <p className="mt-3 text-sm text-bad">{C.takeover.door.slotsFull}</p> : null}
          <div className="sticky bottom-0 z-10 mt-4 hidden items-center justify-between gap-3 border-t border-line bg-bg py-3 lg:flex">
            <Button variant="ghost" onClick={onBack}>{P.back}</Button>
            {action}
          </div>
        </div>
      </div>

      {/* The action, docked on the phone's bottom edge (the list step has only the way back). */}
      <div className="action-dock mt-6 flex items-center justify-between gap-3 lg:hidden">
        <Button variant="ghost" onClick={phoneStep === "dossier" ? () => setPhoneStep("list") : onBack}>
          {P.back}
        </Button>
        {phoneStep === "dossier" ? action : null}
      </div>

      {arrived ? <ArrivalSplash onDone={onDone} /> : null}
    </div>
  );
}
