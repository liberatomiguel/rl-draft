"use client";

/**
 * v2.2 rc.6 (ORGMODE UI-A): the pick. Replaces the rc.5 TakeoverWizard
 * ("functional and plain", which Miguel rejected on staging).
 *
 * Desktop (lg): the region's organizations on the left, grouped by tier, one
 * board of rows per tier (logo, name, regional rank, the squad's rating as the
 * figure); the selected organization's dossier on the right. Phone: the list
 * is its own step; a tap opens the dossier as the next step, with the action
 * docked on the bottom edge.
 *
 * The dossier is read from the save the takeover would create
 * (`takeoverPreviewOf`, same input and seed as the button), so what it says
 * is day one: the starters as the game's own squad cards (with the org's real
 * logo), the coach, what the club inherits, what the board proposes for the
 * season. One filled button on the screen: take over this organization.
 */

import { useMemo, useRef, useState } from "react";
import { CAREER_DIFFICULTY } from "@/config/balance";
import { useCopy } from "@/content/copy";
import { useCareerCopy, type CareerCopy } from "@/content/careerCopy";
import { abbrevFor, realOrgChoicesFor, type RealOrgChoice } from "@/engine/career/orgProfile";
import type { Stature } from "@/engine/career/boardTypes";
import type { CareerDifficulty } from "@/engine/career/types";
import { buildWorldAtCreation, computeStars } from "@/engine/career/worldSim";
import type { Region } from "@/engine/types";
import { formatMoney } from "@/lib/format";
import { randomSeed } from "@/lib/rng";
import { cx } from "@/lib/util";
import { goalText } from "@/components/career/board/BoardParts";
import { SquadCard } from "@/components/career/hub/SquadBlock";
import { proceduralCrestFor } from "@/components/career/OrgMark";
import { QUICKSTART_MANAGER_NAMES, regionForCountry } from "@/components/career/wizard/countries";
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
import { briefLinesOf } from "@/components/career/board/briefLines";

const REGIONS: Region[] = ["EU", "NA", "SAM", "MENA", "OCE", "APAC", "SSA"];
const TIERS: Stature[] = ["elite", "contender", "mid", "underdog"];
const DIFFICULTIES: CareerDifficulty[] = ["easy", "normal", "hard"];

/** The takeover's input: the button and the dossier build the SAME one (the manager's name aside, which no rule reads). */
export function takeoverInputOf(c: RealOrgChoice, difficulty: CareerDifficulty, managerName: string): CreateCareerInput {
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
  };
}

function initialRegion(): Region {
  try {
    const cc = navigator.language?.split("-")[1]?.toUpperCase();
    return (cc && regionForCountry(cc)) || "EU";
  } catch {
    return "EU";
  }
}

// ---------------------------------------------------------------------------
// The list
// ---------------------------------------------------------------------------

function OrgRow({
  c,
  active,
  focusable,
  onPick,
  onKey,
  C,
}: {
  c: RealOrgChoice;
  active: boolean;
  focusable: boolean;
  onPick: () => void;
  onKey: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  C: CareerCopy;
}) {
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
        "flex min-h-16 w-full items-center gap-3 border-b border-line px-3 py-2.5 text-left transition-colors last:border-b-0",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-bright",
        active ? "bg-orange/[0.08] shadow-[inset_3px_0_0_var(--orange)]" : "hover:bg-white/[0.03]",
      )}
    >
      <TeamLogo orgId={c.ref} size="md" />
      <span className="min-w-0 flex-1">
        <span className="display block truncate text-lg font-bold uppercase leading-none text-ink">{c.name}</span>
        <span className="mt-1 block text-xs text-sub">{C.takeover.pick.rank(c.rank, c.teams)}</span>
      </span>
      <span className="shrink-0 text-right leading-none">
        <span className="display block text-2xl font-bold text-ink">{Math.round(c.rating)}</span>
        <span className="mt-1 block text-[11px] text-faint">{C.common.ovr}</span>
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// The dossier
// ---------------------------------------------------------------------------

function Figure({ value, label, note }: { value: string; label: string; note?: string }) {
  return (
    <div className="min-w-0">
      <p className="display truncate text-2xl font-bold leading-none text-ink sm:text-[1.75rem]">{value}</p>
      <p className="mt-1.5 text-xs text-sub">{label}</p>
      {note ? <p className="text-[11px] text-faint">{note}</p> : null}
    </div>
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
  const save = preview.save;
  const plan = preview.proposed;
  const ceiling = preview.wageCeiling;
  const over = ceiling !== null && preview.weekWages > ceiling;
  const brief = briefLinesOf(C, preview.brief, c.name);
  const itemNames = [
    ...preview.gear.map((g) => C.finances.gear[g]),
  ];
  const staffNames = preview.staff.map((s) => (s === "psychologist" ? C.finances.psychologist : C.finances.staff[s].title));

  return (
    <div className="panel p-4 sm:p-6">
      {/* Who: the logo, the name, its tier and place, the tier's one line. */}
      <div className="flex items-center gap-4">
        <TeamLogo orgId={c.ref} size="xl" loading="eager" className="max-sm:!h-14 max-sm:!w-14" />
        <div className="min-w-0">
          <h3 className="display text-[1.6rem] uppercase leading-[0.95] text-ink [overflow-wrap:break-word] sm:text-4xl">{c.name}</h3>
          <p className="mt-2 text-sm text-ink">
            <span className="font-semibold">{C.board.stature[c.stature]}</span>
            <span className="text-sub"> · {copy.SETUP.regionNames[c.region]} · {P.rank(c.rank, c.teams)}</span>
          </p>
          <p className="mt-0.5 text-sm text-sub">{C.board.statureNote[c.stature]}</p>
        </div>
      </div>

      {/* The roster: the game's own squad cards, then the coach as one row. */}
      <h4 className="card-title mt-6">{D.squad}</h4>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
        {preview.starters.map((p) => (
          <SquadCard key={p.id} save={save} p={p} C={C} className="sm:min-h-56" />
        ))}
      </div>
      <div className="mt-2.5 flex min-h-12 items-center gap-3 rounded-xl border border-line px-3 py-2">
        <WhistleIcon className="h-5 w-5 shrink-0 text-cyan" />
        {preview.coach ? (
          <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-ink">{preview.coach.name}</span>
              <span className="block text-[11px] text-sub">{D.coach}</span>
            </span>
            <span className="display shrink-0 text-xl font-bold leading-none text-ink">
              {Math.round(preview.coach.overall)} <span className="text-[11px] font-semibold text-faint">{C.common.ovr}</span>
            </span>
          </span>
        ) : (
          <span className="text-sm text-sub">{D.noCoach}</span>
        )}
      </div>

      {/* What the club inherits: two figures, the wages against the ceiling, the structure. */}
      <h4 className="card-title mt-7">{D.inherit}</h4>
      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4">
        <Figure value={formatMoney(preview.cash)} label={D.cash} />
        {plan ? <Figure value={formatMoney(plan.budget)} label={D.budget} note={D.budgetNote} /> : <Figure value={formatMoney(c.money.grant)} label={D.budget} />}
      </div>
      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs text-sub">{D.wages}</span>
          <span className="display text-lg font-bold leading-none text-ink">
            {formatMoney(preview.weekWages)}
            {ceiling !== null ? <span className="ml-2 text-xs font-semibold text-sub">{D.ceiling(formatMoney(ceiling))}</span> : null}
          </span>
        </div>
        {ceiling !== null ? (
          <ProgressBar value={preview.weekWages / ceiling} tone={over ? "orange" : "blue"} className="mt-2 h-1.5" label={D.wages} />
        ) : null}
        {over ? <p className="mt-1 text-xs text-orange-bright">{D.overCeiling}</p> : null}
      </div>
      {/* rc.6 (UI-B pass): the structure the org arrives with, set as figures like the money above it. */}
      <div className="mt-5 grid grid-cols-2 gap-x-6 border-t border-line pt-4">
        <div className="min-w-0">
          <p className="display text-2xl font-bold leading-none tabular-nums text-ink sm:text-[1.75rem]">
            {itemNames.length}
            <span className="ml-1 text-base text-faint">/ 4</span>
          </p>
          <p className="mt-1.5 text-xs text-sub">{D.installations}</p>
          <p className="mt-1 text-xs leading-snug text-ink">{itemNames.length ? itemNames.join(", ") : <span className="text-faint">{D.noInstallations}</span>}</p>
        </div>
        <div className="min-w-0">
          <p className="display text-2xl font-bold leading-none tabular-nums text-ink sm:text-[1.75rem]">{staffNames.length}</p>
          <p className="mt-1.5 text-xs text-sub">{D.staff}</p>
          <p className="mt-1 text-xs leading-snug text-ink">{staffNames.length ? staffNames.join(", ") : <span className="text-faint">{D.noStaff}</span>}</p>
        </div>
      </div>

      {/* v2.2 MANDATE: the demand level, the house's problems and the three goals, before the player accepts. */}
      {preview.mandate ? (
        <div className="mt-7">
          <MandateDossier m={preview.mandate} C={C} />
          <p className="mt-3 text-xs text-sub">
            {D.grace(c.graceSeasons)}. {D.boardNote}
          </p>
        </div>
      ) : null}
      {/* What the board expects: the proposed plan's objective is the sentence that matters. */}
      {preview.mandate ? null : <>
      <h4 className="card-title mt-7">{D.board}</h4>
      {brief ? <p className="mt-2 text-sm text-ink">{brief.reason}</p> : null}
      {plan ? (
        <>
          <p className="display mt-3 text-2xl uppercase leading-tight text-ink">{goalText(C, plan.objective)}</p>
          <p className="mt-1.5 text-sm text-sub">{D.chance(C.board.bandWord(plan.band))}</p>
          <div className="stat-trio mt-4 grid grid-cols-3 gap-4 border-t border-line pt-4">
            {[
              { label: D.missLabel, value: `−${Math.abs(plan.miss)}`, tone: "text-bad" },
              { label: D.hitLabel, value: `+${plan.hit}`, tone: "text-good" },
              { label: D.bonusLabel, value: formatMoney(plan.bonus), tone: "text-ink" },
            ].map((f) => (
              <div key={f.label} className="border-line sm:flex sm:flex-col">
                <p className="text-xs text-sub sm:order-2 sm:mt-1">{f.label}</p>
                <p className={cx("display text-xl font-bold leading-none sm:order-1", f.tone)}>{f.value}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-sub">
            {D.grace(c.graceSeasons)}. {D.boardNote}
          </p>
          {preview.secondary ? (
            <p className="mt-2 text-sm text-ink">
              <span className="text-sub">{D.also}: </span>
              {C.board.secondaryLabel(preview.secondary.kind, preview.secondary.kind === "wages" ? formatMoney(preview.secondary.value) : String(preview.secondary.value))}
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-2 text-sm text-sub">{D.noBoard}</p>
      )}
      </>}

      {/* The career's two settings: difficulty and the manager's name. */}
      <div className="mt-7 grid gap-5 border-t border-line pt-5 sm:grid-cols-2">
        <div>
          <p className="kicker mb-2">{D.difficulty}</p>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={D.difficulty}>
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={difficulty === d}
                onClick={() => onDifficulty(d)}
                className={cx(
                  "display min-h-11 rounded-lg border px-2 text-sm font-bold uppercase transition-colors",
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
            className="h-11 w-full rounded-lg border border-line-strong bg-white/5 px-3 text-sm text-ink placeholder:text-faint transition-colors focus:border-orange/60 focus:outline-none"
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
  const [managerDefault] = useState(() => QUICKSTART_MANAGER_NAMES[Math.floor(Math.random() * QUICKSTART_MANAGER_NAMES.length)]);
  const [region, setRegion] = useState<Region>(initialRegion);
  const [difficulty, setDifficulty] = useState<CareerDifficulty>(CAREER_DIFFICULTY.defaultPreset);
  const [pick, setPick] = useState<string | null>(null);
  const [phoneStep, setPhoneStep] = useState<"list" | "dossier">("list");
  const [manager, setManager] = useState("");
  const [full, setFull] = useState(false);
  const [arrived, setArrived] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const world = useMemo(() => computeStars(buildWorldAtCreation(seed), { seasonIndex: 0, careerSeed: seed, difficulty: "normal" }), [seed]);
  // Only the regions with an organization to take over get a tab (APAC and SSA have none in the first season).
  const regions = useMemo(
    () => REGIONS.filter((r) => realOrgChoicesFor(r, { careerSeed: seed, seasonIndex: 0, difficulty: "normal", world }).length > 0),
    [seed, world],
  );
  const regionShown = regions.includes(region) ? region : (regions[0] ?? region);
  const choices = useMemo(
    () => realOrgChoicesFor(regionShown, { careerSeed: seed, seasonIndex: 0, difficulty, world }),
    [regionShown, seed, difficulty, world],
  );
  // The region's first organization reads until the player picks (the desktop dossier is never empty).
  const chosen = choices.find((c) => c.ref === pick) ?? choices[0] ?? null;
  const groups = TIERS.map((t) => ({ tier: t, orgs: choices.filter((c) => c.stature === t) })).filter((g) => g.orgs.length > 0);

  // The dossier: the save this org's takeover creates (memoized per org, difficulty and seed).
  const preview = useMemo(
    () => (chosen ? takeoverPreviewOf(takeoverInputOf(chosen, difficulty, managerDefault), seed) : null),
    [chosen, difficulty, managerDefault, seed],
  );

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
    createCareer(slot, takeoverInputOf(chosen, difficulty, manager.trim().length >= 2 ? manager.trim() : managerDefault), seed);
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
      <SectionTitle title={P.title} kicker={P.kicker} className={cx(phoneStep === "dossier" && "max-lg:hidden")} />

      <div className={cx("mt-5 grid grid-cols-1 gap-6 lg:mt-6 lg:grid-cols-[minmax(0,23rem)_minmax(0,1fr)] lg:items-start", phoneStep === "dossier" && "max-lg:mt-0")}>
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
                  "display -mb-px flex min-h-11 flex-1 items-center justify-center border-b-2 px-1 text-sm font-semibold uppercase tracking-[0.04em] transition-colors",
                  regionShown === r ? "border-orange text-ink" : "border-transparent text-sub hover:text-ink",
                )}
              >
                {r}
              </button>
            ))}
          </div>

          <div ref={listRef} className="mt-4" role="radiogroup" aria-label={P.orgs}>
            {choices.length === 0 ? <p className="py-6 text-sm text-sub">{P.empty}</p> : null}
            {choices.length > 0 && choices.length < 4 ? <p className="mb-3 text-xs text-sub">{P.fewOrgs(choices.length)}</p> : null}
            {groups.map((g) => (
              <section key={g.tier} className="mb-5 last:mb-0" aria-label={C.board.stature[g.tier]}>
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h3 className="display shrink-0 text-base font-bold uppercase leading-none text-ink">{C.board.stature[g.tier]}</h3>
                  <p className="text-xs text-sub">{C.board.statureNote[g.tier]}</p>
                </div>
                <div className="overflow-hidden rounded-xl border border-line bg-surface">
                  {g.orgs.map((c) => (
                    <OrgRow
                      key={c.ref}
                      c={c}
                      C={C}
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
            <div className="panel p-6 text-sm text-sub">{choices.length === 0 ? P.empty : P.none}</div>
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
