"use client";

/**
 * v2.2 rc.6 (ORGMODE UI-C): an established org's Operations on Finances, in
 * place of the founded club's gear ladder. rc9 ORG-UI (#274): rebuilt on the
 * org catalogue (`orgOperationsOf`, R220), so an established save never reads
 * a founded item's name (Miguel: "não faz sentido eu ter 'equipamentos
 * profissionais' em uma org gigantesca").
 *
 * One board, three groups of rows. Facilities: one row per facility (two),
 * its level as the state, what the built levels give, and the next level on
 * the right: its price, what it adds, the board's sign-off. Departments: one
 * row per department, staffed or not, what it does, its weekly pay and the
 * action. The event camp: one row. Every action is the store's founded action
 * the catalogue maps onto (`orgFlow`: a facility's next level is its first
 * installation not owned), so prices, refusals and effects are the engine's.
 */

import { useState, type ReactNode } from "react";
import type { CareerCopy } from "@/content/careerCopy";
import { ORG_DEPARTMENT_ROLE, nextLevelGearOf, orgOperationsOf, type OrgDepartment, type OrgFacility } from "@/engine/career/orgCatalogue";
import type { CareerSave, StaffId } from "@/engine/career/types";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import { backerLineOf, bootcampRefusalOf, gearRefusalOf } from "@/store/careerFlow";
import { sponsorFreeBootcampsOf } from "@/engine/career/sponsorDeals";
import { dateOfDay } from "@/components/career/careerUi";
import { formatDateTiny } from "@/components/career/dateText";
import { boardRefusalText } from "@/components/career/hub/hubShared";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { AppLink } from "@/components/ui/AppLink";
import { campEffectOf, departmentEffectOf, facilityEffectNowOf, facilityNextEffectOf, orgItemNameOf } from "./operationsView";

const money = (n: number) => formatMoney(n, { compact: true });

function refusalText(C: CareerCopy, key: string): string {
  const r = C.toolbox.refusal;
  return boardRefusalText(C, key) ?? (key === "funds" ? C.orgmode.ops.cantAfford : key in r ? r[key as keyof typeof r] : r.other);
}

/**
 * A card (second pass, Miguel: "clean does not mean bare"): the name and its state, the level as
 * steps (facilities), what it does, the notes; at the foot the figure and the action.
 */
function Row({ name, state, steps, effect, notes, figure, figureNote, figureTone = "text-ink", action }: {
  name: string;
  state: ReactNode;
  steps?: { level: number; max: number } | null;
  effect?: string;
  notes?: ReactNode;
  figure?: string | null;
  figureNote?: string | null;
  figureTone?: string;
  action?: ReactNode;
}) {
  return (
    <li className="panel flex min-w-0 flex-col p-4">
      <h4 className="display flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[15px] font-bold leading-tight text-ink">
        <span className="min-w-0">{name}</span>
        {state}
      </h4>
      {steps ? (
        <span className="mt-3 flex gap-1" role="img" aria-label={`${steps.level} / ${steps.max}`}>
          {Array.from({ length: steps.max }).map((_, i) => (
            <span key={i} className={cx("h-1.5 flex-1 rounded-sm", i < steps.level ? "bg-blue-bright" : "bg-white/10")} />
          ))}
        </span>
      ) : null}
      {effect ? <p className="mt-2.5 text-sm leading-snug text-sub">{effect}</p> : null}
      {notes}
      {figure || action ? (
        <div className="mt-auto pt-4">
          <div className="flex items-end justify-between gap-3 border-t border-line pt-3">
            {figure ? (
              <span className="min-w-0">
                <span className={cx("display block text-xl font-bold leading-none tabular-nums", figureTone)}>{figure}</span>
                {figureNote ? <span className="mt-1 block text-xs text-faint">{figureNote}</span> : null}
              </span>
            ) : <span />}
            <span className="shrink-0 whitespace-nowrap">{action}</span>
          </div>
        </div>
      ) : null}
    </li>
  );
}

const Note = ({ children, tone = "text-faint" }: { children: ReactNode; tone?: string }) => <p className={cx("mt-1 text-xs leading-snug", tone)}>{children}</p>;

export function OperationsBoard({ save, C, primaryAllowed, className }: { save: CareerSave; C: CareerCopy; primaryAllowed: boolean; className?: string }) {
  const buyGear = useCareerStore((s) => s.buyGear);
  const setStaff = useCareerStore((s) => s.setStaff);
  const setPsychologist = useCareerStore((s) => s.setPsychologist);
  const runBootcamp = useCareerStore((s) => s.runBootcamp);
  const [release, setRelease] = useState<OrgDepartment | null>(null);

  const ops = orgOperationsOf(save, { floor: backerLineOf(save).floor });
  if (!ops) return null;
  const O = C.orgmode.ops;
  const G = C.orgmode.org;
  const ended = save.phase === "ended";
  const fin = save.finances;
  const confidence = Math.round(save.board?.confidence ?? 0);
  const freeLeft = Math.max(0, sponsorFreeBootcampsOf(save.sponsor) - fin.freeBootcampsUsedThisSeason);
  // One filled button on the screen: the cheapest facility level the board signs now.
  const buyable = ops.facilities.filter((f) => f.next?.state === "available" && !gearRefusalOf(save, nextLevelGearOf(fin.gear, f.id)!));
  const primaryId = primaryAllowed && !ended ? (buyable.sort((a, b) => a.next!.price - b.next!.price)[0]?.id ?? null) : null;

  const setDepartment = (d: OrgDepartment, on: boolean) => {
    const role = ORG_DEPARTMENT_ROLE[d.id];
    if (role === "psychologist") setPsychologist(on);
    else setStaff(role as StaffId, on);
  };

  const facilityRow = (f: OrgFacility) => {
    const name = orgItemNameOf(C, f.id);
    const gear = nextLevelGearOf(fin.gear, f.id);
    const next = f.next;
    const refusal = !next || !gear || ended ? null : gearRefusalOf(save, gear);
    const canBuy = Boolean(next && next.state === "available" && !refusal && !ended);
    const now = facilityEffectNowOf(C, f);
    const levelTag = f.level > 0 ? <Badge>{G.level(f.level, f.maxLevel)}</Badge> : <Badge tone="neutral">{G.notBuilt}</Badge>;
    return (
      <Row
        key={f.id}
        name={name}
        state={levelTag}
        steps={{ level: f.level, max: f.maxLevel }}
        effect={now || (C.orgmode.org.about[f.id] ?? "")}
        notes={
          <>
            {next ? <Note tone="text-sub">{G.nextLine(next.level, facilityNextEffectOf(C, f))}</Note> : <Note>{G.complete}</Note>}
            {next && next.state === "needsApproval" && next.confidence !== null ? <Note tone="text-orange-bright">{O.needs(next.confidence, confidence)}</Note> : null}
            {next && next.state === "frozen" ? <Note tone="text-orange-bright">{O.frozen}</Note> : null}
            {next && next.state === "cantAfford" ? <Note tone="text-sub">{O.cantAfford}</Note> : null}
            {next && next.state === "available" && refusal ? <Note tone="text-sub">{refusalText(C, refusal)}</Note> : null}
            {next && next.state === "available" && !refusal && next.confidence !== null ? <Note tone="text-good">{O.signs}</Note> : null}
          </>
        }
        figure={next ? money(next.price) : null}
        figureNote={next && next.upkeep > 0 ? O.addsUpkeep(money(next.upkeep)) : null}
        figureTone={canBuy ? "text-ink" : "text-faint"}
        action={
          next && !ended ? (
            <Button variant={primaryId === f.id ? "primary" : "secondary"} size="sm" disabled={!canBuy} onClick={() => gear && buyGear(gear)}>
              {O.buy}
            </Button>
          ) : null
        }
      />
    );
  };

  const departmentRow = (d: OrgDepartment) => (
    <Row
      key={d.id}
      name={orgItemNameOf(C, d.id)}
      state={d.staffed ? <Badge tone="good">{G.staffed}</Badge> : <Badge tone="neutral">{G.vacant}</Badge>}
      effect={departmentEffectOf(C, d.id)}
      notes={d.staffed ? <Note>{O.saves(money(d.perSplit))}</Note> : null}
      figure={money(d.weekly)}
      figureNote={O.weekly}
      figureTone={d.staffed ? "text-ink" : "text-sub"}
      action={
        ended ? null : d.staffed ? (
          <Button variant="ghost" size="sm" onClick={() => setRelease(d)}>{O.release}</Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setDepartment(d, true)}>{O.hire}</Button>
        )
      }
    />
  );

  const campRow = () => {
    const camp = ops.camp;
    if (!camp) return null;
    const refusal = ended ? "blocked" : bootcampRefusalOf(save);
    const free = freeLeft > 0;
    const until = fin.bootcampUntil;
    const state =
      camp.note === "active" ? <Badge tone="good">{O.campActive(until ? formatDateTiny(C.dates, dateOfDay(until.seasonIndex, until.day)) : "")}</Badge>
      : camp.note === "used" ? <Badge>{O.campUsed}</Badge>
      : null;
    return (
      <Row
        name={orgItemNameOf(C, camp.id)}
        state={state}
        effect={campEffectOf(C)}
        notes={
          <>
            {free ? <Note tone="text-sub">{C.finances.freeBootcampLeft(freeLeft)}</Note> : null}
            {refusal && refusal !== "used" && camp.note !== "active" ? <Note tone="text-sub">{refusalText(C, refusal)}</Note> : null}
          </>
        }
        figure={free ? C.common.free : money(camp.price)}
        figureTone={free ? "text-good" : refusal ? "text-faint" : "text-ink"}
        action={ended ? null : <Button variant="secondary" size="sm" disabled={Boolean(refusal)} onClick={runBootcamp}>{O.run}</Button>}
      />
    );
  };

  const group = (key: "facilities" | "staff" | "camps", rows: ReactNode) => (
    <div key={key} className="mt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h4 className="kicker">{O.dept[key]}</h4>
        <p className="text-xs text-faint">{O.deptNote[key]}</p>
      </div>
      <ol className="mt-2 grid gap-3 sm:grid-cols-2">{rows}</ol>
    </div>
  );

  // Second pass: the board is the section (title and running cost); facilities and departments are cards in it.
  return (
    <section id="career-operations" data-tour="finances-progress" aria-labelledby="career-operations-title" className={cx("min-w-0 scroll-mt-20", className)}>
      <div className="card-head border-b border-line pb-3">
        <h3 id="career-operations-title" className="card-title">{O.title}</h3>
        <p className="shrink-0 text-right">
          <span className="display block text-2xl font-bold leading-none tabular-nums text-ink">{O.perWeek(money(ops.runningWeekly))}</span>
          <span className="mt-1 block text-xs text-faint">{O.running}</span>
        </p>
      </div>

      {group("facilities", ops.facilities.map(facilityRow))}
      {group("staff", ops.departments.map(departmentRow))}
      {ops.camp ? group("camps", campRow()) : null}

      <Modal
        open={Boolean(release)}
        title={release ? O.releaseTitle(orgItemNameOf(C, release.id)) : ""}
        onClose={() => setRelease(null)}
        actions={
          <>
            <Button variant="ghost" className="min-h-11" onClick={() => setRelease(null)}>{O.keep}</Button>
            <Button
              variant="secondary"
              className="min-h-11"
              onClick={() => {
                if (release) setDepartment(release, false);
                setRelease(null);
              }}
            >
              {O.releaseConfirm}
            </Button>
          </>
        }
      >
        {release ? <p className="text-sm leading-snug text-sub">{O.releaseBody(money(release.perSplit), money(release.weekly))}</p> : null}
      </Modal>
    </section>
  );
}

/**
 * The Club page's Operations: what the org runs, one row per facility, the
 * departments staffed and the camp, each opening Finances at the board.
 */
export function OperationsSummary({ save, C, className }: { save: CareerSave; C: CareerCopy; className?: string }) {
  const ops = orgOperationsOf(save, { floor: backerLineOf(save).floor });
  if (!ops) return null;
  const O = C.orgmode.ops;
  const G = C.orgmode.org;
  const K = C.orgmode.club;
  const staffed = ops.departments.filter((d) => d.staffed);
  const until = save.finances.bootcampUntil;
  const camp = ops.camp;
  const rows: { key: string; name: string; line: string; tone?: string }[] = [
    ...ops.facilities.map((f) => ({ key: f.id, name: orgItemNameOf(C, f.id), line: f.level > 0 ? G.level(f.level, f.maxLevel) : G.notBuilt })),
    { key: "staff", name: O.dept.staff, line: staffed.length ? staffed.map((d) => orgItemNameOf(C, d.id)).join(", ") : O.staffNone },
    ...(camp
      ? [{
          key: "camp",
          name: orgItemNameOf(C, camp.id),
          line: camp.note === "active" ? O.campActive(until ? formatDateTiny(C.dates, dateOfDay(until.seasonIndex, until.day)) : "") : camp.note === "used" ? O.campUsed : O.campReady,
          tone: camp.note === "active" ? "text-good" : undefined,
        }]
      : []),
  ];
  return (
    <section aria-labelledby="club-ops-title" className={cx("panel min-w-0 overflow-hidden", className)}>
      <div className="card-head border-b border-line px-4 py-3 sm:px-5">
        <h3 id="club-ops-title" className="card-title">{K.opsTitle}</h3>
        <span className="text-xs text-sub">{O.perWeek(money(ops.runningWeekly))}</span>
      </div>
      <ul>
        {rows.map((r) => (
          <li key={r.key} className="border-b border-line last:border-b-0">
            <AppLink href="/career/finances#career-operations" className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-bright sm:px-5">
              <span className="min-w-0 flex-1">
                <span className="display block text-[15px] font-bold leading-tight text-ink">{r.name}</span>
                <span className={cx("mt-0.5 block truncate text-xs", r.tone ?? "text-sub")}>{r.line}</span>
              </span>
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-faint" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </AppLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
