# Deploying Rocket Draft on Cloudflare — runbook

> **Owner:** Miguel does every account action (Cloudflare, Vercel, GitHub,
> Search Console). Agents edit code and this file, never the accounts.
> Written 2026-10-03 for branch `perf/static-cloudflare`. The live DNS facts
> below were checked on that date; re-run §3 before acting on them.

The site is a **pure static export** (`next build` → `out/`), served by a
Cloudflare Worker that has **static assets only** (`wrangler.jsonc`). There is no
server code anywhere.

---

## 1. Why Cloudflare Workers Static Assets

- **Vercel Hobby counts every request**, static files included, against 1M
  requests per month. Rocket Draft went past 3M, and Vercel disabled the project:
  apex and www return `402` with `X-Vercel-Error: DEPLOYMENT_DISABLED` (checked
  2026-10-03). On Hobby you wait about 30 days, or you pay for Pro.
- **On Cloudflare, requests served straight from static assets are free and
  unlimited**, and their bandwidth is not metered. Only requests that run a Worker
  *script* are billed (Free plan: 100,000 per day).
- **Cloudflare Pages has the same free terms, but it is in maintenance mode.**
  Cloudflare tells new projects to start on Workers, and new features go to
  Workers only. Don't use Pages.
- Requests per visit were also cut (cold home 74–80 → 27 requests; a full draft
  run 166 → ≤71), so the site would be lighter on any host.

## 2. HARD RULE: no Worker script

**Every request must be answered from static assets.** Never add any of these:

- `main` in `wrangler.jsonc` (a Worker script), or `assets.run_worker_first`
- `@opennextjs/cloudflare` / OpenNext, or any "Next.js on Workers" adapter
- Pages Functions (a `functions/` folder) or a `_worker.js`
- Next middleware/proxy, route handlers that read the request, Server Actions,
  ISR, or `headers()` / `redirects()` / `rewrites()` in `next.config.ts`

Any one of them turns every page view into a Worker invocation. The Free plan
allows 100,000 a day, about 3M a month. That is the traffic that took Vercel down.

Headers go in `public/_headers`. Cross-host redirects (www → apex) go in a zone
**Redirect Rule** (§7).

> **Autoconfig trap.** `wrangler deploy` on a checkout **without**
> `wrangler.jsonc` detects Next.js and offers to set it up with OpenNext, which
> creates a Worker script. Never build a branch that lacks `wrangler.jsonc`, and
> decline anything in the dashboard or CLI that mentions OpenNext or a framework
> adapter. Optional extra guard: use `npx wrangler deploy --no-autoconfig` as the
> deploy command. Wrangler 4.147 accepts the flag; if a later version rejects it,
> the deploy fails loudly.

## 3. Prerequisites and DNS inventory

**Before you start:**

1. **Code.** Review, commit and merge `perf/static-cloudflare` into the branch
   you release from (recommended: `main`). The branch was cut from `staging`, so
   merging it also brings the Road to Worlds alpha *code*. Career mode stays
   **off** in production builds unless `NEXT_PUBLIC_CAREER_MODE=1` is set (§5).
   `main` @ v1.4.4 has no `wrangler.jsonc`, so **don't connect Workers Builds
   until the merge is done** (see the autoconfig trap above).
2. **Cloudflare account** (Free plan). Turn on 2FA.
3. **GitHub:** repo `liberatomiguel/rl-draft`. You'll allow the Cloudflare
   GitHub app to access it.
4. **Vercel:** keep the account. The domain was most likely bought through
   Vercel: it uses Vercel nameservers, and the registrar is Hosting Concepts
   B.V. d/b/a Registrar.eu (Openprovider), expiring **2027-06-15**.
5. **Build variable values:** from the old Vercel project's environment
   variables, or from `.env.local` (§5).

**DNS inventory.** Do this BEFORE you switch nameservers. Run it in Git Bash:

```bash
dns() { echo "== $1 $2"; curl -s "https://dns.google/resolve?name=$1&type=$2" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s).Answer||[];console.log(a.length?a.map(r=>"   "+r.data).join("\n"):"   (none)")})'; }
for rr in "rocketdraft.app NS" "rocketdraft.app A" "rocketdraft.app AAAA" "rocketdraft.app TXT" \
  "rocketdraft.app CAA" "rocketdraft.app MX" "rocketdraft.app DS" "www.rocketdraft.app A" \
  "www.rocketdraft.app CNAME" "resend._domainkey.rocketdraft.app TXT" "send.rocketdraft.app MX" \
  "send.rocketdraft.app TXT" "_dmarc.rocketdraft.app TXT"; do dns $rr; done
```

A DNS query only finds the names you ask for. Also open **Vercel → Domains →
rocketdraft.app → DNS Records**, which lists every record, and add anything
missing from this table.

Live records on 2026-10-03:

| Name | Type | Live value | What it is | In Cloudflare |
|---|---|---|---|---|
| `rocketdraft.app` | NS | `ns1/ns2.vercel-dns.com` | Vercel DNS | Replaced by the Cloudflare nameservers (§4) |
| `rocketdraft.app` | A | Vercel IPs (`216.198.79.1`, `64.29.17.x`) | Old Vercel hosting | **Do not recreate.** Delete it if the import adds it. The Worker custom domain creates the apex record (§6). Keep a note of it for rollback. |
| `www` | A | same Vercel IPs | Old Vercel hosting | **Replace** with `A www 192.0.2.1`, **Proxied** (§7) |
| `rocketdraft.app` | TXT | `google-site-verification=NuSIkK8VRKtcP88tuSh5bmTvBwvmWYI-cGEdN4vGmxY` | Search Console **Domain** property | Recreate exactly |
| `rocketdraft.app` | CAA ×3 | `0 issue "letsencrypt.org"`, `0 issue "pki.goog"`, `0 issue "sectigo.com"` | Which CAs may issue certificates | Recreate all three |
| `resend._domainkey` | TXT | `p=MIGf…` (long DKIM public key) | Resend DKIM, which signs the sign-in code emails | Recreate. Copy the **full** value from the query output or the Resend dashboard. |
| `send` | MX | `10 feedback-smtp.sa-east-1.amazonses.com` | Resend bounce / return path | Recreate (priority 10) |
| `send` | TXT | `v=spf1 include:amazonses.com ~all` | SPF for Resend | Recreate |
| `_dmarc`, apex MX, AAAA | — | none | — | Nothing to do |
| DS | — | none (DNSSEC off) | — | Nothing to disable before the switch |

Cloudflare's import scan can miss `resend._domainkey` and `send`. Add them by
hand if they are missing. If they're lost, the sign-in emails break (when
accounts go live). If the TXT record is lost, Search Console loses its
verification.

## 4. Create the zone and switch nameservers

The site is already down (402), so the switch adds no downtime.

1. Cloudflare dashboard → **Add a domain** → `rocketdraft.app` → **Free** plan.
   Let it scan the existing records.
2. Fix the scanned records to match the table in §3. Delete the apex/www Vercel A
   records, keep or add the TXT, CAA and Resend records, and add
   `A www 192.0.2.1` with Proxied on.
3. Cloudflare shows **two assigned nameservers** (`*.ns.cloudflare.com`). Copy
   them.
4. **Vercel → Domains** (the account-level Domains page, not the project) →
   `rocketdraft.app` → **Nameservers → Edit**. Enter the two Cloudflare
   nameservers. If the domain doesn't show there, it's managed at
   Registrar.eu/Openprovider; change the nameservers there.
5. Wait until Cloudflare marks the zone **Active**. This takes from minutes up to
   24 h, and you get an email. To check:
   `dns rocketdraft.app NS` should show `*.ns.cloudflare.com`.
6. Re-run the inventory loop. The TXT, CAA and Resend answers must match the
   table in §3.
7. **SSL/TLS → Edge Certificates → Always Use HTTPS: On.**

## 5. Connect Workers Builds (CI)

Do this only once the zone is **Active** and the release branch contains
`wrangler.jsonc`.

1. **Workers & Pages → Create → Import a repository → GitHub.** Authorise the
   Cloudflare app for `liberatomiguel/rl-draft` and select it.
2. Settings:
   - **Project / Worker name:** `rocket-draft`. This **must equal `"name"` in
     `wrangler.jsonc`**, or the build fails.
   - **Production branch:** the branch you release from (recommended: `main`
     after the merge).
   - **Build command:** `npm run build`. It runs `prebuild` (`validate:data`,
     then `test:contract`, the persist-contract save gate, then `build:images`),
     then `next build` → `out/`, then `postbuild` (`scripts/postexport.mjs`).
     postexport fails the deploy on non-https or localhost analytics/Supabase
     endpoints, or on any image URL missing from `out/`, and logs whether
     accounts and analytics are ENABLED. Any failing check stops the deploy.
   - **Deploy command:** `npx wrangler deploy`. Use `--no-autoconfig` if you want
     the guard from §2.
   - **Non-production branch deploy command:** leave the default
     (`npx wrangler versions upload`), and see "Staging previews" below.
   - **Root directory:** `/`.
3. Add the **build variables** below **before** the first build, or retry the
   build after adding them.
4. Save and deploy. If the zone wasn't Active yet, the build itself succeeds but
   the deploy step fails at the custom-domain route. Retry once the zone is Active.

**Build variables.** Set them in *Settings → Build → Variables and secrets*. They
are **build-time** values: `NEXT_PUBLIC_*` gets baked into the JS. The Worker's
runtime "Variables and Secrets" do nothing here, because there's no script.
Changing a value needs a new build. Only the names go in this file; take the
values from the old Vercel project or `.env.local`.

| Name | Set it? | Notes |
|---|---|---|
| `NEXT_PUBLIC_POSTHOG_KEY` | Yes | Without it, analytics is off (the game still works). |
| `NEXT_PUBLIC_POSTHOG_HOST` | Yes | EU host. The code falls back to the EU host if it's unset. |
| `GOOGLE_SITE_VERIFICATION` | Only if the Vercel project had it | Adds the GSC `<meta>` tag (`src/app/layout.tsx`). The Domain property is already verified by the DNS TXT record. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Only when accounts go live** | These switch on sign-in and the global leaderboards. Finish `docs/ACCOUNTS-SETUP.md` (SQL + email) first. |
| `NEXT_PUBLIC_CAREER_MODE` | **Never on the production Worker** until career ships | `=1` turns the Road to Worlds alpha on. Use it for career preview builds only. |
| `NODE_VERSION` | Optional | The repo pins Node 24 via `.nvmrc` (local dev runs Node 24.14), which stops the build image from drifting. Set `NODE_VERSION=24` only if you also want the pin in the dashboard. |

**Never set `NODE_ENV`.** npm would then skip devDependencies, and the build
needs vitest, sharp and wrangler.

**Staging previews.** `wrangler.jsonc` has `preview_urls: false` and
`workers_dev: false`, so a non-production branch build uploads a version that
has **no URL** and is never deployed. That's harmless, but it uses build
minutes. Turn off "Builds for non-production branches" unless you set up
previews. Build variables belong to the Worker, so they also apply to
production builds. That's why the career flag must never go there. To see
staging or career:

- **Local (no account needed):**
  `NEXT_PUBLIC_CAREER_MODE=1 npm run build && npm run preview:static` → open
  <http://localhost:8787>, then press Ctrl+C. The inline `VAR=1 cmd` form applies
  to that one command only. Never `export` the flag in a shell you deploy from,
  and never put it in `.env.local`.
- **Cloud staging — `staging.rocketdraft.app`** (configured): `wrangler.jsonc`
  has an `env.staging` → Worker **`rocket-draft-staging`** on the custom domain
  `staging.rocketdraft.app`. Create a **second** Workers Builds project:
  - Worker name `rocket-draft-staging`, same repo, **production branch `staging`**.
  - Build command `npm run build`; deploy command `npx wrangler deploy --env staging`.
  - Build variables: `NEXT_PUBLIC_CAREER_MODE=1`, `NEXT_PUBLIC_NOINDEX=1`
    (robots.txt `Disallow: /` + `noindex` meta), plus the PostHog vars if you want
    staging analytics (better: leave PostHog unset so tests don't pollute prod data).
  - Staging is a separate origin, so its saves never touch players' saves.
  - The production project keeps `main` and `npx wrangler deploy` (the
    "multiple environments" warning it prints is expected).

## 6. Custom domain (apex)

`wrangler.jsonc` declares `routes: [{ "pattern": "rocketdraft.app",
"custom_domain": true }]`. On each deploy, Cloudflare creates the apex DNS
record and the certificate. This needs:

- the zone **Active** on the same Cloudflare account, and
- **no other apex A/AAAA/CNAME** record. Delete the old Vercel ones.

Check *Worker → Settings → Domains & Routes*: it should list `rocketdraft.app`.
If the deploy log says the domain could not be attached, add it there by hand
(**Add → Custom domain → `rocketdraft.app`**) and retry the build.
**Don't add `www` as a custom domain.** It must redirect, not serve pages (§11).

## 7. www → apex redirect and HTTPS

1. DNS: `A www 192.0.2.1`, **Proxied** (orange cloud). `192.0.2.1` is a reserved
   placeholder; requests never reach it because the rule answers first.
   Cloudflare's Universal certificate covers `www`.
2. **Rules → Redirect Rules → Create rule** (Single Redirect). You can use the
   template "Redirect from WWW to root", or fill it in by hand:
   - *If:* Hostname **equals** `www.rocketdraft.app`
   - *Then:* URL redirect → **Dynamic** →
     `concat("https://rocketdraft.app", http.request.uri.path)`
   - Status **301**, **Preserve query string: on**
3. **Always Use HTTPS: on** (already done in §4). `.app` is on the HSTS
   preload list, so browsers always use HTTPS anyway. The setting covers bots
   and curl.

Vercel used to answer www with a 308. 301 works just as well for SEO.

## 8. Retire Vercel (keep the account)

1. Vercel project → Settings → **Domains** → remove `rocketdraft.app` and
   `www.rocketdraft.app` **from the project**.
2. Optional: Project → Settings → **Git → Disconnect**, so pushes stop starting
   Vercel builds.
3. **Keep the Vercel account and the domain registration**, with auto-renew and a
   payment method (expires 2027-06-15). You can transfer the domain later.
   Cloudflare Registrar support for `.app` was not verified.
4. Keep the Vercel project itself until the Cloudflare site has run cleanly for
   a while. It's the paid rollback path (§12).

## 9. Optional Cloudflare settings

- **Bots / AI crawlers:** static requests cost nothing here, so blocking is a
  policy choice, not a cost one. "Block AI bots" is your call (it may reduce
  visibility in AI search). Leave Bot Fight Mode off at first. If you turn on any
  Cloudflare-managed `robots.txt` / AI-crawler feature, recheck
  `https://rocketdraft.app/robots.txt` afterwards. The app ships its own
  (`src/app/robots.ts`).
- **Leave off:** Rocket Loader (it rewrites script tags and can break
  hydration), and Web Analytics / RUM (PostHog already covers analytics, and RUM
  adds a beacon per page).
- **Caching:** nothing to configure. Cache headers come from `public/_headers`.

## 10. Post-deploy verification

Run these in Git Bash from the repo root:

```bash
D=https://rocketdraft.app
st() { curl -s -o /dev/null -w "%{http_code}  $1\n" "$D$1"; }
st /; st /play; st /pt; st /pt/faq                 # expect 200 each
st /career; st /nope                               # expect 404 each (career off)
curl -sI "$D/play/" | grep -iE '^(HTTP|location)'  # 307, location: /play
curl -sI "$D/" | grep -iE '^(server|x-vercel)'     # server: cloudflare, no x-vercel-*
JS=$(curl -s "$D/" | grep -o '/_next/static/[^"]*\.js' | head -1)
curl -sI "$D$JS" | grep -iE '^(HTTP|cache-control)'          # 200, max-age=31536000, immutable
IMG=$(node -p "const m=require('./src/generated/asset-manifest.json');const [k,h]=Object.entries(m.orgs)[0];'/img/orgs/'+k+'.'+h+'.96.webp'")
curl -sI "$D$IMG" | grep -iE '^(HTTP|content-type|cache-control)'  # 200, image/webp, immutable
curl -sI "$D/opengraph-image.png" | grep -i '^content-type'   # image/png
curl -s "$D/sitemap.xml" | head -3                            # XML urlset
curl -s "$D/robots.txt"                                       # Allow: / + Sitemap line
curl -sI "https://www.rocketdraft.app/play?x=1" | grep -iE '^(HTTP|location)'  # 301 → https://rocketdraft.app/play?x=1
curl -sI "http://rocketdraft.app/" | grep -iE '^(HTTP|location)'              # 301 → https://
```

Then check in a browser:

- Your old save is still there (same origin).
- A draft loads its card photos and logos.
- PostHog receives a `$pageview` (it fires after page load + idle, not instantly).

In **Search Console**: confirm the Domain property is still verified, then
**resubmit `https://rocketdraft.app/sitemap.xml`** and request indexing for the
home page.

Expect PostHog pageviews and sessions to dip at the cutover. This is by design:
very early bounces are no longer counted and `$pageleave` is gone. Don't compare
numbers from before and after the cutover directly.

## 11. Player saves — read this before changing hosts or domains

- All progress lives in **`localStorage` on `https://rocketdraft.app` only**:
  profile/XP/collection/achievements, the current run, and settings. The origin
  doesn't change, so saves carry over from Vercel automatically.
- **Any other hostname starts with an empty save.** Never send players to
  `*.workers.dev`, `*.pages.dev`, preview URLs or a new domain, and **keep `www`
  a redirect** (never let it serve pages).
- Persist keys and versions are frozen by `src/store/persistContract.test.ts`.
- **Downtime costs saves too.** Safari/WebKit deletes script-written storage
  after 7 days of browser use without a visit to the site (home-screen apps are
  exempt). Relaunch soon.

## 12. Local commands

| Command | What it does |
|---|---|
| `npm run build` | `prebuild` = `validate:data` + `test:contract` + `build:images` → `next build` (writes `out/`) → `postexport` (Windows segment-folder fix, `/career` strip when the flag is off, endpoint and image-URL checks, sanity checks, accounts/analytics ENABLED log). Takes ~48 s. |
| `npm run preview:static` (also `npm run start`) | `wrangler dev`: serves `out/` the way production does at <http://localhost:8787>. **Stop it when done.** `next start` doesn't work with a static export. |
| `npx wrangler login`, then `npm run deploy` | Build + `wrangler deploy` from your machine. Refuses to run when `ROCKET_DRAFT_ALLOW_LOCAL_ENDPOINTS` is set in the shell (`predeploy` check). |

postexport rejects loopback or non-https `NEXT_PUBLIC_POSTHOG_HOST` /
`NEXT_PUBLIC_SUPABASE_URL`. Measurement builds need
`ROCKET_DRAFT_ALLOW_LOCAL_ENDPOINTS=1` in the shell, and that `out/` must never
be deployed. `npm run deploy` refuses to run while
`ROCKET_DRAFT_ALLOW_LOCAL_ENDPOINTS` is set in the shell. Never run a bare
`npx wrangler deploy` on an `out/` you did not just build. Check the
`accounts (Supabase): ENABLED/DISABLED` line in the build log before any local
`npm run deploy`, since it reads `.env.local`.

**Local deploy warning:** a local build reads `.env.local`, which today holds the
**Supabase** variables. A local `npm run deploy` would therefore switch sign-in
on in production before the SQL and email setup are done. Comment those lines
out first, or deploy through Workers Builds (a git push). Workers Builds is
better anyway, since every deploy is then a commit.

## 13. Rollback

- **Cloudflare (instant):** Worker → **Deployments** → choose the previous
  version → **Rollback**, or run `npx wrangler rollback`. Static assets roll back
  with the version. Or revert the commit and push.
- **Paid emergency:** Vercel Pro ($20/mo, 10M requests included) re-enables the
  old Vercel deployment (v1.4.4). Once the nameservers have moved, this also means
  removing the Worker custom domain and pointing the apex/www back at Vercel's IPs
  in Cloudflare DNS (DNS only). Last resort.

## 14. Free-tier watch list

| Service | Free limit | What happens when you hit it |
|---|---|---|
| Cloudflare static assets | Unlimited requests and bandwidth | — (Worker *script* invocations, 100k/day, should always be zero) |
| Asset upload | 20,000 files and 25 MiB per file per version | `postexport` fails the build first. Today `out/` is 1,071 files / 35 MB. |
| Workers Builds | 3,000 build-min/month, 1 concurrent build, 20 min timeout | Builds queue or stop for the month |
| Redirect Rules | 10 per zone (1 used) | — |
| PostHog | 1M events/month | Extra data is dropped; the site is unaffected |
| Supabase (once accounts are live) | 50k MAU, 500 MB DB, 5 GB egress; pauses after 1 week of inactivity; built-in email 2/hour | Use custom SMTP (the Resend records are already in DNS) |
| Domain (Vercel) | Renews 2027-06-15 | Keep auto-renew on |

**References:** Cloudflare
[static-assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/),
[Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/),
[custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/),
[`_headers`](https://developers.cloudflare.com/workers/static-assets/headers/),
[www → root redirect](https://developers.cloudflare.com/rules/url-forwarding/examples/redirect-www-to-root/).
