"use client";

/**
 * v2.0.14 — the last error screen: what `error.tsx` could not catch (an error in the
 * root layout, or one thrown again while the route boundary was clearing a broken tree).
 *
 * Until now Next's built-in fallback handled this: one grey line on a black page, with
 * no way out. Players reported it as "the screen went black". This file replaces the
 * root layout while it shows, so it brings its own <html> and <body>, uses inline styles
 * only (the stylesheet may be the thing that failed) and imports nothing from the game
 * but the error report.
 *
 * The copy lives here, not in `copy.*.ts`: this screen must render when the stores and
 * the copy layer cannot. EN and PT, chosen from the browser language.
 */

import { useEffect } from "react";
import { reportScreenError } from "@/lib/analytics";

const TEXT = {
  en: {
    kicker: "Unexpected stoppage",
    title: "Something went wrong",
    body: "This screen stopped working. Reload the page to continue. Your saved progress is safe.",
    hint: "If your browser is translating this page, turning the translation off for this site avoids this error.",
    reload: "Reload the page",
    home: "Back to the menu",
  },
  pt: {
    kicker: "Parada inesperada",
    title: "Algo deu errado",
    body: "Esta tela parou de funcionar. Recarregue a página para continuar. Seu progresso salvo está seguro.",
    hint: "Se o navegador estiver traduzindo esta página, desativar a tradução para este site evita este erro.",
    reload: "Recarregar a página",
    home: "Voltar ao menu",
  },
} as const;

function browserText() {
  try {
    return navigator.language.toLowerCase().startsWith("pt") ? TEXT.pt : TEXT.en;
  } catch {
    return TEXT.en;
  }
}

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    reportScreenError("boundary", error);
  }, [error]);
  const t = browserText();
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          boxSizing: "border-box",
          background: "#070a11",
          color: "#e9eef8",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <main
          style={{
            width: "100%",
            maxWidth: 480,
            padding: 32,
            textAlign: "center",
            borderRadius: 16,
            border: "1px solid rgba(146, 164, 196, 0.28)",
            background: "rgba(16, 24, 43, 0.92)",
          }}
        >
          <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "#fb923c" }}>
            {t.kicker}
          </p>
          <h1 style={{ margin: "8px 0 0", fontSize: 24, textTransform: "uppercase", letterSpacing: "0.04em" }}>{t.title}</h1>
          <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.6, color: "#8d9ab3" }}>{t.body}</p>
          <p style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.6, color: "#8d9ab3" }}>{t.hint}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 24,
              minHeight: 44,
              padding: "8px 20px",
              border: 0,
              borderRadius: 10,
              background: "#f97316",
              color: "#1a0d02",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {t.reload}
          </button>
          <p style={{ margin: "16px 0 0", fontSize: 13 }}>
            {/* A plain document link on purpose: the app router is what just failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" style={{ color: "#8d9ab3" }}>
              {t.home}
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}
