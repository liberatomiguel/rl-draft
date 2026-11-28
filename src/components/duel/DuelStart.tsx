"use client";

/**
 * rc9 duel-ui: the start of a duel. Job: set the rules and start the draft,
 * in one step. The rules are small cards to press (rerolls 0 / 3 / 7, the
 * overalls shown or hidden, Classic or Quick), the region a select, the name
 * optional; one button starts the draft. A duel's draft left half-way sits on
 * top with Resume and Drop.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DUEL_MATCH, REGION_LOCK } from "@/config/balance";
import { useCopy } from "@/content/copy";
import { makeDuelRules, type DuelMode } from "@/engine/duelRules";
import type { Region } from "@/engine/types";
import { randomSeed } from "@/lib/rng";
import { sfx } from "@/lib/sfx";
import { lastDuelName, saveDuelName } from "@/store/duelStore";
import { useRunStore } from "@/store/runStore";
import { Button } from "@/components/ui/Button";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { OptionCard, useRegionName } from "./DuelParts";
import { DuelResume } from "./DuelResume";
import { DuelNameField } from "./DuelNameField";

export function DuelStart() {
  const { DUEL_MATCH_UI: D } = useCopy();
  const router = useRouter();
  const regionName = useRegionName();
  const run = useRunStore((s) => s.run);
  const startDuelMatch = useRunStore((s) => s.startDuelMatch);
  const [rerolls, setRerolls] = useState<number>(DUEL_MATCH.defaultRerolls);
  const [showOverall, setShowOverall] = useState<boolean>(DUEL_MATCH.defaultShowOverall);
  const [mode, setMode] = useState<DuelMode>("classic");
  const [region, setRegion] = useState<Region | null>(null);
  const [name, setName] = useState<string>(() => lastDuelName());
  const [failed, setFailed] = useState(false);
  const inProgress = run?.duelMatch && !run.duelMatch.done ? run : null;

  const start = () => {
    sfx.start();
    saveDuelName(name.trim());
    const rules = makeDuelRules({ mode, rerolls, showOverall, region }, randomSeed());
    if (!startDuelMatch({ rules, role: "challenger", name })) {
      setFailed(true);
      return;
    }
    router.push("/play");
  };

  return (
    <div className="mx-auto max-w-3xl pb-8 rise-in">
      {inProgress ? <DuelResume run={inProgress} className="mb-8" /> : null}

      <SectionTitle title={D.startTitle} kicker={D.startLead} className="mb-4 sm:mb-6" />

      <Panel strong className="p-4 sm:p-6">
        <div className="card-head">
          <h2 className="card-title">{D.rulesTitle}</h2>
          <span className="kicker text-faint">{D.bestOf(DUEL_MATCH.bestOf)}</span>
        </div>

        <fieldset className="mt-2">
          <legend className="kicker mb-2 text-faint">{D.rerollsLabel}</legend>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {DUEL_MATCH.rerollPresets.map((n) => (
              <OptionCard
                key={n}
                pressed={rerolls === n}
                onClick={() => setRerolls(n)}
                figure={<span className="text-3xl sm:text-4xl">{n}</span>}
                name={n === 0 ? D.rerollsNone : D.rerolls(n)}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-faint">{D.rerollsHint}</p>
        </fieldset>

        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <fieldset>
            <legend className="kicker mb-2 text-faint">{D.overallLabel}</legend>
            <div className="grid grid-cols-2 gap-2">
              <OptionCard
                pressed={showOverall}
                onClick={() => setShowOverall(true)}
                figure={<span className="text-2xl">87</span>}
                name={D.overallShown}
                label={D.overallVisible}
                hint={D.overallVisibleHint}
              />
              <OptionCard
                pressed={!showOverall}
                onClick={() => setShowOverall(false)}
                figure={<span className="text-2xl">??</span>}
                name={D.overallHidden}
                label={D.overallSecret}
                hint={D.overallSecretHint}
              />
            </div>
          </fieldset>
          <fieldset>
            <legend className="kicker mb-2 text-faint">{D.modeLabel}</legend>
            <div className="grid grid-cols-2 gap-2">
              <OptionCard
                pressed={mode === "classic"}
                onClick={() => setMode("classic")}
                figure={<span className="text-lg">{D.modeClassicShort}</span>}
                name={D.modeClassic}
                hint={D.modeClassicHint}
              />
              <OptionCard
                pressed={mode === "quick"}
                onClick={() => setMode("quick")}
                figure={<span className="text-lg">{D.modeQuickShort}</span>}
                name={D.modeQuick}
                hint={D.modeQuickHint}
              />
            </div>
          </fieldset>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 border-t border-line pt-5 sm:grid-cols-2">
          <label className="block">
            <span className="kicker mb-2 block text-faint">{D.regionLabel}</span>
            <select
              value={region ?? ""}
              onChange={(e) => setRegion((e.target.value || null) as Region | null)}
              className="min-h-11 w-full rounded-[7px] border border-line-strong bg-surface px-3 text-[15px] text-ink"
            >
              <option value="">{regionName(null)}</option>
              {REGION_LOCK.regions.map((r) => (
                <option key={r} value={r}>
                  {regionName(r)}
                </option>
              ))}
            </select>
          </label>
          <DuelNameField value={name} onChange={setName} />
        </div>
      </Panel>

      {failed ? (
        <p className="mt-4 text-sm text-bad" role="alert">
          {D.startFailed}
        </p>
      ) : null}

      <div className="action-dock mt-6 sm:flex sm:items-center sm:gap-5">
        <Button variant={inProgress ? "secondary" : "primary"} size="lg" full className="sm:w-auto sm:min-w-64" onClick={start}>
          {D.startDraft}
        </Button>
        <p className="mt-2 text-xs text-faint max-sm:hidden sm:mt-0">{D.exhibition}</p>
      </div>
      <p className="mt-4 text-xs text-faint sm:hidden">{D.exhibition}</p>
    </div>
  );
}
