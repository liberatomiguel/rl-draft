"use client";

/** v2.2 Pro spine (PROSPINE): his inbox and the scene around him (the world's own results and moves). */

import { useCareerCopy } from "@/content/careerCopy";
import { weekOfDay } from "@/engine/career/calendar";
import type { ProSave } from "@/engine/career/pro/types";
import { hostOf } from "@/store/proFlow";

export function ProInbox({ save }: { save: ProSave }) {
  const C = useCareerCopy();
  const I = C.proWorld.inbox;
  const N = C.proWorld.news;
  const G = C.proCard.gala;
  const textOf = (key: string, p: Record<string, string | number>): string => {
    if (key === "galaWon" || key === "galaNominee") {
      const award = G.line(G.scopes[String(p.scope)] ?? String(p.scope), G.kinds[String(p.kind)] ?? String(p.kind), Number(p.year));
      return key === "galaWon" ? G.winner(award) : G.nominee(award);
    }
    if (key === "nicknameEarned") return N.nicknameEarned({ name: C.proCard.nicknames[String(p.id)] ?? String(p.id) });
    return N[key]?.(p) ?? key;
  };
  const host = hostOf(save);
  const season = save.clock.seasonIndex;
  const region = save.player.region;
  const titles = (host?.eventResults ?? [])
    .filter((r) => r.seasonIndex === season && (r.tier === "major" || r.tier === "worlds" || (r.tier === "regional" && r.region === region)))
    .slice(-5)
    .reverse()
    .map((r) => ({ id: r.eventId, line: I.champion(r.rows.find((x) => x.ref === r.championRef)?.name ?? r.championRef, r.name) }));
  const moves = (host?.transferLog ?? [])
    .filter((t) => t.region === region && t.toRef && t.toRef !== "user")
    .slice(-6)
    .reverse()
    .map((t) => ({ id: t.id, line: I.transfer(t.playerName, save.world.orgs[t.toRef!]?.name ?? t.toRef!) }));

  return (
    <div className="space-y-6">
      <div>
        <p className="kicker mb-2">{I.title}</p>
        {save.news.length === 0 ? <p className="text-sm text-sub">{I.none}</p> : null}
        <ul className="divide-y divide-line border-y border-line">
          {save.news.slice(0, 30).map((n) => (
            <li key={n.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
              <span className={n.read ? "text-sub" : "text-ink"}>{textOf(n.key, n.params)}</span>
              <span className="shrink-0 text-xs text-faint">
                {n.seasonIndex + 1}.{weekOfDay(n.day)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="kicker mb-2">{I.scene}</p>
        {titles.length + moves.length === 0 ? <p className="text-sm text-sub">{I.sceneNone}</p> : null}
        <ul className="space-y-1.5 text-sm text-sub">
          {[...titles, ...moves].map((x) => (
            <li key={x.id}>{x.line}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
