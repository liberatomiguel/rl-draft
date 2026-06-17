import { ImageResponse } from "next/og";
import { SITE } from "@/config/site";

export const alt = "Rocket Draft — draft RLCS history, survive the bracket";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Branded share/preview card, generated at build (no static asset to ship). */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#05080f",
          backgroundImage:
            "radial-gradient(900px 540px at 12% -8%, rgba(59,130,246,0.30), transparent 60%), radial-gradient(820px 520px at 96% 108%, rgba(249,115,22,0.26), transparent 58%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 30,
            letterSpacing: 8,
            color: "#8d9ab3",
            textTransform: "uppercase",
            fontWeight: 600,
            marginBottom: 18,
          }}
        >
          Draft history · Survive the bracket
        </div>
        <div style={{ display: "flex", fontSize: 132, fontWeight: 800, letterSpacing: -2 }}>
          <span style={{ color: "#e9eef8" }}>Rocket</span>
          <span style={{ color: "#fb923c" }}>Draft</span>
        </div>
        <div
          style={{
            marginTop: 26,
            fontSize: 30,
            color: "#8d9ab3",
            maxWidth: 880,
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          Build a roster from iconic RLCS lineups and survive an RLCS-style tournament bracket.
        </div>
        <div
          style={{
            marginTop: 44,
            fontSize: 26,
            color: "#fb923c",
            fontWeight: 700,
            letterSpacing: 2,
          }}
        >
          {SITE.domain}
        </div>
      </div>
    ),
    { ...size },
  );
}
