"use client";

/**
 * v2.2 board front (FEATURES.realOrgStart): the wizard's two doors and the
 * short takeover path: region, organization, difficulty, go (one screen,
 * phone first). Each organization shows the trade-off as plain numbers:
 * its squad's rank, the cash, the season budget, the wage room, what the
 * board expects and what a missed objective costs.
 */

import { useMemo, useState } from "react";
import { CAREER_DIFFICULTY } from "@/config/balance";
import { useCareerCopy } from "@/content/careerCopy";
import { abbrevFor, realOrgChoicesFor, type RealOrgChoice } from "@/engine/career/orgProfile";
import type { CareerDifficulty } from "@/engine/career/types";
import { buildWorldAtCreation, computeStars } from "@/engine/career/worldSim";
import type { Region } from "@/engine/types";
import { formatMoney } from "@/lib/format";
import { randomSeed } from "@/lib/rng";
import { cx } from "@/lib/util";
import { proceduralCrestFor } from "@/components/career/OrgMark";
import { REGION_BADGE } from "@/components/regionStyle";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { useCareerStore } from "@/store/careerStore";

const REGIONS: Region[] = ["EU", "NA", "SAM", "MENA", "OCE", "APAC", "SSA"];
const DIFFICULTIES: CareerDifficulty[] = ["easy", "normal", "hard"];

const option = (active: boolean) =>
  cx("panel w-full text-left transition-colors", active ? "panel-glow-orange" : "hover:!border-line-strong");

/** The wizard's first question when the takeover is on: found a club, or take one over. */
export function WizardDoor({ onPick }: { onPick: (door: "found" | "takeover") => void }) {
  const C = useCareerCopy();
  const D = C.board.door;
  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <h1 className="display text-2xl font-bold uppercase tracking-wide text-ink">{C.wizard.title}</h1>
      <div className="mt-5 grid gap-3">
        <button type="button" className={cx(option(false), "p-4")} onClick={() => onPick("takeover")}>
          <span className="display block text-lg font-bold uppercase leading-none text-ink">{D.takeover}</span>
          <span className="mt-2 block text-sm text-sub">{D.takeoverBody}</span>
        </button>
        <button type="button" className={cx(option(false), "p-4")} onClick={() => onPick("found")}>
          <span className="display block text-lg font-bold uppercase leading-none text-ink">{D.found}</span>
          <span className="mt-2 block text-sm text-sub">{D.foundBody}</span>
        </button>
      </div>
    </div>
  );
}

function Fig({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-faint">{label}</p>
      <p className="display truncate text-base font-bold leading-tight text-ink">{value}</p>
    </div>
  );
}

function OrgOption({ c, active, onPick }: { c: RealOrgChoice; active: boolean; onPick: () => void }) {
  const C = useCareerCopy();
  const P = C.board.pick;
  return (
    <button type="button" role="radio" aria-checked={active} onClick={onPick} className={cx(option(active), "p-3")}>
      <div className="flex items-center gap-3">
        <TeamLogo orgId={c.ref} size="md" />
        <div className="min-w-0 flex-1">
          <p className="display truncate text-lg font-bold uppercase leading-none text-ink">{c.name}</p>
          <p className="mt-1 text-xs text-sub">
            {C.board.stature[c.stature]} · {P.rank(c.rank, c.teams)}
          </p>
        </div>
      </div>
      {active ? (
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-xs text-sub">{C.board.statureNote[c.stature]}</p>
          <p className="mt-2 text-sm text-ink">
            {c.players.map((p) => `${p.name} ${p.overall}`).join(" · ")}
          </p>
          <p className="mt-1 text-xs text-sub">{c.coach ? P.coach(c.coach.name, c.coach.overall) : P.noCoach}</p>
          {c.money.weekWages > 0 ? <p className="mt-1 text-xs text-sub">{C.board.budgetCovers(Math.round(c.money.grant / c.money.weekWages))}</p> : null}
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
            <Fig label={P.cash} value={formatMoney(c.money.startCash)} />
            <Fig label={P.budget} value={formatMoney(c.money.grant)} />
            <Fig label={C.board.wageBill} value={formatMoney(c.money.weekWages)} />
            <Fig label={P.wageRoom} value={formatMoney(c.money.wageRoom)} />
            <Fig label={P.expected} value={P.expectedRank(c.expectedRank)} />
            <Fig label={P.missCost} value={P.missCostValue(c.missCost)} />
            <Fig label={C.board.confidence} value={P.grace(c.graceSeasons)} />
          </div>
        </div>
      ) : null}
    </button>
  );
}

export function TakeoverWizard({ onBack, onCreated }: { onBack: () => void; onCreated: () => void }) {
  const C = useCareerCopy();
  const P = C.board.pick;
  const slots = useCareerStore((s) => s.slots);
  const createCareer = useCareerStore((s) => s.createCareer);
  const [seed] = useState(() => randomSeed());
  const [region, setRegion] = useState<Region>("EU");
  const [difficulty, setDifficulty] = useState<CareerDifficulty>(CAREER_DIFFICULTY.defaultPreset);
  const [pick, setPick] = useState<string | null>(null);
  const [manager, setManager] = useState("");
  const [full, setFull] = useState(false);
  const world = useMemo(() => computeStars(buildWorldAtCreation(seed), { seasonIndex: 0, careerSeed: seed, difficulty: "normal" }), [seed]);
  const choices = useMemo(
    () => realOrgChoicesFor(region, { careerSeed: seed, seasonIndex: 0, difficulty, world }),
    [region, seed, difficulty, world],
  );
  const chosen = choices.find((c) => c.ref === pick) ?? null;

  const go = () => {
    if (!chosen) return;
    const crest = proceduralCrestFor(chosen.ref, chosen.name);
    const slot = slots.findIndex((s) => !s);
    if (slot === -1) {
      setFull(true);
      return;
    }
    createCareer(
      slot,
      {
        identity: {
          orgName: chosen.name,
          abbrev: abbrevFor(chosen.name),
          managerName: manager.trim() || P.managerPlaceholder,
          // The roster's nationality; the org's procedural crest (the real logo shows wherever it exists).
          country: chosen.country,
          region,
          crestId: crest.crestId,
          colors: crest.colors,
          buffType: "offense",
        },
        difficulty,
        rosterKey: "balanced",
        realOrgRef: chosen.ref,
      },
      seed,
    );
    onCreated();
  };

  return (
    <div className="mx-auto max-w-xl px-4 pb-28 pt-6">
      <h1 className="display text-2xl font-bold uppercase tracking-wide text-ink">{P.title}</h1>
      <p className="mt-1 text-sm text-sub">{P.kicker}</p>

      <p className="kicker mt-5">{P.region}</p>
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={P.region}>
        {REGIONS.map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={region === r}
            onClick={() => {
              setRegion(r);
              setPick(null);
            }}
            className={cx(option(region === r), "!w-auto min-h-11 px-3")}
          >
            <Badge className={REGION_BADGE[r]}>{r}</Badge>
          </button>
        ))}
      </div>

      <p className="kicker mt-5">{P.orgs}</p>
      <div className="mt-2 grid gap-2" role="radiogroup" aria-label={P.orgs}>
        {choices.length === 0 ? <p className="text-sm text-sub">{P.empty}</p> : null}
        {choices.map((c) => (
          <OrgOption key={c.ref} c={c} active={c.ref === pick} onPick={() => setPick(c.ref)} />
        ))}
      </div>

      <p className="kicker mt-5">{P.difficulty}</p>
      <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label={P.difficulty}>
        {DIFFICULTIES.map((d) => (
          <button key={d} type="button" role="radio" aria-checked={difficulty === d} onClick={() => setDifficulty(d)} className={cx(option(difficulty === d), "min-h-11 px-2 text-center")}>
            <span className="display text-sm font-bold uppercase text-ink">{C.wizard.presets[d].label}</span>
          </button>
        ))}
      </div>

      <label className="mt-5 block">
        <span className="kicker">{P.manager}</span>
        <input
          value={manager}
          maxLength={20}
          onChange={(e) => setManager(e.target.value)}
          placeholder={P.managerPlaceholder}
          className="mt-2 block min-h-11 w-full rounded-[7px] border border-line bg-transparent px-3 text-ink"
        />
      </label>

      {full ? <p className="mt-3 text-sm text-orange-bright">{C.saves.slotsFull}</p> : null}

      <div className="action-dock mt-6 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBack}>{P.back}</Button>
        <Button variant="primary" size="lg" disabled={!chosen} onClick={go}>{P.go}</Button>
      </div>
    </div>
  );
}
