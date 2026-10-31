"use client";

/**
 * Road to Worlds — the creation wizard's CREST step (rc.36, UX-04, R88;
 * extracted from WizardScreen).
 *
 * Shape × symbol × layout × pattern, then the colours: the curated kits are
 * presets (one tap fills both colours, nothing is locked), the primary and
 * the accent are picked on their own (the predefined palette), and the
 * crest previews live — a sticky mini preview on phones, the big one beside
 * the pickers on desktop, plus a standings-row mock at the size the tables
 * use. Colors are picked from the curated presets and palette only; saved
 * custom colors remain readable.
 */

import type { CareerCopy } from "@/content/careerCopy";
import type { CareerColors } from "@/engine/career/types";
import type { StatKey } from "@/engine/types";
import { cx } from "@/lib/util";
import { proceduralCrestFor } from "@/components/career/OrgMark";
import {
  WIZARD_CREST_IDS,
  WIZARD_PATTERN_IDS,
  WIZARD_SYMBOL_IDS,
  composeCrestId,
  CREST_PALETTE,
  CREST_WIZARD_KITS,
  CREST_WIZARD_PALETTE,
  LAYOUT_IDS,
  UserCrest,
  type CrestId,
  type LayoutId,
  type PatternId,
  type SymbolId,
} from "@/components/career/UserCrest";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";

/** Dimmed neighbor crests for the table-row mock (deterministic filler orgs). */
const MOCK_ROW_ABOVE = proceduralCrestFor("fill:wizard-mock-above");
const MOCK_ROW_BELOW = proceduralCrestFor("fill:wizard-mock-below");

export interface CrestPick {
  shape: CrestId;
  symbol: SymbolId | null;
  pattern: PatternId | null;
  layout: LayoutId;
}

const sameHex = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
/** The palette id of a hex (the colour's name key), or the hex itself for a free pick. */
const idOfHex = (hex: string): string =>
  CREST_WIZARD_PALETTE.find((c) => sameHex(c.hex, hex))?.id ?? CREST_PALETTE.find((c) => sameHex(c.hex, hex))?.id ?? hex;

export function CrestStep({
  C,
  statLabels,
  statKeys,
  orgName,
  abbrev,
  pick,
  onPick,
  colors,
  onColors,
  buffType,
  onBuff,
  onRandomize,
}: {
  C: CareerCopy;
  statLabels: Record<StatKey, string>;
  statKeys: StatKey[];
  orgName: string;
  abbrev: string;
  pick: CrestPick;
  onPick: (next: Partial<CrestPick>) => void;
  colors: CareerColors;
  onColors: (next: CareerColors) => void;
  buffType: StatKey;
  onBuff: (key: StatKey) => void;
  onRandomize: () => void;
}) {
  const W = C.wizard;
  const crestId = composeCrestId(pick);
  const nameOf = (id: string) => W.colorNames[id] ?? id;
  // An older saved option remains visible and selected while editing it.
  const shapeChoices: readonly CrestId[] = (WIZARD_CREST_IDS as readonly CrestId[]).includes(pick.shape)
    ? WIZARD_CREST_IDS : [...WIZARD_CREST_IDS, pick.shape];
  const symbolChoices: readonly SymbolId[] = !pick.symbol || (WIZARD_SYMBOL_IDS as readonly SymbolId[]).includes(pick.symbol)
    ? WIZARD_SYMBOL_IDS : [...WIZARD_SYMBOL_IDS, pick.symbol];
  const patternChoices: readonly PatternId[] = !pick.pattern || (WIZARD_PATTERN_IDS as readonly PatternId[]).includes(pick.pattern)
    ? WIZARD_PATTERN_IDS : [...WIZARD_PATTERN_IDS, pick.pattern];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_minmax(16rem,19rem)]">
      <Panel className="p-4 sm:p-5">
        {/* phones: the crest stays in sight while the pickers scroll (the big preview sits below) */}
        <div className="sticky top-16 z-20 -mx-1 mb-4 flex items-center gap-3 rounded-xl border border-line-strong bg-[color:var(--bg-raised)] px-3 py-2 shadow-lg lg:hidden">
          <UserCrest crestId={crestId} colors={colors} abbrev={abbrev || undefined} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="display truncate text-base font-bold uppercase tracking-wide text-ink">{orgName || "—"}</p>
          </div>
          <UserCrest crestId={crestId} colors={colors} abbrev={abbrev || undefined} size="sm" />
        </div>

        {/* Shape */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="kicker">{W.crestLabel}</p>
          <Button variant="secondary" size="sm" onClick={onRandomize}>
            {W.randomizeCrest}
          </Button>
        </div>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-7" role="radiogroup" aria-label={W.crestLabel}>
          {shapeChoices.map((id) => (
            <CrestTile key={id} active={pick.shape === id} ariaLabel={id} onClick={() => onPick({ shape: id })} className="min-h-14">
              <UserCrest crestId={id} colors={colors} size="md" />
            </CrestTile>
          ))}
        </div>

        {/* Symbol */}
        <p className="kicker mb-3 mt-6">{W.crestSymbol}</p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" role="radiogroup" aria-label={W.crestSymbol}>
          <CrestTile active={pick.symbol === null} ariaLabel={W.crestNone} onClick={() => onPick({ symbol: null })} className="min-h-[4.5rem]">
            <NoneLabel active={pick.symbol === null}>{W.crestNone}</NoneLabel>
          </CrestTile>
          {symbolChoices.map((sy) => (
            <CrestTile key={sy} active={pick.symbol === sy} ariaLabel={sy} onClick={() => onPick({ symbol: sy })} className="min-h-[4.5rem]">
              <UserCrest crestId={composeCrestId({ shape: pick.shape, symbol: sy })} colors={colors} size="lg" />
            </CrestTile>
          ))}
        </div>

        {/* Layout (rc.36): the emblem alone, over the letters, or a band carrying them */}
        <p className="kicker mb-3 mt-6">{W.crestLayout}</p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={W.crestLayout}>
          {LAYOUT_IDS.map((ly) => (
            <CrestTile
              key={ly}
              active={pick.layout === ly}
              ariaLabel={W.crestLayouts[ly]}
              onClick={() => onPick({ layout: ly })}
              className="min-h-[6.5rem] flex-col gap-1 py-2"
            >
              <UserCrest crestId={composeCrestId({ ...pick, layout: ly })} colors={colors} abbrev={abbrev || "ORG"} size="lg" />
              <span className={cx("display text-[10px] font-bold uppercase tracking-[0.1em]", pick.layout === ly ? "text-orange-bright" : "text-sub")}>
                {W.crestLayouts[ly]}
              </span>
            </CrestTile>
          ))}
        </div>

        {/* Pattern */}
        <p className="kicker mb-3 mt-6">{W.crestPattern}</p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" role="radiogroup" aria-label={W.crestPattern}>
          <CrestTile active={pick.pattern === null} ariaLabel={W.crestNone} onClick={() => onPick({ pattern: null })} className="min-h-14">
            <NoneLabel active={pick.pattern === null}>{W.crestNone}</NoneLabel>
          </CrestTile>
          {patternChoices.map((pt) => (
            <CrestTile key={pt} active={pick.pattern === pt} ariaLabel={pt} onClick={() => onPick({ pattern: pt })} className="min-h-14">
              <UserCrest crestId={composeCrestId({ shape: pick.shape, pattern: pt })} colors={colors} size="md" />
            </CrestTile>
          ))}
        </div>

        {/* Colours: presets fill both, then each on its own */}
        <p className="kicker mb-1 mt-6">{W.kits}</p>
        <p className="mb-3 text-xs text-sub">{W.kitsHint}</p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8" role="radiogroup" aria-label={W.kits}>
          {CREST_WIZARD_KITS.map((k) => {
            const active = sameHex(colors.primary, k.primary) && sameHex(colors.secondary, k.secondary);
            const kitName = `${nameOf(idOfHex(k.primary))} · ${nameOf(idOfHex(k.secondary))}`;
            return (
              <button
                key={k.id}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={kitName}
                title={kitName}
                onClick={() => onColors({ primary: k.primary, secondary: k.secondary })}
                className={cx(
                  "relative h-11 overflow-hidden rounded-lg border transition-transform hover:scale-105",
                  active ? "border-orange ring-2 ring-orange/50" : "border-line-strong",
                )}
                style={{ background: `linear-gradient(135deg, ${k.primary} 0 55%, ${k.secondary} 55% 100%)` }}
              />
            );
          })}
        </div>

        <ColorRow
          label={W.primaryColor}
          value={colors.primary}
          nameOf={nameOf}
          onPick={(hex) => onColors({ ...colors, primary: hex })}
        />
        <ColorRow
          label={W.secondaryColor}
          value={colors.secondary}
          nameOf={nameOf}
          onPick={(hex) => onColors({ ...colors, secondary: hex })}
        />

        <p className="kicker mb-1 mt-6">{W.identityBuff}</p>
        <p className="mb-3 text-xs text-sub">{W.identityBuffHint}</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={W.identityBuff}>
          {statKeys.map((key) => {
            const active = buffType === key;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onBuff(key)}
                className={cx(
                  "display h-11 rounded-lg border px-3.5 text-xs font-bold uppercase tracking-[0.12em] transition-all",
                  active
                    ? "border-orange/60 bg-orange/15 text-orange-bright"
                    : "border-line-strong bg-white/5 text-sub hover:border-line-strong hover:text-ink",
                )}
              >
                {statLabels[key]}
              </button>
            );
          })}
        </div>
        <p className="mt-3 max-w-lg border-l-2 border-orange/40 pl-3 text-xs leading-relaxed text-sub" role="status">
          {W.playstyleHelp[buffType]}
        </p>
      </Panel>

      {/* Live crest preview + small-size legibility strip */}
      <Panel strong className="relative flex flex-col items-center justify-center gap-4 overflow-hidden p-6 text-center lg:sticky lg:top-20 lg:self-start">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 h-56 w-56 rounded-full opacity-20 blur-3xl"
          style={{ background: `radial-gradient(circle, ${colors.primary}, transparent 70%)` }}
        />
        <UserCrest crestId={crestId} colors={colors} abbrev={abbrev || undefined} size="xl" />
        <div>
          <p className="display text-xl font-bold uppercase tracking-wide text-ink">{orgName || "—"}</p>
          <div className="mt-2 flex items-center justify-center gap-2">
            {abbrev ? <Badge tone="blue">{abbrev}</Badge> : null}
            <Badge tone="orange">{statLabels[buffType]}</Badge>
          </div>
        </div>

        {/* Standings-row mock: the crest at sm size between dimmed filler rows */}
        <div className="relative w-full rounded-xl border border-line bg-black/30 p-1 text-left">
          <MockStandingRow pos="3" crest={MOCK_ROW_ABOVE} />
          <div className="flex items-center gap-2.5 rounded-lg border border-orange/40 bg-orange/10 px-2 py-1.5">
            <span className="w-4 shrink-0 text-center font-mono text-[11px] font-semibold text-orange-bright">4</span>
            <UserCrest crestId={crestId} colors={colors} abbrev={abbrev || undefined} size="sm" />
            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">{orgName || abbrev || "—"}</span>
            <span className="shrink-0 font-mono text-[11px] text-sub">7–2</span>
          </div>
          <MockStandingRow pos="5" crest={MOCK_ROW_BELOW} />
        </div>
      </Panel>
    </div>
  );
}

/** One colour role, picked from the predefined palette. */
function ColorRow({
  label,
  value,
  nameOf,
  onPick,
}: {
  label: string;
  value: string;
  nameOf: (id: string) => string;
  onPick: (hex: string) => void;
}) {
  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center gap-2">
        <span aria-hidden className="h-4 w-4 rounded-full border border-white/30" style={{ background: value }} />
        <p className="kicker">{label}</p>
        <span className="font-mono text-[10px] uppercase text-faint">{value}</span>
      </div>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-8" role="radiogroup" aria-label={label}>
        {CREST_WIZARD_PALETTE.map((c) => {
          const active = sameHex(value, c.hex);
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={nameOf(c.id)}
              title={nameOf(c.id)}
              onClick={() => onPick(c.hex)}
              className={cx(
                "h-11 w-full rounded-lg border-2 transition-transform",
                active ? "scale-110 border-white/80" : "border-white/15 hover:border-white/40",
              )}
              style={{ background: c.hex }}
            />
          );
        })}
      </div>
    </div>
  );
}

/** Radio-grid tile for the shape / symbol / layout / pattern pickers (44px+ targets). */
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

/** "None" tile content for the symbol / pattern pickers. */
function NoneLabel({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span className={cx("display text-[11px] font-bold uppercase tracking-[0.12em]", active ? "text-orange-bright" : "text-sub")}>
      {children}
    </span>
  );
}

/** Dimmed neighbor row for the legibility mock (skeleton bars, no fake copy). */
function MockStandingRow({ pos, crest }: { pos: string; crest: ReturnType<typeof proceduralCrestFor> }) {
  return (
    <div aria-hidden className="flex items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 opacity-45">
      <span className="w-4 shrink-0 text-center font-mono text-[11px] text-faint">{pos}</span>
      <UserCrest crestId={crest.crestId} colors={crest.colors} size="sm" />
      <span className="h-2 w-16 rounded-full bg-white/15" />
      <span className="ml-auto h-2 w-6 shrink-0 rounded-full bg-white/10" />
    </div>
  );
}
