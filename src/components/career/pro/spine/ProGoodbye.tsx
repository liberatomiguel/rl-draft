"use client";

/**
 * v2.2 PROQA polish: the end of the career as a screen. The career line, the
 * peak, the orgs, titles and awards, the nickname with what earned it, then the
 * card. Read only from the save and the card it builds.
 */

import { useCareerCopy } from "@/content/careerCopy";
import { parseAwardKey } from "@/engine/career/pro/card";
import { nicknameProgress, type NicknameId } from "@/engine/career/pro/nickname";
import type { ProSave } from "@/engine/career/pro/types";
import { AppLink } from "@/components/ui/AppLink";
import { buttonClass } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { proCardHrefOf, proCardOf } from "@/store/proFlow";

export function ProGoodbye({ save }: { save: ProSave }) {
  const C = useCareerCopy();
  const P = C.proWorld.retire;
  const T = C.proCard;
  const card = proCardOf(save);
  const first = save.history[0];
  const last = save.history[save.history.length - 1];
  const series = save.history.reduce((n, h) => n + h.series, 0);
  const won = save.history.reduce((n, h) => n + h.seriesWon, 0);
  const awards = card.awards.map((line) => {
    const k = parseAwardKey(line);
    return k ? T.gala.line(T.gala.scopes[k.scope] ?? k.scope, T.gala.kinds[k.kind] ?? k.kind, k.year) : line;
  });
  const nickId = card.nickname as NicknameId | null;
  const nickName = nickId ? (T.nicknames[nickId] ?? nickId) : null;
  const why = nickId ? T.nicknameWhy[nickId]?.(nicknameProgress(nickId, save.careerFacts ?? {}).have) : null;
  const row = (label: string, items: string[]) => (
    <div>
      <p className="kicker mb-1">{label}</p>
      <p className="text-sm leading-snug text-ink">{items.length > 0 ? items.join(" · ") : P.none}</p>
    </div>
  );
  return (
    <Panel className="space-y-4 p-5">
      <div>
        <h3 className="display text-lg font-bold uppercase leading-none text-ink">{P.goodbyeTitle(card.name)}</h3>
        {first && last ? <p className="mt-2 text-sm leading-snug text-sub">{P.careerLine(first.age, last.age, save.history.length, series, won)}</p> : null}
      </div>
      <div className="bg-paper px-4 py-3 text-paper-ink">
        <span className="display block text-5xl font-bold leading-none">{card.peak.toFixed(1)}</span>
        <span className="display mt-1 block text-xs font-semibold uppercase">{P.peak(card.peak.toFixed(1))}</span>
      </div>
      {row(P.orgs, card.orgs)}
      {row(P.titles, card.titles)}
      {row(P.awards, awards)}
      {nickName && why ? <p className="text-sm text-ink">{P.nickname(nickName, why)}</p> : null}
      <AppLink href={proCardHrefOf(save)} className={buttonClass("primary", "lg")}>
        {P.card}
      </AppLink>
    </Panel>
  );
}
