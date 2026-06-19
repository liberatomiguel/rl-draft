"use client";

/**
 * /leaderboards (v1.4). Always shows the player's personal records (from the
 * local profile). When accounts are configured (Supabase env set), it also
 * handles email one-time-code sign-in, merges + syncs the profile to the cloud,
 * and shows the global boards. With no infra it degrades to records-only + a
 * "coming soon" note — useful today, lights up when accounts go live.
 */

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useCopy } from "@/content/copy";
import { cx } from "@/lib/util";
import { sfx } from "@/lib/sfx";
import { mergeProfiles, toDurable } from "@/lib/profileSync";
import {
  accountsEnabled,
  fetchCloudRow,
  fetchLeaderboard,
  getSession,
  leaderboardStats,
  onAuthChange,
  pushCloudProfile,
  sendEmailCode,
  signOut,
  updateUsername,
  verifyEmailCode,
  type LeaderboardCategory,
  type LeaderboardRow,
} from "@/lib/supabase";
import { useMounted } from "@/store/useMounted";
import { selectDailyStreak, useProfileStore } from "@/store/profileStore";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, SectionTitle } from "@/components/ui/Panel";

const CATEGORIES: LeaderboardCategory[] = [
  "best_normal",
  "best_hard",
  "best_legacy",
  "best_worldwide",
  "best_sam",
  "best_easy",
  "championships",
  "challenges_cleared",
  "daily_streak",
  "xp",
];

const emailPrefix = (s: Session) => s.user.email?.split("@")[0] ?? "Player";

export function LeaderboardsView() {
  const mounted = useMounted();
  const { LEADERBOARDS_UI: L } = useCopy();
  const records = useProfileStore((s) => s.records);
  const wins = useProfileStore((s) => s.wins);
  const xp = useProfileStore((s) => s.xp);
  const challengesCompleted = useProfileStore((s) => s.challengesCompleted);
  const dailyStreak = useProfileStore(selectDailyStreak);
  const hydrateDurable = useProfileStore((s) => s.hydrateDurable);

  const personal: Record<string, number> = {
    best_easy: records.bestOverall.easy,
    best_normal: records.bestOverall.normal,
    best_hard: records.bestOverall.hard,
    best_legacy: records.bestOverall.legacy,
    best_worldwide: records.bestOverallWorldwide,
    best_sam: records.bestOverallSam,
    championships: wins.easy + wins.normal + wins.hard + wins.legacy,
    challenges_cleared: Object.keys(challengesCompleted).length,
    daily_streak: dailyStreak,
    xp,
  };

  // --- accounts (no-op when disabled) ------------------------------------
  const [session, setSession] = useState<Session | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [name, setName] = useState("");

  const sync = useCallback(
    async (s: Session) => {
      setSyncing(true);
      try {
        const local = toDurable(useProfileStore.getState());
        const row = await fetchCloudRow(s.user.id);
        const merged = row?.durable ? mergeProfiles(local, row.durable) : local;
        if (row?.durable) hydrateDurable(merged); // never loses local progress
        const displayName = row?.username || emailPrefix(s);
        setName(displayName);
        const streak = selectDailyStreak(useProfileStore.getState());
        await pushCloudProfile(s.user.id, displayName, merged, leaderboardStats(merged, streak));
      } finally {
        setSyncing(false);
      }
    },
    [hydrateDurable],
  );

  useEffect(() => {
    if (!accountsEnabled) return;
    getSession().then((s) => {
      setSession(s);
      if (s) sync(s);
    });
    return onAuthChange((s) => {
      setSession(s);
      if (s) sync(s);
    });
  }, [sync]);

  return (
    <div className="rise-in mx-auto max-w-3xl">
      <SectionTitle kicker={L.yourRecords} title={L.title} className="mb-2" />
      <p className="mb-6 max-w-2xl text-sm leading-relaxed text-sub">{L.subtitle}</p>

      {/* Personal records — always available */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {CATEGORIES.map((cat) => (
          <Panel key={cat} className="flex items-center justify-between gap-3 p-3.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-sub">
              {L.categories[cat]}
            </span>
            <span className="display text-xl font-bold text-ink">
              {mounted && personal[cat] > 0 ? personal[cat] : L.none}
            </span>
          </Panel>
        ))}
      </div>

      {/* Accounts */}
      <div className="mt-8">
        {!accountsEnabled ? (
          <Panel className="p-4 text-sm leading-relaxed text-sub">
            <p>{L.guestNote}</p>
            <p className="mt-2 text-xs text-faint">{L.comingSoon}</p>
          </Panel>
        ) : !session ? (
          <SignInPanel L={L} />
        ) : (
          <GlobalBoards
            L={L}
            session={session}
            name={name}
            setName={setName}
            syncing={syncing}
            onSignOut={async () => {
              await signOut();
              setSession(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

function SignInPanel({ L }: { L: ReturnType<typeof useCopy>["LEADERBOARDS_UI"] }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!email) return;
    setBusy(true);
    setError(null);
    sfx.click();
    const { error } = await sendEmailCode(email.trim());
    setBusy(false);
    if (error) setError(L.authError);
    else setStep("code");
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    const { error } = await verifyEmailCode(email.trim(), code.trim());
    setBusy(false);
    // Success flips the session via onAuthChange in the parent; only surface errors.
    if (error) setError(L.authError);
  };

  return (
    <Panel className="p-5">
      <h3 className="display mb-1 text-base font-bold uppercase tracking-wide text-ink">{L.signInTitle}</h3>
      <p className="mb-4 text-sm leading-relaxed text-sub">{L.guestNote}</p>

      {step === "email" ? (
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={L.emailPlaceholder}
            className="flex-1 rounded-lg border border-line bg-bg/60 px-3 py-2 text-sm text-ink outline-none focus:border-orange/60"
          />
          <Button variant="primary" onClick={send} disabled={busy || !email}>
            {busy ? L.sending : L.sendCode}
          </Button>
        </div>
      ) : (
        <div>
          <p className="mb-2.5 text-xs text-sub">{L.codeSentTo(email)}</p>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && verify()}
              placeholder={L.codePlaceholder}
              className="flex-1 rounded-lg border border-line bg-bg/60 px-3 py-2 text-sm tracking-[0.3em] text-ink outline-none focus:border-orange/60"
            />
            <Button variant="primary" onClick={verify} disabled={busy || code.length < 6}>
              {busy ? L.verifying : L.verify}
            </Button>
          </div>
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
            className="mt-2.5 text-xs text-faint underline-offset-2 hover:text-sub hover:underline"
          >
            {L.useAnotherEmail}
          </button>
        </div>
      )}

      {error ? <p className="mt-3 text-xs font-semibold text-bad">{error}</p> : null}
    </Panel>
  );
}

function GlobalBoards({
  L,
  session,
  name,
  setName,
  syncing,
  onSignOut,
}: {
  L: ReturnType<typeof useCopy>["LEADERBOARDS_UI"];
  session: Session;
  name: string;
  setName: (n: string) => void;
  syncing: boolean;
  onSignOut: () => void;
}) {
  const [cat, setCat] = useState<LeaderboardCategory>("best_hard");
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  // `edited` overrides the synced `name` only while the player is typing; it
  // resets to null on save, so the input follows `name` again (no effect needed).
  const [edited, setEdited] = useState<string | null>(null);
  const draftName = edited ?? name;
  const [savedName, setSavedName] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchLeaderboard(cat).then((r) => alive && setRows(r));
    return () => {
      alive = false;
    };
  }, [cat]);

  const saveName = async () => {
    const next = draftName.trim().slice(0, 24) || name;
    await updateUsername(session.user.id, next);
    setName(next);
    setEdited(null);
    setSavedName(true);
    setTimeout(() => setSavedName(false), 1500);
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-sub">
          {L.signedInAs(name)}
          {syncing ? ` · ${L.syncing}` : ""}
        </span>
        <Button variant="ghost" onClick={onSignOut}>
          {L.signOut}
        </Button>
      </div>

      {/* Display name editor */}
      <Panel className="mb-5 p-4">
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-sub">
          {L.displayNameLabel}
        </label>
        <div className="flex gap-2.5">
          <input
            value={draftName}
            onChange={(e) => setEdited(e.target.value)}
            maxLength={24}
            className="flex-1 rounded-lg border border-line bg-bg/60 px-3 py-2 text-sm text-ink outline-none focus:border-orange/60"
          />
          <Button variant="secondary" onClick={saveName} disabled={!draftName.trim() || draftName === name}>
            {savedName ? L.saved : L.save}
          </Button>
        </div>
      </Panel>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {(["best_hard", "best_legacy", "best_worldwide", "best_sam", "championships", "xp"] as LeaderboardCategory[]).map(
          (c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={cx(
                "display rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors",
                cat === c ? "bg-orange/15 text-orange-bright" : "text-sub hover:text-ink",
              )}
            >
              {L.categories[c]}
            </button>
          ),
        )}
      </div>

      <Panel className="divide-y divide-line/60">
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-faint">{L.empty}</p>
        ) : (
          rows.map((r, i) => {
            const isYou = r.username === name;
            return (
              <div key={i} className={cx("flex items-center gap-3 px-4 py-2.5", isYou && "bg-orange/5")}>
                <span className="display w-6 text-sm font-bold text-faint">{i + 1}</span>
                <span className="flex-1 truncate text-sm text-ink">
                  {r.username}
                  {isYou ? <Badge tone="orange"> {L.you}</Badge> : null}
                </span>
                <span className="display text-sm font-bold text-orange-bright">{r.value}</span>
              </div>
            );
          })
        )}
      </Panel>
    </>
  );
}
