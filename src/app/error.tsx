"use client";

/** Global error boundary — also catches dataset validation errors in dev. */

import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isDataError = error.message.includes("[data]");
  return (
    <div className="mx-auto mt-16 max-w-xl">
      <Panel strong className="p-8 text-center">
        <p className="kicker mb-2">Unexpected stoppage</p>
        <h1 className="display text-2xl font-bold uppercase tracking-wide text-ink">
          {isDataError ? "Dataset error" : "Something went wrong"}
        </h1>
        <p className="mt-3 break-words text-sm leading-relaxed text-sub">
          {isDataError
            ? error.message
            : "An unexpected error interrupted the game. Your saved progress is safe."}
        </p>
        <Button variant="primary" className="mt-6" onClick={reset}>
          Try again
        </Button>
      </Panel>
    </div>
  );
}
