"use client";

/**
 * RLCS-style field visualization of the drafted team.
 * Three player slots on the pitch, coach/sub on the bench strip, org banner.
 * In the draft it doubles as the placement target: when a card is selected,
 * compatible empty slots glow and become clickable.
 */

import { DRAFT_UI } from "@/content/copy";
import { resolvePick, type ResolvedCard } from "@/engine/cards";
import type { CardKind, Roster, RosterSlotId } from "@/engine/types";
import { cx } from "@/lib/util";
import { TeamLogo } from "@/components/ui/TeamLogo";

interface FieldViewProps {
  roster: Roster;
  showOverall: boolean;
  /** Kind of the currently selected draft card (null = nothing selected). */
  highlightKind?: CardKind | null;
  onSlotClick?: (slot: RosterSlotId) => void;
  /** Quick mode has no coach/sub/org bench. */
  showBench?: boolean;
  className?: string;
}

const PLAYER_POSITIONS: { slot: RosterSlotId; label: string; style: React.CSSProperties }[] = [
  { slot: "player1", label: "P1", style: { left: "50%", top: "26%" } },
  { slot: "player2", label: "P2", style: { left: "26%", top: "62%" } },
  { slot: "player3", label: "P3", style: { left: "74%", top: "62%" } },
];

function resolved(roster: Roster, slot: RosterSlotId): ResolvedCard | null {
  const pick = roster[slot];
  return pick ? resolvePick(pick) : null;
}

interface FieldFx {
  cls: string;
  style?: React.CSSProperties;
}

/**
 * Rarity FX for a drafted card sitting on the field (v0.6.1).
 * - SPECIAL cards get a LIVING rarity glow (animated `field-fx`, color via
 *   `--fx-color`) on EVERY run — including Hard/hidden, because a special's
 *   presence is public information (only its identity is masked). The glow
 *   is the effect, not just a border line.
 * - BASE cards get their gold/silver/blue border only when overalls are shown
 *   (base rarity is secret on hidden runs).
 */
function fieldFx(card: ResolvedCard | null): FieldFx {
  if (!card) return { cls: "" };
  if (card.special) {
    const fx = (border: string, color: string): FieldFx => ({
      cls: `field-fx ${border}`,
      style: { ["--fx-color"]: color } as React.CSSProperties,
    });
    switch (card.special.rarity) {
      case "legendary":
        return fx("!border-amber-100/80", "rgba(255, 240, 195, 0.62)");
      case "mythic":
        return fx("!border-red-400/80", "rgba(239, 68, 68, 0.55)");
      case "epic":
        return fx("!border-orange-400/80", "rgba(249, 115, 22, 0.5)");
      case "rare":
        return fx("!border-indigo-400/75", "rgba(99, 102, 241, 0.45)");
    }
  }
  return { cls: "" };
}

/** Base-card border accent — only meaningful when overalls are visible. */
function baseAccent(card: ResolvedCard | null, showOverall: boolean): string {
  if (!card || !showOverall || card.special) return "";
  switch (card.baseRarity) {
    case "blue":
      return "!border-cyan-400/60 shadow-[0_0_10px_rgba(56,189,248,0.2)]";
    case "gold":
      return "!border-amber-300/60";
    case "silver":
      return "!border-slate-300/50";
    default:
      return "";
  }
}

export function FieldView({
  roster,
  showOverall,
  highlightKind = null,
  onSlotClick,
  showBench = true,
  className,
}: FieldViewProps) {
  const slotKind = (slot: RosterSlotId): CardKind =>
    slot === "coach" ? "coach" : slot === "sub" ? "sub" : slot === "org" ? "org" : "player";

  const isTarget = (slot: RosterSlotId) =>
    Boolean(highlightKind && !roster[slot] && slotKind(slot) === highlightKind && onSlotClick);

  return (
    <div className={className}>
      {/* Pitch */}
      <div className="field aspect-[16/10] w-full">
        {PLAYER_POSITIONS.map(({ slot, label, style }) => (
          <FieldSlot
            key={slot}
            style={style}
            label={`${label}`}
            card={resolved(roster, slot)}
            showOverall={showOverall}
            target={isTarget(slot)}
            onClick={isTarget(slot) ? () => onSlotClick!(slot) : undefined}
          />
        ))}
      </div>

      {/* Bench strip: coach · sub · org */}
      <div className={cx("mt-2 grid grid-cols-3 gap-2", !showBench && "hidden")}>
        <BenchSlot
          label={DRAFT_UI.slotCoach}
          card={resolved(roster, "coach")}
          showOverall={showOverall}
          target={isTarget("coach")}
          onClick={isTarget("coach") ? () => onSlotClick!("coach") : undefined}
        />
        <BenchSlot
          label={DRAFT_UI.slotSub}
          card={resolved(roster, "sub")}
          showOverall={showOverall}
          target={isTarget("sub")}
          onClick={isTarget("sub") ? () => onSlotClick!("sub") : undefined}
        />
        <BenchSlot
          label={DRAFT_UI.slotOrg}
          card={resolved(roster, "org")}
          showOverall={showOverall}
          target={isTarget("org")}
          onClick={isTarget("org") ? () => onSlotClick!("org") : undefined}
        />
      </div>
    </div>
  );
}

function FieldSlot({
  style,
  label,
  card,
  showOverall,
  target,
  onClick,
}: {
  style: React.CSSProperties;
  label: string;
  card: ResolvedCard | null;
  showOverall: boolean;
  target: boolean;
  onClick?: () => void;
}) {
  const inner = card ? (
    <span className="flex w-[76px] flex-col items-center gap-0.5 md:w-[84px]">
      {card.orgId ? <TeamLogo orgId={card.orgId} seasonId={card.seasonId} size="sm" /> : null}
      <span className="display w-full truncate text-center text-[10px] font-bold uppercase tracking-wide text-ink">
        {card.name}
        {card.special ? <span className="text-orange-bright">★</span> : null}
      </span>
      <span className="display text-[11px] font-bold leading-none text-cyan">
        {showOverall ? card.overall : "??"}
      </span>
    </span>
  ) : (
    <span className="flex h-12 w-12 items-center justify-center md:h-14 md:w-14">
      <span className="display text-xs font-bold text-faint">{label}</span>
    </span>
  );

  const fx = target ? { cls: "", style: undefined } : fieldFx(card);
  const base = cx(
    "absolute -translate-x-1/2 -translate-y-1/2 rounded-xl border px-1.5 py-1.5 backdrop-blur-sm transition-all",
    card
      ? "border-line-strong bg-raised/85"
      : "border-dashed border-line bg-black/20",
    !target && baseAccent(card, showOverall),
    !target && fx.cls,
    target && "field-slot-glow cursor-pointer !border-orange bg-orange/10",
  );
  const mergedStyle = { ...style, ...fx.style };

  return onClick ? (
    <button type="button" onClick={onClick} style={mergedStyle} className={base} aria-label={`Place in ${label}`}>
      {inner}
    </button>
  ) : (
    <div style={mergedStyle} className={base}>
      {inner}
    </div>
  );
}

function BenchSlot({
  label,
  card,
  showOverall,
  target,
  onClick,
}: {
  label: string;
  card: ResolvedCard | null;
  showOverall: boolean;
  target: boolean;
  onClick?: () => void;
}) {
  const isOrg = card?.kind === "org";
  const inner = (
    <>
      <span className="kicker !text-[8px]">{label}</span>
      {card ? (
        <span className="flex w-full items-center justify-center gap-1.5">
          {card.orgId ? <TeamLogo orgId={card.orgId} seasonId={card.seasonId} size="xs" /> : null}
          <span className="display min-w-0 truncate text-[11px] font-bold uppercase tracking-wide text-ink">
            {card.name}
          </span>
          <span className="display shrink-0 text-[11px] font-bold text-cyan">
            {isOrg ? (showOverall ? card.buffLevel : "??") : showOverall ? card.overall : "??"}
          </span>
        </span>
      ) : (
        <span className="text-[10px] italic text-faint">{DRAFT_UI.empty}</span>
      )}
    </>
  );

  const fx = target ? { cls: "", style: undefined } : fieldFx(card);
  const base = cx(
    "flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-lg border px-2 py-1.5 transition-all",
    card ? "border-line-strong bg-white/4" : "border-dashed border-line",
    !target && baseAccent(card, showOverall),
    !target && fx.cls,
    target && "field-slot-glow cursor-pointer !border-orange bg-orange/10",
  );

  return onClick ? (
    <button type="button" onClick={onClick} style={fx.style} className={base} aria-label={`Place in ${label}`}>
      {inner}
    </button>
  ) : (
    <div style={fx.style} className={base}>{inner}</div>
  );
}
