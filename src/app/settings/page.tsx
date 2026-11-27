"use client";

import { useCopy } from "@/content/copy";
import { cx } from "@/lib/util";
import { sfx } from "@/lib/sfx";
import { type AnimSpeedKey, useSettings } from "@/store/settingsStore";
import { useMounted } from "@/store/useMounted";
import { BackToMenu } from "@/components/layout/LeaveRunGuard";
import { SectionTitle } from "@/components/ui/Panel";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { TYPE_LAB } from "@/components/ui/typeLab";
import { TypeLabSwitch } from "@/components/ui/TypeLabSwitch";

const SPEED_KEYS: AnimSpeedKey[] = ["slow", "normal", "fast"];

/** One option of a short choice (speed, language): the chosen one takes the
 *  orange hairline, the others stay quiet outlines. */
const choiceClass = (on: boolean) =>
  cx(
    "display min-h-11 rounded-md border px-4 text-xs font-semibold uppercase tracking-[0.04em] transition-colors sm:min-h-9",
    on ? "border-orange/60 bg-white/[0.04] text-ink" : "border-line text-sub hover:border-line-strong hover:text-ink",
  );

const SECTION = "border-b border-line py-6";
const SECTION_TITLE = "display text-lg uppercase leading-none text-ink";

export default function SettingsPage() {
  const S = useCopy().SETTINGS_UI;
  const speedLabel: Record<AnimSpeedKey, string> = {
    slow: S.speedSlow,
    normal: S.speedNormal,
    fast: S.speedFast,
  };
  const mounted = useMounted();
  const s = useSettings();

  // Avoid hydration fl: render the controls only once the persisted store is read.
  if (!mounted) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="h-8 w-40 animate-pulse rounded bg-white/5" />
      </div>
    );
  }

  // Job: set sound, motion and language. One small decision per row, none of
  // them the screen's "main" one, so this is a plain form: three titled groups
  // on hairlines, label on the left, control on the right. No boards.
  return (
    <div className="rise-in mx-auto max-w-2xl">
      <BackToMenu />
      <SectionTitle kicker={S.subtitle} title={S.title} className="mb-2" />

      {/* Sound */}
      <section className={SECTION}>
        <h3 className={cx(SECTION_TITLE, "mb-4")}>{S.soundSection}</h3>
        <Toggle
          label={S.soundEnabled}
          hint={S.soundEnabledHint}
          checked={s.soundEnabled}
          onChange={(v) => {
            s.set("soundEnabled", v);
            if (v) sfx.pick();
          }}
        />
        <div className={cx("mt-5", !s.soundEnabled && "pointer-events-none opacity-40")}>
          <div className="mb-2 flex items-baseline justify-between">
            <label htmlFor="settings-volume" className="text-sm font-semibold text-ink">
              {S.volume}
            </label>
            <span className="display text-base font-bold text-ink">{Math.round(s.soundVolume * 100)}</span>
          </div>
          <input
            id="settings-volume"
            type="range"
            min={0}
            max={100}
            value={Math.round(s.soundVolume * 100)}
            aria-label={S.volume}
            onChange={(e) => s.set("soundVolume", Number(e.target.value) / 100)}
            onMouseUp={() => s.soundEnabled && sfx.pick()}
            className="w-full accent-orange"
          />
        </div>
      </section>

      {/* Motion */}
      <section className={SECTION}>
        <h3 className={cx(SECTION_TITLE, "mb-4")}>{S.motionSection}</h3>
        <Toggle
          label={S.reduceEffects}
          hint={S.reduceEffectsHint}
          checked={s.reduceEffects}
          onChange={(v) => s.set("reduceEffects", v)}
        />
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{S.animSpeed}</p>
            <p className="mt-0.5 text-xs text-sub">{S.animSpeedHint}</p>
          </div>
          <div role="group" aria-label={S.animSpeed} className="flex shrink-0 gap-1.5">
            {SPEED_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={s.animSpeed === key}
                onClick={() => s.set("animSpeed", key)}
                className={choiceClass(s.animSpeed === key)}
              >
                {speedLabel[key]}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Language: a single row, so the group's title is its label. */}
      <section className={cx(SECTION, "flex flex-wrap items-center justify-between gap-x-6 gap-y-3")}>
        <h3 className={SECTION_TITLE}>{S.languageSection}</h3>
        <div role="group" aria-label={S.language} className="flex shrink-0 gap-1.5">
          {(["en", "pt"] as const).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={s.lang === l}
              onClick={() => s.set("lang", l)}
              className={choiceClass(s.lang === l)}
            >
              {l === "en" ? "English" : "Português"}
            </button>
          ))}
        </div>
      </section>

      {/* rc9 DS: the type lab, on the staging and dev builds only. */}
      {TYPE_LAB ? (
        <section className={SECTION}>
          <TypeLabSwitch />
        </section>
      ) : null}

      <div className="flex justify-end pt-4">
        <Button variant="ghost" size="sm" onClick={s.resetSettings}>
          {S.reset}
        </Button>
      </div>
    </div>
  );
}
