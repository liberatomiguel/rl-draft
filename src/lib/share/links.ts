/**
 * Share kit (v2.2): the links a share sends. Always the production site, so a
 * post made on any build brings friends to the real game, tagged with utm so
 * the visit reads as a share in analytics (campaign = the surface shared).
 * Light on purpose: the Home imports it (shared path).
 */

export function shareLinkOf(base: string, path: string, campaign: string, source = "share"): string {
  const url = new URL(path, base);
  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", "share");
  url.searchParams.set("utm_campaign", campaign);
  return url.toString();
}
