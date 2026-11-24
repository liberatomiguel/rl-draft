"use client";

/**
 * v2.2 Pro (PRO-SPEC §4.1, R150): create a player. One page: nickname,
 * country and region, the start age (13 or 14), the style (the six
 * archetypes) and the difficulty; the one filled button creates him in the
 * slot from `?slot=` (or the first empty one) and opens his card.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CAREER_DIFFICULTY, CAREER_PRO } from "@/config/balance";
import { useCopy } from "@/content/copy";
import { useCareerCopy } from "@/content/careerCopy";
import { cleanProName } from "@/engine/career/pro/create";
import type { ProStartAge } from "@/engine/career/pro/types";
import type { ArchetypeId, CareerDifficulty } from "@/engine/career/types";
import type { Region } from "@/engine/types";
import { cx } from "@/lib/util";
import { CountrySelect } from "@/components/career/wizard/CountrySelect";
import { regionForCountry } from "@/components/career/wizard/countries";
import { AppLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { useProStore } from "@/store/proStore";
import { useMounted } from "@/store/useMounted";

const REGIONS: Region[] = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"];
const STYLES: ArchetypeId[] = ["allround", "mechanical", "playmaker", "anchor", "icecold", "veteranmind"];
const DIFFICULTIES: CareerDifficulty[] = ["easy", "normal", "hard"];

const inputCls =
  "h-11 w-full rounded-lg border border-line-strong bg-white/5 px-3 text-sm text-ink " +
  "placeholder:text-faint transition-colors focus:border-orange/60 focus:outline-none";

/** An option: the pick is the orange hairline, nothing more (DESIGN.md). */
const option = (active: boolean): string =>
  cx("panel min-h-11 text-left transition-colors", active ? "panel-glow-orange" : "hover:!border-line-strong");

export function ProWizardScreen() {
  const C = useCareerCopy();
  const copy = useCopy();
  const router = useRouter();
  const params = useSearchParams();
  const mounted = useMounted();
  const slots = useProStore((s) => s.slots);
  const createPro = useProStore((s) => s.createPro);

  const [name, setName] = useState("");
  const [country, setCountry] = useState("BR");
  const [region, setRegion] = useState<Region>("SAM");
  const [startAge, setStartAge] = useState<ProStartAge>(13);
  const [style, setStyle] = useState<ArchetypeId>("allround");
  const [difficulty, setDifficulty] = useState<CareerDifficulty>(CAREER_DIFFICULTY.defaultPreset);

  if (!mounted) return <div className="min-h-[60vh]" aria-busy />;

  const wanted = Number(params.get("slot"));
  const slot =
    Number.isInteger(wanted) && wanted >= 0 && wanted < slots.length && !slots[wanted]
      ? wanted
      : slots.findIndex((s) => !s);
  const clean = cleanProName(name);
  const canCreate = clean !== null && slot >= 0;

  const create = () => {
    if (!canCreate) return;
    createPro(slot, { name: clean, country, region, startAge, archetype: style, difficulty });
    router.push("/career/pro/player");
  };

  return (
    <div className="mobile-action-space rise-in mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
      <SectionTitle
        title={C.pro.wizard.title}
        kicker={C.pro.wizard.kicker}
        right={
          <AppLink href="/career/pro" className="text-sm font-semibold text-blue-bright hover:underline">
            {C.pro.player.allCareers}
          </AppLink>
        }
      />

      {slot < 0 ? <p className="mt-4 text-sm text-bad">{C.pro.saves.slotsFull}</p> : null}

      {/* Who he is: the name and where he is from, in one board. */}
      <Panel className="mt-5 grid gap-5 p-5 sm:grid-cols-2">
        <Field
          label={C.pro.wizard.name}
          hint={C.pro.wizard.nameLength(CAREER_PRO.nameMin, CAREER_PRO.nameMax)}
          error={name.trim().length > 0 && clean === null ? C.pro.wizard.nameLength(CAREER_PRO.nameMin, CAREER_PRO.nameMax) : undefined}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={CAREER_PRO.nameMax}
            placeholder={C.pro.wizard.namePlaceholder}
            aria-label={C.pro.wizard.name}
            className={inputCls}
          />
        </Field>
        <Field label={C.pro.wizard.country}>
          <CountrySelect
            value={country}
            onChange={(code) => {
              setCountry(code);
              const r = regionForCountry(code);
              if (r) setRegion(r);
            }}
            label={C.pro.wizard.country}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label={C.pro.wizard.region} hint={C.pro.wizard.regionHint}>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={C.pro.wizard.region}>
              {REGIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={region === r}
                  onClick={() => setRegion(r)}
                  className={cx(option(region === r), "px-3 py-2 text-sm text-ink")}
                >
                  {copy.SETUP.regionNames[r]}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </Panel>

      {/* The start age: two options, and why 13 differs. */}
      <h3 className="display mt-8 text-xl font-bold uppercase leading-none text-ink">{C.pro.wizard.age}</h3>
      <p className="mt-2 max-w-xl text-sm leading-snug text-sub">{C.pro.wizard.ageHint}</p>
      <div className="mt-3 grid max-w-md grid-cols-2 gap-3" role="radiogroup" aria-label={C.pro.wizard.age}>
        {CAREER_PRO.startAges.map((age) => (
          <button
            key={age}
            type="button"
            role="radio"
            aria-checked={startAge === age}
            onClick={() => setStartAge(age)}
            className={cx(option(startAge === age), "p-4")}
          >
            <span className="display text-lg font-bold uppercase leading-none text-ink">{C.pro.wizard.ageOption(age)}</span>
          </button>
        ))}
      </div>

      {/* The style: the six archetypes, each with its one line. */}
      <h3 className="display mt-8 text-xl font-bold uppercase leading-none text-ink">{C.pro.wizard.style}</h3>
      <p className="mt-2 max-w-xl text-sm leading-snug text-sub">{C.pro.wizard.styleHint}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label={C.pro.wizard.style}>
        {STYLES.map((id) => {
          const lean = CAREER_PRO.styleAttrs[id] ?? [];
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={style === id}
              onClick={() => setStyle(id)}
              className={cx(option(style === id), "p-4")}
            >
              <span className="display block text-lg font-bold uppercase leading-none text-ink">{C.player.archetype[id]}</span>
              <span className="mt-2 block text-sm leading-snug text-sub">{C.player.archetypeHint[id]}</span>
              {lean.length > 0 ? (
                <span className="mt-2 block text-xs text-faint">{lean.map((k) => copy.STAT_LABELS[k]).join(" · ")}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* The difficulty: the manager's three presets. */}
      <h3 className="display mt-8 text-xl font-bold uppercase leading-none text-ink">{C.pro.wizard.difficulty}</h3>
      <p className="mt-2 max-w-xl text-sm leading-snug text-sub">{C.pro.wizard.difficultyHint}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label={C.pro.wizard.difficulty}>
        {DIFFICULTIES.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={difficulty === id}
            onClick={() => setDifficulty(id)}
            className={cx(option(difficulty === id), "p-4")}
          >
            <span className="display block text-lg font-bold uppercase leading-none text-ink">{C.wizard.presets[id].label}</span>
          </button>
        ))}
      </div>

      <div className="mt-8 flex justify-end">
        <Button variant="primary" size="lg" disabled={!canCreate} onClick={create}>
          {C.pro.wizard.create}
        </Button>
      </div>
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
      {error ? <p className="mt-1 text-xs text-bad">{error}</p> : hint ? <p className="mt-1 text-xs text-sub">{hint}</p> : null}
    </div>
  );
}
