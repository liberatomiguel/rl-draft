import type { MailKind } from "@/engine/career/types";

export const ICON_TONE: Record<MailKind, string> = {
  offer: "text-blue-bright",
  sponsor: "text-amber-300",
  contract: "text-cyan",
  finance: "text-good",
  unlock: "text-orange-bright",
  club: "text-cyan",
};

export function MailKindIcon({ kind, className }: { kind: MailKind; className?: string }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };
  switch (kind) {
    case "offer":
      return (
        <svg {...common}>
          <path d="M4 9h13l-3-3M20 15H7l3 3" />
        </svg>
      );
    case "sponsor":
      return (
        <svg {...common}>
          <path d="M12 3h5a3 3 0 0 1 3 3v5l-9 9-8-8 9-9Z" />
          <circle cx="15.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
    case "contract":
      return (
        <svg {...common}>
          <path d="M7 3h7l4 4v14H7V3Z" />
          <path d="M14 3v4h4M10.5 12h4M10.5 16h4" />
        </svg>
      );
    case "finance":
      return (
        <svg {...common}>
          <rect x="3" y="7" width="18" height="11" rx="2" />
          <circle cx="12" cy="12.5" r="2.5" />
        </svg>
      );
    case "unlock":
      return (
        <svg {...common}>
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M9 11V7a3 3 0 0 1 5.8-1" />
        </svg>
      );
    case "club":
      return (
        <svg {...common}>
          <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z" />
        </svg>
      );
  }
}
