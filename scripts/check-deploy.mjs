/**
 * `npm run deploy` guard (runs as `predeploy`).
 *
 * ROCKET_DRAFT_ALLOW_LOCAL_ENDPOINTS=1 lets a local measurement build bake
 * loopback PostHog/Supabase endpoints into out/ (see scripts/postexport.mjs).
 * Such a build must never reach production, so a deploy started from a shell
 * that still has the opt-out set is refused before it builds anything.
 */
const NAME = "ROCKET_DRAFT_ALLOW_LOCAL_ENDPOINTS";

if (process.env[NAME] !== undefined) {
  console.error(
    `check-deploy: ${NAME} is set in this shell — refusing to deploy. ` +
      `Open a clean shell (or unset it) and run \`npm run deploy\` again.`,
  );
  process.exit(1);
}
