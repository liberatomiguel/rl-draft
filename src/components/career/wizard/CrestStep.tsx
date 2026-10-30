"use client";

/**
 * Road to Worlds — the creation wizard's CREST step (rc.36, UX-04, R88;
 * extracted from WizardScreen).
 *
 * Shape × symbol × layout × pattern, then the colours: the curated kits are
 * presets (one tap fills both colours, nothing is locked), the primary and
 * the accent are picked on their own (the palette, or any colour), and the
 * crest previews live — a sticky mini preview on phones, the big one beside
 * the pickers on desktop, plus a standings-row mock at the size the tables
 * use. The contrast guard (crestContrast.ts) reads both ratios — the accent
 * on the base, the base on a dark card — and, under CAREER_CREST.contrast's
 * floors, warns and offers a one-tap fix; it never disables a swatch nor
 * changes a pick by itself.
 */

import type { CareerCopy } from "@/content/careerCopy";
import type { CareerColors } from "@/engine/career/types";
import type { StatKey } from "@/engine/types";
import { cx } from "@/lib/util";
import { proceduralCrestFor } from "@/components/career/OrgMark";
import {
  ALL_CREST_IDS,
  ALL_PATTERN_IDS,
  ALL_SYMBOL_IDS,
  composeCrestId,
  CREST_KITS,
  CREST_PALETTE,
  LAYOUT_IDS,
  UserCrest,
  type CrestId,
  type LayoutId,
  type PatternId,
  type SymbolId,
} from "@/components/career/UserCrest";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AlertIcon, CheckIcon } from "@/components/ui/icons";
import { Panel } from "@/components/ui/Panel";
import { crestContrastOf, ratioLabel } from "./crestContrast";

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
const idOfHex = (hex: string): string => CREST_PALETTE.find((c) => sameHex(c.hex, hex))?.id ?? hex;

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
  const guard = crestContrastOf(colors);
  const nameOf = (id: string) => W.colorNames[id] ?? id;
  const allOk = guard.pairOk && guard.cardOk;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_minmax(16rem,19rem)]">
      <Panel className="p-4 sm:p-5">
        {/* phones: the crest stays in sight while the pickers scroll (the big preview sits below) */}
        <div className="sticky top-16 z-20 -mx-1 mb-4 flex items-center gap-3 rounded-xl border border-line-strong bg-[color:var(--bg-raised)] px-3 py-2 shadow-lg lg:hidden">
          <UserCrest crestId={crestId} colors={colors} abbrev={abbrev || undefined} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="display truncate text-base font-bold uppercase tracking-wide text-ink">{orgName || "—"}</p>
            <p className={cx("mt-0.5 flex items-center gap-1 text-[11px] font-semibold", allOk ? "text-good" : "text-orange-bright")}>
              {allOk ? <CheckIcon className="h-3.5 w-3.5" /> : <AlertIcon className="h-3.5 w-3.5" />}
              {W.contrastTitle}
            </p>
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
          {ALL_CREST_IDS.map((id) => (
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
          {ALL_SYMBOL_IDS.map((sy) => (
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
          {ALL_PATTERN_IDS.map((pt) => (
            <CrestTile key={pt} active={pick.pattern === pt} ariaLabel={pt} onClick={() => onPick({ pattern: pt })} className="min-h-14">
              <UserCrest crestId={composeCrestId({ shape: pick.shape, pattern: pt })} colors={colors} size="md" />
            </CrestTile>
          ))}
        </div>

        {/* Colours: presets fill both, then each on its own */}
        <p className="kicker mb-1 mt-6">{W.kits}</p>
        <p className="mb-3 text-xs text-sub">{W.kitsHint}</p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8" role="radiogroup" aria-label={W.kits}>
          {CREST_KITS.map((k) => {
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
          customLabel={W.customColor}
          value={colors.primary}
          nameOf={nameOf}
          onPick={(hex) => onColors({ ...colors, primary: hex })}
        />
        <ColorRow
          label={W.secondaryColor}
          customLabel={W.customColor}
          value={colors.secondary}
          nameOf={nameOf}
          onPick={(hex) => onColors({ ...colors, secondary: hex })}
        />

        {/* The contrast guard: two ratios, a warning and a one-tap fix — never a block. */}
        <div
          className={cx(
            "mt-5 rounded-xl border p-3",
            allOk ? "border-good/30 bg-good/[0.05]" : "border-orange/40 bg-orange/[0.06]",
          )}
          role="status"
        >
          <div className="flex items-center gap-2">
            <span className={cx("flex h-7 w-7 items-center justify-center rounded-lg", allOk ? "bg-good/15 text-good" : "bg-orange/15 text-orange-bright")}>
              {allOk ? <CheckIcon className="h-4 w-4" /> : <AlertIcon className="h-4 w-4" />}
            </span>
            <p className="display text-sm font-bold uppercase tracking-[0.12em] text-ink">{W.contrastTitle}</p>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <RatioMeter label={W.contrastPair} ratio={guard.pair} ok={guard.pairOk} />
            <RatioMeter label={W.contrastCard} ratio={guard.card} ok={guard.cardOk} />
          </div>
          {allOk ? (
            <p className="mt-2 text-xs text-sub">{W.contrastGood}</p>
          ) : (
            <div className="mt-2 space-y-2">
              {!guard.pairOk ? <p className="text-xs text-ink">{W.contrastLowPair}</p> : null}
              {!guard.cardOk ? <p className="text-xs text-ink">{W.contrastLowCard}</p> : null}
              <div className="flex flex-wrap gap-2">
                {guard.fixAccent ? (
                  <FixButton hex={guard.fixAccent.hex} onClick={() => onColors({ ...colors, secondary: guard.fixAccent!.hex })}>
                    {W.contrastUseAccent(nameOf(guard.fixAccent.id))}
                  </FixButton>
                ) : null}
                {guard.fixPrimary ? (
                  <FixButton hex={guard.fixPrimary.hex} onClick={() => onColors({ ...colors, primary: guard.fixPrimary!.hex })}>
                    {W.contrastUsePrimary(nameOf(guard.fixPrimary.id))}
                  </FixButton>
                ) : null}
                {guard.swapFixes ? (
                  <Button variant="ghost" size="sm" className="min-h-11 border border-line" onClick={() => onColors({ primary: colors.secondary, secondary: colors.primary })}>
                    {W.contrastSwap}
                  </Button>
                ) : null}
              </div>
              <p className="text-[10px] text-faint">{W.contrastKeep}</p>
            </div>
          )}
        </div>

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

/** One colour role: the palette swatches, then any colour (the native picker). */
function ColorRow({
  label,
  customLabel,
  value,
  nameOf,
  onPick,
}: {
  label: string;
  customLabel: string;
  value: string;
  nameOf: (id: string) => string;
  onPick: (hex: string) => void;
}) {
  const inPalette = CREST_PALETTE.some((c) => sameHex(c.hex, value));
  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center gap-2">
        <span aria-hidden className="h-4 w-4 rounded-full border border-white/30" style={{ background: value }} />
        <p className="kicker">{label}</p>
        <span className="font-mono text-[10px] uppercase text-faint">{value}</span>
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {CREST_PALETTE.map((c) => {
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
                "h-11 w-11 rounded-full border-2 transition-transform",
                active ? "scale-110 border-white/80" : "border-white/15 hover:border-white/40",
              )}
              style={{ background: c.hex }}
            />
          );
        })}
        <label
          title={customLabel}
          className={cx(
            "relative flex h-11 w-11 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2",
            !inPalette ? "scale-110 border-white/80" : "border-white/15 hover:border-white/40",
          )}
          style={{
            background: !inPalette
              ? value
              : "conic-gradient(from 0deg, #ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #3b82f6, #a855f7, #ef4444)",
          }}
        >
          <span className="sr-only">{customLabel}</span>
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : "#000000"}
            onChange={(e) => onPick(e.target.value)}
            aria-label={`${label} — ${customLabel}`}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
          {inPalette ? <span aria-hidden className="display text-base font-bold text-white drop-shadow">+</span> : null}
        </label>
      </div>
    </div>
  );
}

function RatioMeter({ label, ratio, ok }: { label: string; ratio: number; ok: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-black/20 px-2.5 py-2">
      <p className="text-[10px] leading-tight text-faint">{label}</p>
      <p className={cx("display mt-0.5 flex items-center gap-1 text-lg font-bold", ok ? "text-good" : "text-orange-bright")}>
        {ok ? <CheckIcon className="h-4 w-4" /> : <AlertIcon className="h-4 w-4" />}
        {ratioLabel(ratio)}
      </p>
    </div>
  );
}

function FixButton({ hex, onClick, children }: { hex: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-blue/50 bg-blue/10 px-3 text-xs font-semibold text-blue-bright transition-colors hover:bg-blue/20"
    >
      <span aria-hidden className="h-4 w-4 shrink-0 rounded-full border border-white/40" style={{ background: hex }} />
      {children}
    </button>
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
