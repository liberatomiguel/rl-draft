/**
 * Renders a JSON-LD <script> for structured data. Server component — emits the
 * tag into the page HTML so crawlers read it without running JS. Use with the
 * builders in `@/lib/jsonld`. Multiple <JsonLd> per page are fine.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // Schema is built from our own constants/copy (no user input) — safe.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
