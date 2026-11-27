"use client";

/**
 * v2.2 rc.6 (ORGMODE UI-A): the door of /career/new when the takeover is on.
 *
 * Two things the player enters, side by side (stacked on a phone), so they
 * are the two solids DESIGN.md allows, finished like a card: found a club on
 * the career's blue (the Home's career card leads here), take over an
 * organization on orange. Each has an art window cut into the solid (the
 * card's picture window): the crest builder's own crests in three stages for
 * the founded club, the real logos of the first season's leading
 * organizations of EU, NA and SAM for the takeover. Under it the title, one
 * sentence and the action as the solid's
 * inverse. The whole card is the hit area; the action is its label.
 */

import { lineups } from "@/data";
import { useCareerCopy } from "@/content/careerCopy";
import { seasonIdFor } from "@/engine/career/calendar";
import type { Region } from "@/engine/types";
import { cx } from "@/lib/util";
import { composeCrestId, CREST_WIZARD_KITS, UserCrest } from "@/components/career/UserCrest";
import { AppLink } from "@/components/ui/AppLink";
import { buttonClass } from "@/components/ui/Button";
import { SectionTitle } from "@/components/ui/Panel";
import { TeamLogo } from "@/components/ui/TeamLogo";

const ART_REGIONS: Region[] = ["EU", "NA", "SAM"];

/**
 * Two organizations each of EU, NA and SAM: of those in the first career
 * season (no spoiler past the career's horizon), the most storied (the most
 * lineups in the dataset). Their current logo: it reads on the dark window.
 */
let logoCache: string[] | null = null;
function leadingOrgs(): string[] {
  if (logoCache) return logoCache;
  const seasonId = seasonIdFor(0);
  const storied = new Map<string, number>();
  for (const l of lineups) storied.set(l.orgId, (storied.get(l.orgId) ?? 0) + 1);
  const out: string[] = [];
  for (const region of ART_REGIONS) {
    const orgs = [...new Set(lineups.filter((l) => l.seasonId === seasonId && l.region === region).map((l) => l.orgId))];
    orgs.sort((a, b) => (storied.get(b) ?? 0) - (storied.get(a) ?? 0) || a.localeCompare(b));
    out.push(...orgs.slice(0, 2));
  }
  logoCache = out;
  return out;
}

/** A crest being built: the bare shape, then its symbol, then the finished crest with its band and tag. */
const KIT = CREST_WIZARD_KITS.find((k) => k.id === "navy-gold") ?? CREST_WIZARD_KITS[0];
const KIT_COLORS = { primary: KIT.primary, secondary: KIT.secondary };
const CREST_STAGES = [
  composeCrestId({ shape: "shield", symbol: null }),
  composeCrestId({ shape: "shield", symbol: "wolf" }),
  composeCrestId({ shape: "shield", symbol: "wolf", pattern: "stripes", layout: "band" }),
];

function CrestArt() {
  return (
    <div className="flex items-center justify-center gap-5 max-sm:scale-[0.5] sm:gap-8" aria-hidden>
      <UserCrest crestId={CREST_STAGES[0]} colors={KIT_COLORS} size="lg" className="opacity-40" />
      <UserCrest crestId={CREST_STAGES[1]} colors={KIT_COLORS} size="lg" className="opacity-70" />
      <UserCrest crestId={CREST_STAGES[2]} colors={KIT_COLORS} abbrev="NEW" size="xl" />
    </div>
  );
}

function LogoArt() {
  return (
    // rc.6 (UI-C phone pass): one row on a phone; at 320 px the sixth logo wrapped and the window clipped both rows.
    <div className="flex flex-nowrap items-center justify-center gap-x-2 px-2 sm:flex-wrap sm:gap-x-4 sm:gap-y-2 sm:px-3 max-[359px]:[&>*:nth-child(n+6)]:hidden" aria-hidden>
      {leadingOrgs().map((orgId) => (
        <TeamLogo key={orgId} orgId={orgId} size="md" loading="eager" className="max-sm:!h-8 max-sm:!w-8 lg:!h-12 lg:!w-12" />
      ))}
    </div>
  );
}

type Tone = "blue" | "orange";

function DoorCard({
  tone,
  art,
  title,
  body,
  action,
  onEnter,
  disabled,
}: {
  tone: Tone;
  art: React.ReactNode;
  title: string;
  body: string;
  action: string;
  onEnter: () => void;
  disabled?: boolean;
}) {
  const onOrange = tone === "orange";
  return (
    <button
      type="button"
      onClick={onEnter}
      disabled={disabled}
      className={cx(
        "solid group flex h-full w-full flex-col p-3.5 text-left transition-transform duration-200 sm:p-6 lg:p-7",
        onOrange ? "solid-orange" : "solid-blue",
        !disabled && "hover:-translate-y-0.5",
        disabled && "opacity-60",
      )}
    >
      {/* The picture window: the card's own dark stock, cut into the solid. */}
      <span className="flex h-12 items-center justify-center overflow-hidden rounded-[10px] border border-black/25 bg-bg sm:h-40">{art}</span>

      <span className="block flex-1">
      <span className="display mt-3 block text-[1.6rem] font-bold uppercase leading-[1.05] sm:mt-6 sm:text-4xl">{title}</span>
      {/* rc9 ORG-UI (#271): the sentence carries the door at every width; the three "facts" rows restated it. */}
      <span className={cx("mt-2 block max-w-md text-sm leading-snug sm:text-[15px]", onOrange ? "font-semibold" : "font-medium")}>{body}</span>
      </span>

      <span
        className={cx(
          buttonClass("primary", "lg"),
          "mt-3.5 w-full sm:mt-7 sm:w-fit sm:px-8",
          onOrange ? "!bg-paper-ink !text-paper group-hover:!bg-[#1b2030]" : "!bg-paper !text-paper-ink group-hover:!bg-white",
        )}
      >
        {action}
      </span>
    </button>
  );
}

export function WayInDoor({ onPick, slotsFull }: { onPick: (door: "found" | "takeover") => void; slotsFull: boolean }) {
  const C = useCareerCopy();
  const D = C.takeover.door;
  return (
    <div className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
      <SectionTitle title={D.title} kicker={D.kicker} />
      {slotsFull ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-bad/40 px-4 py-3">
          <p className="text-sm text-ink">{D.slotsFull}</p>
          <AppLink href="/career/saves" className={buttonClass("secondary", "sm")}>
            {D.openSaves}
          </AppLink>
        </div>
      ) : null}
      <div className="mt-4 grid gap-3 sm:mt-6 sm:grid-cols-2 sm:gap-4 lg:gap-5">
        <DoorCard
          tone="blue"
          art={<CrestArt />}
          title={D.found.title}
          body={D.found.body}
          action={D.found.action}
          onEnter={() => onPick("found")}
          disabled={slotsFull}
        />
        <DoorCard
          tone="orange"
          art={<LogoArt />}
          title={D.takeover.title}
          body={D.takeover.body}
          action={D.takeover.action}
          onEnter={() => onPick("takeover")}
          disabled={slotsFull}
        />
      </div>
    </div>
  );
}
