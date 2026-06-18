import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS home-screen / maskable icon — the brand hexagon mark on the app's dark
 *  panel color, generated at build (no static asset to ship). Mirrors the
 *  header lockup / opengraph-image. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0A101D",
        }}
      >
        <svg width="150" height="150" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M32 7L53 19.5V44.5L32 57L11 44.5V19.5L32 7Z"
            stroke="url(#appleIconStroke)"
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
              id="appleIconStroke"
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
      </div>
    ),
    { ...size },
  );
}
