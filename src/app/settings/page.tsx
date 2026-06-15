"use client";

import { useCopy } from "@/content/copy";
import { cx } from "@/lib/util";
import { sfx } from "@/lib/sfx";
import { type AnimSpeedKey, useSettings } from "@/store/settingsStore";
import { useMounted } from "@/store/useMounted";
import { BackToMenu } from "@/components/layout/LeaveRunGuard";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";

const SPEED_KEYS: AnimSpeedKey[] = ["slow", "normal", "fast"];

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

  return (
    <div className="rise-in mx-auto max-w-2xl">
      <BackToMenu />
      <SectionTitle kicker={S.subtitle} title={S.title} className="mb-6" />

      {/* Sound */}
      <Panel className="mb-4 p-5">
        <p className="kicker mb-4">{S.soundSection}</p>
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
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-ink">{S.volume}</span>
            <span className="display text-sm text-sub">{Math.round(s.soundVolume * 100)}</span>
          </div>
          <input
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
      </Panel>

      {/* Motion */}
      <Panel className="mb-4 p-5">
        <p className="kicker mb-4">{S.motionSection}</p>
        <Toggle
          label={S.reducedMotion}
          hint={S.reducedMotionHint}
          checked={s.reducedMotion}
          onChange={(v) => s.set("reducedMotion", v)}
        />
        <div className="mt-5">
          <p className="text-sm font-semibold text-ink">{S.animSpeed}</p>
          <p className="mt-0.5 mb-2.5 text-xs text-sub">{S.animSpeedHint}</p>
          <div className="inline-flex overflow-hidden rounded-lg border border-line">
            {SPEED_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={s.animSpeed === key}
                onClick={() => s.set("animSpeed", key)}
                className={cx(
                  "display px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors",
                  s.animSpeed === key
                    ? "bg-orange/20 text-orange-bright"
                    : "text-sub hover:text-ink",
                )}
              >
                {speedLabel[key]}
              </button>
            ))}
          </div>
        </div>
      </Panel>

      {/* Language */}
      <Panel className="mb-4 p-5">
        <p className="kicker mb-4">{S.languageSection}</p>
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-semibold text-ink">{S.language}</span>
          <div className="inline-flex overflow-hidden rounded-lg border border-line">
            {(["en", "pt"] as const).map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={s.lang === l}
                onClick={() => s.set("lang", l)}
                className={cx(
                  "display px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors",
                  s.lang === l ? "bg-orange/20 text-orange-bright" : "text-sub hover:text-ink",
                )}
              >
                {l === "en" ? "English" : "Português"}
              </button>
            ))}
          </div>
        </div>
      </Panel>

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={s.resetSettings}>
          {S.reset}
        </Button>
      </div>
    </div>
  );
}
