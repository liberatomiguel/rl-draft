import { ImageResponse } from "next/og";
import { SITE } from "@/config/site";

export const alt = "Rocket Draft — draft RLCS history, survive the bracket";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Branded share/preview card, generated at build (no static asset to ship).
 *  Leads with the SAME logo lockup as the site header: the hexagon mark
 *  (public/icon.svg) + the "RocketDraft" wordmark (ink "Rocket" · orange
 *  "Draft", matching --ink / --orange). */
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
            marginBottom: 30,
          }}
        >
          Draft history · Survive the bracket
        </div>

        {/* Header logo lockup: hexagon mark + RocketDraft wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
          <svg width="128" height="128" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M50 0H14C6.26801 0 0 6.26801 0 14V50C0 57.732 6.26801 64 14 64H50C57.732 64 64 57.732 64 50V14C64 6.26801 57.732 0 50 0Z"
              fill="#0A101D"
            />
            <path
              d="M32 7L53 19.5V44.5L32 57L11 44.5V19.5L32 7Z"
              stroke="url(#ogLogoStroke)"
              strokeWidth="3.5"
            />
            <path
              d="M24 40L40 24M40 33.5V24H30.5"
              stroke="#F97316"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <defs>
              <linearGradient
                id="ogLogoStroke"
                x1="11"
                y1="7"
                x2="60.2495"
                y2="48.3696"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0.15" stopColor="#38BDF8" />
                <stop offset="0.495192" stopColor="#3B82F6" />
                <stop offset="0.85" stopColor="#F97316" />
              </linearGradient>
            </defs>
          </svg>
          <div
            style={{
              display: "flex",
              fontSize: 100,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: 4,
            }}
          >
            <span style={{ color: "#e9eef8" }}>Rocket</span>
            <span style={{ color: "#f97316" }}>Draft</span>
          </div>
        </div>

        <div
          style={{
            marginTop: 30,
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
