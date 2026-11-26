"use client";

/**
 * v2.2 Pro (PRO-SPEC §9, R150): the final card page. The payload lives in the
 * URL hash (`#<base64url>`), so the export stays static and nothing is stored.
 * It reads the hash in the browser, rebuilds the card, loads the real players'
 * best cards on demand to place him in the all-time ranking, and draws the
 * image on a canvas for "download" and the Web Share sheet.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useCareerCopy } from "@/content/careerCopy";
import { allTimeRanking, decodeCard, parseAwardKey, legendNeighbours, type LegendNeighbours, type ProCard } from "@/engine/career/pro/card";
import { AppLink } from "@/components/ui/AppLink";
import { Button, buttonClass } from "@/components/ui/Button";
import { CountryChip } from "@/components/ui/Badge";
import { Panel } from "@/components/ui/Panel";

function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}
const noSubscribe = () => () => {};
const hashNow = () => window.location.hash;
const hashServer = () => "";

/** The dataset's best cards, loaded when the page opens (never on the shared path). */
async function loadRanking() {
  const [cards, players] = await Promise.all([import("@/data/playerCards.json"), import("@/data/players.json")]);
  const names = new Map((players.default as { id: string; nickname: string }[]).map((p) => [p.id, p.nickname]));
  return allTimeRanking(cards.default as { playerId: string; overall: number }[], names);
}

const W = 1080;
const H = 1350;

interface Lines {
  legends: string;
  place: string | null;
}

/** The image: the card, drawn the way the page shows it. Pure canvas, no remote assets. */
function drawCard(
  canvas: HTMLCanvasElement,
  card: ProCard,
  t: { kicker: string; peak: string; seasons: string; orgs: string; titles: string; awards: string; bestRating: string; none: string; nickname: string; style: string },
  lines: Lines,
  fonts: { display: string; text: string },
) {
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d");
  if (!g) return;
  const ink = "#e9eef8";
  const sub = "#8d9ab3";
  const orange = "#ff6a1a";
  g.fillStyle = "#070a11";
  g.fillRect(0, 0, W, H);
  g.fillStyle = "#0d1322";
  g.strokeStyle = "rgba(141,154,179,0.26)";
  g.lineWidth = 2;
  g.beginPath();
  g.roundRect(48, 48, W - 96, H - 96, 28);
  g.fill();
  g.stroke();

  let y = 120;
  g.textBaseline = "alphabetic";
  g.fillStyle = orange;
  g.font = `700 30px ${fonts.display}`;
  g.fillText(t.kicker.toUpperCase(), 96, y);
  y += 90;
  g.fillStyle = ink;
  g.font = `700 92px ${fonts.display}`;
  g.fillText(card.name.toUpperCase(), 96, y);
  y += 52;
  g.fillStyle = sub;
  g.font = `400 34px ${fonts.text}`;
  g.fillText([t.style, card.country, t.seasons].filter(Boolean).join("  ·  "), 96, y);
  if (card.nickname) {
    y += 46;
    g.fillStyle = ink;
    g.fillText(`${t.nickname}: ${card.nickname}`, 96, y);
  }

  // The one figure that matters: the peak overall on the paper slab.
  y += 52;
  g.fillStyle = "#f3efe6";
  g.fillRect(96, y, W - 192, 160);
  g.fillStyle = "#0a0e17";
  g.font = `700 150px ${fonts.display}`;
  g.fillText(card.peak.toFixed(1), 128, y + 126);
  g.font = `600 30px ${fonts.display}`;
  g.fillText(t.peak.toUpperCase(), W - 128 - g.measureText(t.peak.toUpperCase()).width, y + 60);
  y += 160 + 60;

  const block = (label: string, items: string[], maxRows = 3) => {
    g.fillStyle = sub;
    g.font = `600 26px ${fonts.display}`;
    g.fillText(label.toUpperCase(), 96, y);
    y += 36;
    g.fillStyle = ink;
    g.font = `400 30px ${fonts.text}`;
    const text = items.length > 0 ? items.join("  ·  ") : t.none;
    const rows = wrap(g, text, W - 192);
    const shown = rows.slice(0, maxRows);
    // A list that does not fit says so instead of ending mid-row.
    if (rows.length > maxRows) shown[maxRows - 1] = `${shown[maxRows - 1].replace(/[\s·]+$/, "")} …`;
    for (const row of shown) {
      g.fillText(row, 96, y);
      y += 38;
    }
    y += 16;
  };
  block(t.orgs, card.orgs, 2);
  block(t.titles, card.titles);
  block(t.awards, card.awards);
  block(t.bestRating, card.bestRating > 0 ? [card.bestRating.toFixed(1)] : [], 1);

  // The comparison sits above the footer at a fixed place, so a long card never runs into it.
  g.fillStyle = sub;
  g.font = `400 28px ${fonts.text}`;
  const legendRows = wrap(g, lines.legends, W - 192).slice(0, 3);
  let ly = H - 96 - 56 - legendRows.length * 34;
  for (const row of legendRows) {
    g.fillText(row, 96, ly);
    ly += 34;
  }
  g.fillStyle = orange;
  g.font = `700 30px ${fonts.display}`;
  g.fillText("ROCKETDRAFT.APP", 96, H - 96);
}

function wrap(g: CanvasRenderingContext2D, text: string, max: number): string[] {
  const rows: string[] = [];
  let row = "";
  for (const word of text.split(" ")) {
    const next = row ? `${row} ${word}` : word;
    if (row && g.measureText(next).width > max) {
      rows.push(row);
      row = word;
    } else row = next;
  }
  if (row) rows.push(row);
  return rows;
}

export function ProCardScreen() {
  const C = useCareerCopy();
  const T = C.proCard;
  const hash = useSyncExternalStore(subscribeHash, hashNow, hashServer);
  const decoded = useMemo(() => (hash.length > 1 ? decodeCard(hash) : null), [hash]);
  // The payload carries language-free keys (a nickname id, "mvp.world.2026"); the page speaks them.
  const card = useMemo<ProCard | null>(() => {
    if (!decoded) return null;
    const awards = decoded.awards.map((line) => {
      const k = parseAwardKey(line);
      return k ? T.gala.line(T.gala.scopes[k.scope] ?? k.scope, T.gala.kinds[k.kind] ?? k.kind, k.year) : line;
    });
    const nickname = decoded.nickname ? (T.nicknames[decoded.nickname] ?? decoded.nickname) : null;
    return { ...decoded, awards, nickname };
  }, [decoded, T]);
  const [near, setNear] = useState<LegendNeighbours | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Known only in the browser, so it is read after mount (the server render has no share sheet).
  const canShare = useSyncExternalStore(noSubscribe, () => typeof navigator.share === "function", () => false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!card) return;
    let live = true;
    loadRanking()
      .then((rank) => {
        if (live) setNear(legendNeighbours(card.peak, rank));
      })
      .catch(() => {
        if (live) setNear(null);
      });
    return () => {
      live = false;
    };
  }, [card]);

  const legends = useMemo<Lines>(() => {
    if (!card || !near) return { legends: T.legends.loading, place: null };
    const peak = card.peak.toFixed(1);
    const a = near.above[0]?.name;
    const b = near.below[0]?.name;
    const text = a && b ? T.legends.between(peak, a, b) : b ? T.legends.above(peak, b) : a ? T.legends.below(peak, a) : "";
    return { legends: text, place: T.legends.place(near.place, near.of + 1) };
  }, [card, near, T]);

  const makeImage = useCallback((): HTMLCanvasElement | null => {
    if (!card) return null;
    const canvas = document.createElement("canvas");
    const display = titleRef.current ? getComputedStyle(titleRef.current).fontFamily : "sans-serif";
    const text = bodyRef.current ? getComputedStyle(bodyRef.current).fontFamily : "sans-serif";
    drawCard(
      canvas,
      card,
      {
        kicker: T.kicker,
        peak: T.peak,
        seasons: T.seasons(card.seasons),
        orgs: T.orgs,
        titles: T.titles,
        awards: T.awards,
        bestRating: T.bestRating,
        none: T.none,
        nickname: T.nickname,
        style: C.player.archetype[card.style],
      },
      legends,
      { display, text },
    );
    return canvas;
  }, [card, T, C.player.archetype, legends]);

  const toBlob = (canvas: HTMLCanvasElement) => new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));

  const download = async () => {
    const canvas = makeImage();
    const blob = canvas ? await toBlob(canvas) : null;
    if (!blob || !card) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rocket-draft-pro-${card.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "card"}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const share = async () => {
    if (!card) return;
    const data: ShareData = { title: T.shareText(card.name), text: T.shareText(card.name), url: window.location.href };
    try {
      const canvas = makeImage();
      const blob = canvas ? await toBlob(canvas) : null;
      const file = blob ? new File([blob], "rocket-draft-pro.png", { type: "image/png" }) : null;
      if (file && navigator.canShare?.({ files: [file] })) data.files = [file];
      await navigator.share(data);
    } catch {
      // A dismissed share sheet is not an error.
    }
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setNotice(T.copied);
    } catch {
      setNotice(null);
    }
  };

  if (!card) {
    return (
      <div className="rise-in mx-auto max-w-2xl px-3 py-8 sm:px-4">
        <h1 className="display text-3xl font-bold uppercase leading-none text-ink">{T.invalidTitle}</h1>
        <p className="mt-3 text-sm leading-snug text-sub">{T.invalidBody}</p>
        <AppLink href="/career/pro" className={`${buttonClass("primary", "md")} mt-5`}>
          {T.start}
        </AppLink>
      </div>
    );
  }

  const row = (label: string, items: string[]) => (
    <div>
      <p className="kicker mb-1">{label}</p>
      <p className="text-sm leading-snug text-ink">{items.length > 0 ? items.join(" · ") : T.none}</p>
    </div>
  );

  return (
    <div ref={bodyRef} className="rise-in mx-auto max-w-2xl px-3 py-4 sm:px-4 sm:py-6">
      <Panel className="p-5 sm:p-6">
        <p className="kicker">{T.kicker}</p>
        <h1 ref={titleRef} className="display mt-2 text-4xl font-bold uppercase leading-none text-ink sm:text-5xl">
          {card.name}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-sub">
          {card.country ? <CountryChip code={card.country} /> : null}
          <span>{C.player.archetype[card.style]}</span>
          <span>·</span>
          <span>{T.seasons(card.seasons)}</span>
        </div>
        {card.nickname ? (
          <p className="mt-2 text-sm text-ink">
            {T.nickname}: {card.nickname}
          </p>
        ) : null}

        <div className="mt-5 flex items-end justify-between gap-4 bg-paper px-4 py-3 text-paper-ink">
          <span className="display text-6xl font-bold leading-none">{card.peak.toFixed(1)}</span>
          <span className="display text-sm font-semibold uppercase">{T.peak}</span>
        </div>

        <div className="mt-5 grid gap-4">
          {row(T.orgs, card.orgs)}
          {row(T.titles, card.titles)}
          {row(T.awards, card.awards)}
          {row(T.bestRating, card.bestRating > 0 ? [card.bestRating.toFixed(1)] : [])}
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <p className="kicker mb-1">{T.legends.title}</p>
          <p className="text-sm leading-snug text-sub">{legends.legends}</p>
          {legends.place ? <p className="mt-1 text-xs text-faint">{legends.place}</p> : null}
        </div>
      </Panel>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" onClick={download}>
          {T.download}
        </Button>
        {canShare ? (
          <Button variant="secondary" onClick={share}>
            {T.share}
          </Button>
        ) : null}
        <Button variant="secondary" onClick={copyLink}>
          {T.copyLink}
        </Button>
      </div>
      <p className="mt-2 min-h-5 text-xs text-sub" role="status">
        {notice}
      </p>
      <AppLink href="/career/pro" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-blue-bright hover:underline">
        {T.start}
      </AppLink>
    </div>
  );
}
