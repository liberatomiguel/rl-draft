"use client";

/**
 * Share kit (v2.2): the Home's "With friends" section, a pair of boards.
 * The friend duel starts from the Home in one click (a Classic draft on the
 * player's last difficulty and overall setting, a fresh seed; the link goes
 * out from the results), and the invitation sends the game itself.
 *
 * On the shared path: no dataset, no run store until the duel is clicked
 * (`lazyRunStore`), and the duel rules are the pure `engine/duel`.
 */

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { SITE } from "@/config/site";
import { COUNTS } from "@/data/counts";
import { useCopy, useUiLocale } from "@/content/copy";
import { freshDuel } from "@/engine/duel";
import type { Difficulty } from "@/engine/types";
import { randomSeed } from "@/lib/rng";
import { shareLinkOf } from "@/lib/share/links";
import { sfx } from "@/lib/sfx";
import { loadRunStore } from "@/store/lazyRunStore";
import { selectHardUnlocked, selectLegacyUnlocked, useProfileStore } from "@/store/profileStore";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { ShareSheet } from "./ShareSheet";

export function FriendsSection() {
  const { SHARE_UI: S, HOME } = useCopy();
  const locale = useUiLocale();
  const router = useRouter();
  const settings = useProfileStore((s) => s.settings);
  const hardUnlocked = useProfileStore(selectHardUnlocked);
  const legacyUnlocked = useProfileStore(selectLegacyUnlocked);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  // The poster loads with the sheet's first draw, never with the Home.
  const inviteFormats = useMemo(() => {
    const data = {
      headline: S.inviteHeadline,
      modes: [
        { name: S.inviteModeDraft, desc: S.inviteModeDraftDesc, cta: HOME.playNow, tone: "orange" as const },
        { name: S.inviteModeCareer, desc: S.inviteModeCareerDesc, cta: HOME.careerPlay, tone: "blue" as const },
      ],
      free: S.inviteFree,
      figures: [{ value: String(COUNTS.specialCards), label: S.inviteFigCards }],
    };
    const draw = (format: "post" | "story") => async () => {
      const [{ renderInviteImage }, { resolveShareFonts }] = await Promise.all([
        import("@/lib/share/inviteImage"),
        import("@/lib/share/canvasKit"),
      ]);
      return renderInviteImage(data, format, await resolveShareFonts());
    };
    return { post: draw("post"), story: draw("story") };
  }, [S, HOME]);

  const startDuel = () => {
    if (starting) return;
    sfx.click();
    setStarting(true);
    const last = settings.lastDifficulty;
    const difficulty: Difficulty =
      (last === "legacy" && !legacyUnlocked) || (last === "hard" && !hardUnlocked) ? "normal" : last;
    void loadRunStore()
      .then(({ useRunStore }) =>
        useRunStore
          .getState()
          .startDuel(freshDuel({ mode: "classic", difficulty, region: null, showOverall: settings.lastShowOverall }, randomSeed())),
      )
      .catch(() => {})
      .then(() => router.push("/play"));
  };

  return (
    <>
      <h2 className="title-slab mt-12 text-xl md:text-2xl">{S.sectionFriends}</h2>
      <section className="mt-4 grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
        <Panel className="flex flex-col justify-between gap-3 p-4 sm:gap-5 sm:p-6">
          <div>
            <h3 className="display text-lg uppercase leading-none text-ink">{S.duelTitle}</h3>
            <p className="mt-2 max-w-md text-sm leading-snug text-sub">{S.duelDesc}</p>
          </div>
          <Button variant="secondary" className="self-start max-sm:w-full" disabled={starting} onClick={startDuel}>
            {S.duelStart}
          </Button>
        </Panel>
        <Panel className="flex flex-col justify-between gap-3 p-4 sm:gap-5 sm:p-6">
          <div>
            <h3 className="display text-lg uppercase leading-none text-ink">{S.inviteRowTitle}</h3>
            <p className="mt-2 max-w-md text-sm leading-snug text-sub">{S.inviteRowDesc}</p>
          </div>
          <Button variant="secondary" className="self-start max-sm:w-full" onClick={() => setInviteOpen(true)}>
            {S.inviteButton}
          </Button>
        </Panel>
      </section>
      <ShareSheet
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title={S.titleInvite}
        surface="invite"
        gameMode="app"
        text={S.inviteText}
        url={shareLinkOf(SITE.url, locale === "pt" ? "/pt" : "/", "invite")}
        formats={inviteFormats}
        fileName="rocket-draft-invite"
        hint={S.inviteHint}
      />
    </>
  );
}
