/**
 * Dataset builder — converts data-sources/teams.md (the curated "all RLCS
 * finals teams" file) into every JSON the game consumes, plus the special
 * cards catalogue (transcribed from data-sources/specials-reference.md with
 * base-card season hints).
 *
 * Usage:  npm run build:data   (or: node scripts/build-dataset.mjs)
 *
 * Re-run whenever data-sources/teams.md changes. The script is the single
 * source of truth for id generation — hand-edit the MD, not the JSONs.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "data-sources", "teams.md"), "utf8");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const stripDiacritics = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const personKeyOf = (nick) => stripDiacritics(nick).toLowerCase().replace(/[^a-z0-9]/g, "");
const slugOf = (name) =>
  stripDiacritics(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Deterministic tiny hash for fallback buff types. */
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const STATS = ["offense", "defense", "mechanics", "consistency", "experience", "clutch"];

// ---------------------------------------------------------------------------
// Seasons
// ---------------------------------------------------------------------------

const SEASONS = {
  S1: { id: "rlcs-s1", slug: "s1", label: "RLCS Season 1", shortLabel: "S1 '16", year: "2016", order: 1 },
  S2: { id: "rlcs-s2", slug: "s2", label: "RLCS Season 2", shortLabel: "S2 '16", year: "2016", order: 2 },
  S3: { id: "rlcs-s3", slug: "s3", label: "RLCS Season 3", shortLabel: "S3 '17", year: "2017", order: 3 },
  S4: { id: "rlcs-s4", slug: "s4", label: "RLCS Season 4", shortLabel: "S4 '17", year: "2017", order: 4 },
  S5: { id: "rlcs-s5", slug: "s5", label: "RLCS Season 5", shortLabel: "S5 '18", year: "2018", order: 5 },
  S6: { id: "rlcs-s6", slug: "s6", label: "RLCS Season 6", shortLabel: "S6 '18", year: "2018", order: 6 },
  S7: { id: "rlcs-s7", slug: "s7", label: "RLCS Season 7", shortLabel: "S7 '19", year: "2019", order: 7 },
  S8: { id: "rlcs-s8", slug: "s8", label: "RLCS Season 8", shortLabel: "S8 '19", year: "2019", order: 8 },
  S9: { id: "rlcs-s9", slug: "s9", label: "RLCS Season 9", shortLabel: "S9 '20", year: "2020", order: 9 },
  "RLCS X": { id: "rlcs-x", slug: "x", label: "RLCS X", shortLabel: "X '20-21", year: "2020-21", order: 10 },
  "2021-22": { id: "rlcs-2021-22", slug: "2122", label: "RLCS 2021-22", shortLabel: "'21-22", year: "2021-22", order: 11 },
  "2022-23": { id: "rlcs-2022-23", slug: "2223", label: "RLCS 2022-23", shortLabel: "'22-23", year: "2022-23", order: 12 },
  2024: { id: "rlcs-2024", slug: "2024", label: "RLCS 2024", shortLabel: "'24", year: "2024", order: 13 },
  2025: { id: "rlcs-2025", slug: "2025", label: "RLCS 2025", shortLabel: "'25", year: "2025", order: 14 },
  2026: { id: "rlcs-2026", slug: "2026", label: "RLCS 2026", shortLabel: "'26", year: "2026", order: 15 },
  // v2.0 national teams (FIFAe Nations Cup editions). Same `order` as the RLCS
  // season of the same year — the career and era logos key off order, and no
  // season is renumbered; on a tie the map order puts FIFAe after the RLCS.
  // `national` marks every lineup of the season as a national team (special
  // draw + all-special cards, see Lineup.national); it is not written out.
  "FIFAe 2024": { id: "fifae-2024", slug: "fifae-2024", label: "FIFAe 2024", shortLabel: "FIFAe '24", year: "2024", order: 13, national: true },
  "FIFAe 2025": { id: "fifae-2025", slug: "fifae-2025", label: "FIFAe 2025", shortLabel: "FIFAe '25", year: "2025", order: 14, national: true },
};

// ---------------------------------------------------------------------------
// Curated knowledge: countries (confident-only) and iconic org buff types
// ---------------------------------------------------------------------------

const COUNTRY = {
  // NA
  kronovi: "US", garrettg: "US", jstn: "US", fireburner: "US", sadjunior: "US",
  jacob: "US", moses: "US", turtle: "US", sizz: "US", rizzo: "US", gimmick: "US",
  torment: "US", chicago: "US", arsenal: "US", retals: "US", sypical: "US",
  mist: "US", atomic: "US", daniel: "US", beastmode: "US", ayyjayy: "US",
  firstkiller: "US", allushin: "US", hockser: "US", rolldizz: "US", comm: "US",
  klassux: "US", zanejackey: "US", chrome: "US", wonder: "US", satthew: "US",
  jknaps: "CA", squishymuffinz: "CA", lachinio: "CA", lethamyr: "CA", corruptedg: "CA",
  // EU
  kuxir97: "IT", markydooda: "GB", m1k3rules: "GB", scrubkilla: "GB", joyo: "GB",
  archie: "GB", apparentlyjack: "GB", noly: "GB", bluey: "GB", speed: "GB",
  kaydop: "FR", fairypeak: "FR", alpha54: "FR", chausette45: "FR", ferra: "FR",
  m0nkeym00n: "FR", extra: "FR", exotiik: "FR", itachi: "FR", vatira: "FR",
  zen: "FR", seikoo: "FR", rise: "FR", marcby8: "FR", kassio: "FR", eversax: "FR",
  aztral: "BE", violentpanda: "NL", remkoe: "NL", joreuz: "NL", greazy: "NL",
  turbopolsa: "SE", mognus: "SE", eyeignite: "SE", al0t: "FI", metsanauris: "FI",
  paschy90: "DE", freakii: "DE", sikii: "DE", oski: "PL", radosin: "CZ",
  ronaky: "ES", atomik: "ES", snaski: "DK",
  // OCE
  deevo: "AU", drippay: "AU", torsos: "AU", kamii: "AU", cjcj: "AU", express: "AU",
  julz: "AU", jake: "AU", decka: "AU", amphis: "AU", fever: "AU", superlachie: "AU",
  bananahead: "AU", scrub: "AU", walcott: "AU", kia: "AU", enigma: "AU",
  // SAM
  caard: "BR", caiotg1: "BR", tander: "BR", renan: "BR", yanxnz: "BR", lostt: "BR",
  drufinho: "BR", stl: "BR", swiftt: "BR", sadness: "BR", kv1: "BR", motta: "BR",
  brad: "BR", suco: "BR", math: "BR", matix: "BR", valt: "BR", repi: "BR",
  pj: "BR", fasi: "BR", nxghtt: "BR", aztromick: "BR", firewall154: "BR",
  kairos: "BR", jato: "BR", brunovisquii: "BR", pekitas: "BR",
  reysbull: "AR", ajg: "AR",
  // MENA
  ahmad: "SA", okhalid: "SA", trk511: "SA", rw9: "SA", kiileerrz: "SA",
  m7sn: "SA", nwpo: "SA", smw: "SA", fahad77: "SA", d7oom24: "SA",
  // APAC
  realize: "JP",
  // SSA
  "2die4": "ZA", snowyy: "ZA", sweaty: "ZA", darth: "ZA", daisyd: "ZA",
  kamz: "ZA", pnidh: "ZA", arceon: "ZA", fefe: "ZA", rxii: "ZA", luiisp: "ZA",
  // v0.5 curation pass (high-confidence only; the rest stay countryless)
  "0verzer0": "US", jwismont: "US", quinnlobdell: "US", kylemasc: "US",
  jzr: "FI", yukeo: "AT", miztik: "GB", jhzer: "DK", nass: "FR", dralii: "FR",
  bymateos: "ES", pauliepaulnl: "NL",
  yumicheeseman: "AU", gus: "AU", bango: "AU", jimmah: "AU", shadey: "AU",
  scarth: "AU", "zen-oce": "AU",
  lawler: "ZA", leoro: "ZA", noxes: "ZA", sweatyclarence: "ZA", torres823: "ZA",

  // ===========================================================================
  // v1.1.5 Liquipedia nationality pass — scripts/fetch-nationalities.mjs audited
  // ALL 300 players against their Liquipedia {{Infobox player}} |country=. This
  // block FILLs the countryless and CORRECTS verified mistakes; being LAST, its
  // keys override the guesses above (al0t FI→SE, deevo AU→GB, radosin CZ→FR,
  // ronaky ES→DK, lawler/leoro/noxes ZA→US/ES/PR, …). Wrong LP matches (a same
  // handle resolving to a different person) were rejected by hand and KEEP their
  // prior values: scrub, greazy, torres823, jhzer, kairos. Region-odd but
  // id-confirmed imports are intentional (APAC/SSA had Western players).
  // Full evidence + per-row status: data-sources/nationalities-audit.md
  // ===========================================================================
  // NA
  "2piece": "US", "allushin": "CA", "axb": "CA", "ayjacks": "US", "blueze": "US",
  "cheese": "US", "chronic": "US", "crr": "ES", "dappur": "US", "darkfire": "US",
  "diaz": "US", "dreaz": "US", "dudewiththenose": "CA", "espeon": "US", "fire": "US",
  "fl0w": "US", "genocop": "US", "gyro": "US", "huskih": "US", "insolences": "US",
  "jahzo": "US", "kofyr": "US", "kovanel": "CA", "laf": "CA", "lj": "US",
  "low5ive": "US", "majicbear": "US", "mala": "US", "matt": "US", "memory": "US",
  "mijo": "US", "mile": "US", "moopy": "US", "napp": "US", "pluto": "US",
  "rawgreg": "US", "reveal": "US", "sadjunior": "CA", "scrzbbles": "US", "syntax": "CH",
  "taroco": "CA", "thundah": "US", "timi": "CA", "turinturo": "US", "wahvey": "US",
  "xpere": "PT", "zach": "US",
  // EU
  "accro": "GB", "acronik": "PT", "al0t": "SE", "atow": "BE", "base": "GB",
  "continuum": "CH", "deboer": "ES", "deevo": "GB", "dmentza": "ES", "dogu": "NL",
  "dorito": "ES", "dralii": "MA", "eclipse": "GB", "eekso": "GB", "ejby": "DK",
  "elgeneral": "AR", "eversax": "BE", "eyeignite": "GB", "flakes": "NL", "flame": "GB",
  "flarke": "SE", "friisisch": "DK", "fruity": "DK", "gawfs": "GB", "gnagflow06": "DE",
  "gregan": "GB", "hugo": "FR", "itachi": "MA", "jessie": "NL", "juicy": "NL",
  "kael": "ES", "kash": "GB", "killerno7": "IT", "m1k3rules": "IE", "maestro": "DK",
  "marcby8": "ES", "mew": "FR", "mognus": "FI", "mout": "FR", "myebipod4shor": "GB",
  "n0ah": "GB", "nass": "MA", "neqzo": "FR", "oaly": "NL", "petrick": "PL",
  "radosin": "FR", "reepex": "CH", "relatingwave": "GB", "rise": "GB", "ronaky": "DK",
  "saizen": "FR", "seeb": "NO", "skyline": "CH", "sniper": "NO", "stizzy": "ES",
  "tadpole": "GB", "tho": "NL", "virge": "US", "vksailen": "ES", "vogan": "NL",
  // OCE
  "fiberr": "AU", "hntr": "AU", "kaka": "AU", "kamii": "NZ", "kennysalmon": "NZ",
  "leduck": "AU", "montyconnor": "NZ", "requiem": "AU", "riv": "AU", "scarth": "NZ",
  "siki": "AU", "spydoge": "AU", "xkorez": "AU", "yeatzy": "AU",
  // SAM
  "aguesome": "AR", "bananaman": "BR", "bemmz": "BR", "droppz": "BR", "firefoxd": "BR",
  "haberkamper": "BR", "michi": "BR", "pekitas": "AR", "reysbull": "CL", "shad": "AR",
  // MENA
  "abdullah": "SA", "ams": "SA", "hisoka": "SA", "senzo": "SA", "twiz": "SA",
  "venom": "SA", "zez0nix": "SA",
  // APAC
  "catalysm": "DE", "commutator": "SG", "kevin": "TH", "lct": "ID", "maxeew": "IE",
  "osm": "IS", "sigms": "US", "sosa": "CA", "sphinx": "MY", "tenhow": "JP",
  "virtuoso": "IE",
  // SSA
  "daisy": "ZA", "happymeal": "ZA", "lawler": "US", "leoro": "ES", "luiisp": "ES",
  "noxes": "PR", "skillsteal": "ZA", "werty": "ZA", "wiiilooo": "FR",

  // ===========================================================================
  // v1.2.0 SAM Top-8 import (regional "SAM Only" mode). High-confidence only;
  // countries read from Liquipedia flags. Already-present SAM keys are NOT
  // repeated (see data-sources/sam-pending/sam-merge-notes.md §4 + §5 dedup).
  // ===========================================================================
  // Brazil
  tibiano: "BR", juan: "BR", dudubrhue: "BR", c4: "BR", noisy: "BR",
  mateusstl: "BR", flasheeyy: "BR", davinsano: "BR", snipjuzo: "BR", leodkn: "BR",
  srforeverplays: "BR", luk: "BR", sword: "BR", ianpinheiro: "BR", zanetti: "BR",
  majowww: "BR", sppyder: "BR", subhallz: "BR", chr1s: "BR", snipjz: "BR",
  bliss: "BR", gian: "BR", kixou: "BR", xoz1n: "BR", yand: "BR", kns: "BR",
  waantz: "BR", pedrokanicastro: "BR", bmendesantos: "BR", wells: "BR",
  klaus: "BR", baait: "BR", alpe: "BR", lag0: "BR", darxtz: "BR", twistt: "BR",
  royales: "BR", wisty: "BR", dappluto: "BR", crn: "BR", kaoshi: "BR",
  patolimpo: "BR", obtth: "BR",
  // Argentina
  szaro: "AR", sempa: "AR", orbi7: "AR", dislike: "AR", lexim: "AR",
  manteca: "AR", tatu: "AR", nachusky: "AR", srnanitou: "AR", aguz: "AR",
  umbroken: "AR", stolen: "AR", farz: "AR", seck: "AR",
  // Chile
  lance: "CL", pansitofrances: "CL", gonk: "CL", deathxplosion: "CL", richy: "CL",
  androzz: "CL", gatox: "CL", pan: "CL", davitrox: "CL", groval: "CL",
  nachosky: "CL",
  // elsewhere
  laayoh: "US", luc: "US", cha0s: "BE",
  // Wings E-Sports easter egg (Season 2) — the creator's own team
  liberatorl: "BR", ninja23509: "BR",
  // v1.2.0 overall-review coach corrections/additions
  adambaguette: "FR", lbp: "AU",
  // v1.4 International-Major expansion — new players/staff (Liquipedia-verified
  // where confirmed: yujin=Liam Daillac FR, Evoh=Jordan Manley US, ASN_RuBiiX=
  // Rubén Santana ES; the rest are region/roster best-effort). A few obscure
  // coaches (arise, crespor, trill) stay countryless until verified.
  yujin: "FR", evoh: "US", asnrubiix: "ES", finn: "AU", rezears: "AU",
  andy: "US", olpix: "JP", burn: "JP", mikan: "JP", ivn: "DE", rizex45: "DE",
  nick: "US", fernando: "AU", nunki: "JP", bo0odi44: "SA", mesho: "SA",
  byjesuxesp: "ES",
  // v1.4 SAM regional expansion — NEW players only (Black Dragons / Cadê Meu
  // Boost / NoX Gaming 2016 + Plot Twist / Bigode / BS+Competition 2026).
  // Existing SAM keys above are reused (crn, kv1, wisty, royales, motta,
  // drufinho, bemmz, nxghtt, firefoxd, juan, kaoshi, michi, stolen, caiotg1,
  // lance=CL, sosa). thekillah=AR, the rest BR.
  freedom: "BR", godan: "BR", krames: "BR", duo: "BR",
  saladk1ng: "BR", magomagnifico: "BR", ze: "BR",
  thekillah: "AR",
  // v2.0 base export (rocket-draft-database, 2026-10-26): new players + six
  // corrections (diaz BR, greazy NO, ivn AT, juicy FR, rezears DE, torres823
  // ES). Appended last on purpose — a key repeated below wins over the
  // earlier entry, so these corrections override the older guesses above.
  arise: "DE", crespor: "SA", diaz: "BR", fireworks: "US", ghaazi0: "SA", greazy: "NO",
  impulse: "BR", ivn: "AT", juicy: "FR", pluoh: "US", rezears: "DE", roken: "GB",
  speedhack: "BR", torres823: "ES", trill: "US", mits: "US", ghost: "AU", percy: "US",
  jordan: "CA", creamz: "GB", lucas06: "BR", grumpz: "BR", john: "BR", godsmilla: "DE",
  snowy: "AU", tango: "AU", vortexioz: "AU", wondamike: "US", tristn: "US", subn: "US",
  mittaen: "NL", arju: "IT", andythemandy: "GB", magiczzz: "DE", mk: "DE", misty: "AU",
  vive: "AU", cavemanben: "AU", zayd: "AU", lethalforlife: "AU", simple: "CA", flexxy17: "BR",
  radoko: "CA", zps: "MX", mclando: "US", flitz: "US", scruffy: "AU", mikeboy: "NL",
  oscillon: "NL", lyaneii: "NL", rapid: "US", hawpsu: "US", tox: "DE", yagi: "CH",
  kerian: "FR", yukiss: "FR", finish: "FR", porto: "FR", shock: "US", tcorrell: "US",
  pocketpsych: "AU", hibbs: "GB", breezi: "GB", stealth: "GB", calix: "DE", jnr: "GB",
  stake: "ES", zamue: "ES", arleyobi: "ES", wolf: "ES", t7lm: "SA", suspect: "SA",
  black: "SA", b2sel: "SA", beastbound: "NL", s1kies: "SA", parka: "FR", forece: "FR",
  gil2: "FR", ix: "SA", fahad: "SA", marwan: "SA", errorless: "SA", aqua: "US",
  billy: "GB", maru: "JP", msh: "SA", chikage: "SA", mj: "SA", growlii: "GB",
  rehzzy: "GB", nugget: "GB", s5cosmic: "US", smokez: "GB", mrlow: "ZA", arceon: "ZA",
  fishhr: "US", physics: "ZA", epicjonny: "CA", lionblaze: "US", zineel: "US", didi: "US",
  kinseh: "US", paarth: "US", rmn: "AR", crs: "UY", cpzebra: "ZA", rizex: "DE",
  misery: "AR", rez: "AU", compact: "BE", ldc: "BE", braan: "ES", toxiic: "GB",
  audrax: "MA", rafa: "PT", beyond: "PT", vadyy: "PT", ordep: "PT", zgocbrayt: "TR",
  lorely: "TR", jzmmm: "TR", andeque: "TR", ballerrees: "SG", kroado: "JP", datalied: "GB",
  drku: "GB", drknown: "SA", nush: "SA", idris: "AF", noone: "SA", grayson: "US",
  mazikeen: "AR", porsas: "FI", regser: "FI", dansku: "FI", txl: "FI", furlashh: "JP",
  homie: "AU", tehqoz: "ES", shorez: "AU", trook: "SA", m7md: "KW", sqqp: "SA",
  mysterious: "SA", z4: "SA", meshal: "SA", blue: "MY", risk: "SG", lunar: "US",
  loofoo: "US", vantage: "FR", gunz: "ZA", duggy: "AU", rysfox: "BE", dudsmelow: "BR",
  davoof: "IT", hyderr: "IT", laru: "IT", "misty-my": "MY", skyrix: "MA", miki: "BE",
  wozyen: "NO", jup: "NO", bruhkay: "NO", kasper: "NO", "abdullah-om": "OM", lumber: "OM",
  sultan: "OM", "3tiqi": "OM", jeff: "ZA", ravi: "ZA", slayer: "US", caleb: "NZ",
  dx7: "NZ", fiv3up: "US", bora: "US", ops: "SA", ltxsam: "IE", bibbaba: "HU",
  valid: "SA", nai: "JP", vinlll: "JP", mtzr: "FR", ekon: "FR", mech: "US",
  life: "US", armonik: "ES", laxin: "NZ", kekkles: "AU", nerve: "AU", evohpaniniwine: "AU",
  hawk: "AU", prompt: "AU", elliott: "AU", frost: "US", pengoli: "AU", taha: "US",
  karion: "CA", kevinacho: "AR", giuk: "FR", nico: "DK", fades: "TR", tawk: "CA",
};

/**
 * Real birth dates (v2.0 base export, from PandaScore), keyed by the FINAL
 * person id (after PERSON_ID). Written to players.json as `birthday`; the
 * career derives ages from it (engine/career/development.ts deriveBirthYear)
 * and only rolls a debut age for players without one.
 */
const BIRTHDAY = {
  "2die4": "2005-06-03", "2piece": "2006-05-17", abdullah: "2008-06-30", "abdullah-om": "2007-11-21",
  accro: "2005-02-22", acronik: "2005-07-07", aguz: "2004-12-10", ahmad: "2002-11-18",
  ajg: "2004-06-19", al0t: "1997-03-31", allushin: "1999-09-03", alpe: "2003-01-11",
  alpha54: "2003-06-27", amphis: "2003-07-21", ams: "2001-01-06", andy: "2004-04-01",
  apparentlyjack: "2003-09-23", aqua: "2006-12-21", archie: "2005-03-11", arju: "2002-11-04",
  arsenal: "2002-03-16", asnrubiix: "2003-01-09", atomic: "2003-08-12", atomik: "2004-10-01",
  atow: "2007-02-22", axb: "1995-09-19", ayjacks: "2001-05-13", ayyjayy: "2002-12-10",
  aztral: "2002-12-26", aztromick: "2004-05-15", b2sel: "2003-11-28", ballerrees: "2002-10-11",
  bananahead: "2006-01-23", beastmode: "2005-08-03", bemmz: "2006-06-05", beyond: "2007-07-09",
  bibbaba: "2010-09-22", billy: "2000-08-31", blue: "2002-02-10", bluey: "2001-12-11",
  brad: "2004-11-01", breezi: "2002-06-21", bruhkay: "2005-09-25", brunovisquii: "1999-01-02",
  burn: "2003-10-07", caard: "2003-08-01", caiotg1: "2001-05-20", caleb: "2006-03-14",
  calix: "2002-02-20", catalysm: "2002-02-15", cavemanben: "2000-05-05", chausette45: "2001-03-16",
  cheese: "2005-06-15", chicago: "2001-06-12", chrome: "1993-03-29", chronic: "2005-09-05",
  cjcj: "1998-08-06", comm: "2003-10-01", compact: "2004-10-20", crr: "2005-09-15",
  d7oom24: "2003-08-03", daisy: "2004-11-01", daniel: "2006-12-05", dansku: "2003-11-19",
  dappluto: "2005-10-07", dappur: "1999-02-22", darth: "2002-12-27", davinsano: "2002-01-21",
  davitrox: "2004-09-21", davoof: "2005-07-27", decka: "1999-09-11", deevo: "2000-06-12",
  diaz: "2008-07-15", dmentza: "2001-10-19", dorito: "2004-02-19", dralii: "2007-10-06",
  dreaz: "2006-03-09", drippay: "2000-03-09", drknown: "2009-11-17", drku: "2006-11-03",
  droppz: "2003-10-20", drufinho: "2005-06-28", dudsmelow: "2003-06-09", eclipse: "1999-05-26",
  eekso: "2002-06-29", ejby: "2003-09-28", ekon: "2000-04-27", elliott: "2005-07-17",
  eversax: "1996-06-24", evoh: "2007-05-12", exotiik: "2002-10-31", express: "1998-08-22",
  extra: "2001-11-12", eyeignite: "1996-04-23", fades: "2007-03-07", fahad: "2005-06-04",
  fairypeak: "1998-05-26", fasi: "2000-11-24", ferra: "1996-10-31", fever: "2004-12-06",
  fiberr: "2005-03-18", finn: "2003-06-02", fire: "1999-06-28", fireburner: "1997-10-18",
  firefoxd: "2001-11-15", firewall154: "2001-02-16", firstkiller: "2004-12-19", fiv3up: "2006-07-11",
  flakes: "2000-02-12", flame: "1999-09-27", flasheeyy: "2003-12-27", flitz: "2003-12-17",
  forece: "2002-12-14", freakii: "1996-08-02", fruity: "1996-02-22", furlashh: "2005-05-13",
  garrettg: "2001-02-06", gawfs: "2005-12-15", ghaazi0: "2005-10-14", ghost: "1998-08-25",
  gimmick: "2000-06-30", giuk: "2006-03-22", gnagflow06: "1999-10-26", godsmilla: "2000-02-16",
  gonk: "2000-07-26", greazy: "1996-04-05", growlii: "2004-12-29", gunz: "2006-11-06",
  gyro: "2002-10-13", haberkamper: "2001-01-27", happymeal: "1999-10-13", hawk: "2005-11-25",
  hibbs: "2003-07-01", hisoka: "2005-09-17", hntr: "2007-08-14", hockser: "2002-01-23",
  homie: "2002-08-02", hyderr: "2002-10-31", ianpinheiro: "2002-06-13", itachi: "2003-08-13",
  ivn: "2003-06-21", ix: "2006-09-10", jacob: "1997-07-01", jake: "1997-11-24",
  jessie: "1996-11-04", jknaps: "1999-09-30", jnr: "1999-04-03", jordan: "2002-07-29",
  joreuz: "2005-03-08", joyo: "2005-12-25", jstn: "2002-08-05", juan: "2001-11-23",
  juicy: "2005-03-05", julz: "2001-02-03", jup: "2006-02-09", jwismont: "1998-12-22",
  jzr: "1996-08-18", kael: "1995-06-12", kaka: "2003-11-19", kamii: "2000-09-21",
  kash: "2001-10-30", kassio: "2001-04-24", kaydop: "1998-05-22", kennysalmon: "2002-02-05",
  kerian: "2003-08-21", kevin: "2004-07-25", kevinacho: "2009-09-10", kiileerrz: "2007-06-10",
  kinseh: "2003-08-05", klaus: "2004-12-16", kns: "2004-01-02", kofyr: "2007-05-02",
  kronovi: "1997-08-30", kuxir97: "1997-02-19", kv1: "2006-02-20", lance: "1999-10-13",
  laxin: "2004-04-03", lct: "2002-08-18", leduck: "2001-04-20", leodkn: "2002-10-17",
  leoro: "2002-06-26", lethamyr: "1995-03-31", lexim: "1999-01-14", life: "2009-03-05",
  lionblaze: "2003-12-30", lj: "2005-04-23", lorely: "2003-05-21", lostt: "2005-03-29",
  luiisp: "2003-12-11", luk: "2003-09-29", lumber: "2002-05-10", m0nkeym00n: "2002-11-15",
  m7md: "2009-11-05", m7sn: "2005-06-03", majicbear: "2004-12-25", mala: "2002-02-28",
  marcby8: "2001-03-27", math: "2002-10-05", matix: "2002-11-13", maxeew: "2003-06-28",
  mazikeen: "2007-04-21", mech: "2010-12-28", memory: "2002-01-18", metsanauris: "1998-12-12",
  mikan: "2000-12-04", mikeboy: "2002-05-04", mile: "2001-11-21", misery: "2007-12-11",
  mist: "2003-08-22", misty: "2002-03-05", "misty-my": "2000-06-14", mittaen: "2001-08-19",
  miztik: "1996-06-01", mognus: "1999-12-07", moses: "1996-02-10", motta: "2006-10-11",
  mout: "1995-07-31", mtzr: "2006-11-25", mysterious: "2003-07-06", nachosky: "2005-01-10",
  nai: "2008-05-29", nass: "2007-01-12", neqzo: "1998-08-31", nico: "2008-12-12",
  noisy: "2001-09-11", noly: "2002-02-02", noxes: "2000-05-08", nush: "2009-11-15",
  nwpo: "2007-01-15", nxghtt: "2006-07-04", oaly: "2003-11-24", okhalid: "2002-12-19",
  olpix: "2001-12-18", ops: "2009-05-29", oscillon: "2001-06-07", oski: "2007-02-23",
  osm: "2003-09-19", paarth: "2005-04-13", pan: "2002-11-08", parka: "2004-05-27",
  percy: "2003-12-02", pj: "2002-10-20", porsas: "2003-05-27", prompt: "2008-11-09",
  radoko: "2003-05-08", radosin: "2004-01-12", rafa: "2007-06-05", rapid: "2002-02-05",
  realize: "2001-05-03", regser: "2003-07-14", rehzzy: "2004-04-25", relatingwave: "2002-09-16",
  remkoe: "1995-05-27", renan: "2003-03-19", repi: "2002-02-08", retals: "2003-01-02",
  reveal: "2007-06-18", reysbull: "2004-02-20", rezears: "2003-08-29", rise: "2004-09-05",
  risk: "2011-03-05", riv: "1998-04-08", rizex45: "2002-04-30", rizzo: "1997-05-26",
  rolldizz: "1996-09-06", ronaky: "2000-09-21", royales: "2005-05-17", rw9: "2007-06-10",
  rysfox: "2007-09-21", s5cosmic: "2006-07-14", sadjunior: "1997-09-20", sadness: "2005-09-08",
  saizen: "2005-10-21", satthew: "1999-04-29", scarth: "1999-12-20", scrub: "2005-09-02",
  scrubkilla: "2003-05-08", scrzbbles: "2009-11-05", seck: "2005-06-03", seeb: "2002-09-17",
  seikoo: "2004-06-07", senzo: "2001-05-28", shad: "2003-08-08", shock: "1999-12-17",
  shorez: "2006-01-11", sigms: "1998-09-11", siki: "1999-09-17", sizz: "1996-11-05",
  skillsteal: "1996-11-14", skyrix: "2005-08-01", smokez: "2004-01-24", smw: "2004-08-11",
  snipjz: "2003-04-23", snowy: "1995-06-13", snowyy: "2000-07-12", sosa: "2004-03-15",
  speed: "2001-02-26", sphinx: "2009-01-14", spydoge: "2000-12-20", sqqp: "2006-05-22",
  squishymuffinz: "2000-11-29", srnanitou: "2002-06-04", stake: "2000-07-20", stizzy: "2006-12-27",
  suco: "2006-05-15", sultan: "2008-10-16", superlachie: "2005-10-16", sweaty: "2005-08-07",
  swiftt: "2008-08-15", sword: "2002-05-14", sypical: "2003-08-05", t7lm: "2002-08-01",
  tadpole: "1997-10-17", tander: "1998-12-31", tango: "2004-05-05", taroco: "2003-02-22",
  tawk: "2007-08-22", tcorrell: "2001-02-08", tehqoz: "2006-03-14", tenhow: "2000-09-20",
  tho: "2001-12-04", thundah: "2001-07-07", torment: "2000-06-06", torres823: "2004-09-22",
  torsos: "2000-08-30", tox: "2003-07-08", toxiic: "2004-06-17", tristn: "2000-11-08",
  trk511: "2005-07-26", turbopolsa: "1998-08-09", turinturo: "2003-04-08", twistt: "2003-12-28",
  twiz: "2004-02-09", umbroken: "2002-06-14", vadyy: "2008-06-20", valt: "2003-10-22",
  vatira: "2006-05-14", venom: "2002-08-11", violentpanda: "1998-11-02", virge: "1996-09-24",
  virtuoso: "2003-08-21", vksailen: "2003-06-07", vortexioz: "2004-05-10", wahvey: "2007-05-10",
  walcott: "1997-02-06", wells: "2003-01-24", wisty: "2006-01-03", wolf: "1998-02-25",
  wondamike: "2004-05-25", wonder: "1996-08-02", yand: "2003-02-28", yanxnz: "2004-08-10",
  yujin: "2007-11-27", yukeo: "2000-01-26", yukiss: "2000-07-26", zach: "2009-11-05",
  zamue: "2000-10-19", zanetti: "2001-12-21", zayd: "2001-12-06", zen: "2007-02-20",
  zez0nix: "2002-11-17", zgocbrayt: "1997-05-19", zineel: "2005-03-01", zps: "2004-03-22",
};

const ORG_BUFF_TYPE = {
  "g2-esports": "offense",
  "g2-stride": "offense",
  "nrg-esports": "experience",
  cloud9: "clutch",
  "team-vitality": "mechanics",
  "team-bds": "consistency",
  furia: "mechanics",
  "team-falcons": "clutch",
  "karmine-corp": "offense",
  "spacestation-gaming": "consistency",
  "faze-clan": "offense",
  dignitas: "experience",
  "moist-esports": "mechanics",
  "flipsid3-tactics": "consistency",
  ibuypower: "offense",
  "twisted-minds": "clutch",
  "gentle-mates-alpine": "mechanics",
  "gen-g-mobil1-racing": "consistency",
  "gale-force-esports": "mechanics",
};

const BUFF_SYMBOLS = ["~", "+", "++", "+++"];

/**
 * Same ORGANIZATION, different spellings / sponsor names across seasons —
 * unify the org id so org-history chemistry connects eras. Lineups keep the
 * era display name ("Renault Vitality" still shows on S7 cards).
 */
const ORG_ALIAS = {
  "chiefs-esc": "chiefs-esports-club",
  "team-dignitas": "dignitas",
  "renault-vitality": "team-vitality",
  "mockit-esports": "mock-it-esports",
  "mock-it-esports-eu": "mock-it-esports",
  "quiktrip-pioneers-gaming": "pioneers",
  // v2.0 national teams: the base (rocket-draft-database) names them in
  // Portuguese; the alias pins each to its `national-<iso>` id, shared with
  // the base. Display names come from NATIONAL_TEAM_NAMES below.
  "africa-do-sul": "national-za",
  alemanha: "national-de",
  "arabia-saudita": "national-sa",
  argentina: "national-ar",
  australia: "national-au",
  belgica: "national-be",
  brasil: "national-br",
  chile: "national-cl",
  espanha: "national-es",
  "estados-unidos": "national-us",
  franca: "national-fr",
  inglaterra: "national-gb-eng",
  marrocos: "national-ma",
  "paises-baixos": "national-nl",
  portugal: "national-pt",
  turquia: "national-tr",
  italia: "national-it",
  malasia: "national-my",
  noruega: "national-no",
  oma: "national-om",
};

/**
 * English display name per national team (v2.0). The data is English like the
 * rest of the dataset (org names, countryName()); teams.md keeps the base's
 * Portuguese team lines so both projects share the same blocks and ids.
 */
const NATIONAL_TEAM_NAMES = {
  "national-za": "South Africa",
  "national-de": "Germany",
  "national-sa": "Saudi Arabia",
  "national-ar": "Argentina",
  "national-au": "Australia",
  "national-be": "Belgium",
  "national-br": "Brazil",
  "national-cl": "Chile",
  "national-es": "Spain",
  "national-us": "United States",
  "national-fr": "France",
  "national-gb-eng": "England",
  "national-ma": "Morocco",
  "national-nl": "Netherlands",
  "national-pt": "Portugal",
  "national-tr": "Türkiye",
  "national-it": "Italy",
  "national-my": "Malaysia",
  "national-no": "Norway",
  "national-om": "Oman",
};

/**
 * Homonyms (v2.0): "nick|orgId" (or "nick|REGION") → person id, for different
 * people who share a nickname. Checked org first, then region.
 */
const PERSON_ID = {
  // OCE "ZeN" (Renegades S7) is NOT the French superstar.
  "zen|OCE": "zen-oce",
  "misty|national-my": "misty-my",
  "abdullah|national-om": "abdullah-om",
};

/**
 * Same NAME, different organizations (one per region) — keep them apart so
 * chemistry doesn't link strangers (OCE Pioneers ≠ SSA Pioneers).
 */
const REGION_SPLIT_ORGS = new Set(["pioneers", "fut-esports"]);

/**
 * ===========================================================================
 * MULTIPLE LOGOS PER ORG ("logo eras") — how to add them (v0.5.1, guide v1.1.0)
 * ===========================================================================
 *
 * Many orgs rebrand over time (NRG changed logo in 2017, 2019, 2020, 2024).
 * You can give ONE org different logos depending on the season of the card.
 *
 * HOW IT WORKS
 *   - A card uses  public/orgs/<orgId>@<key>.png  when its season is on or
 *     before that era's `until` boundary; otherwise it uses the default
 *     public/orgs/<orgId>.png.
 *   - So the DEFAULT file (no @key) is always the CURRENT / newest logo, and
 *     each entry below covers one OLDER logo era.
 *   - Missing image files fall back gracefully (older era -> default ->
 *     monogram), so nothing breaks if a PNG isn't there yet.
 *
 * TO ADD LOGOS FOR AN ORG (3 steps)
 *   1) Add one entry per OLD logo, OLDEST FIRST (ascending `until`). `key` is
 *      any short label YOU pick (it becomes part of the filename); `until` is
 *      the LAST season that old logo was used — a SEASON KEY from the cheat
 *      sheet below. The newest logo gets NO entry (it's the default file).
 *      => N logos = (N - 1) entries here + 1 default <orgId>.png file.
 *   2) Run  npm run build:data  (this also rewrites public/orgs/README.md with
 *      the exact filenames to use).
 *   3) Drop the PNGs into public/orgs/ using those exact names.
 *
 * SEASON KEY cheat sheet  (key = calendar year):
 *   S1,S2 = 2016 | S3,S4 = 2017 | S5,S6 = 2018 | S7,S8 = 2019 | S9 = 2020 |
 *   "RLCS X" = 2020-21 | "2021-22" | "2022-23" | "2024" | "2025" | "2026"
 *
 * EXAMPLE — NRG, logos changing in 2017 / 2019 / 2020 / 2024 (5 eras = 4
 * entries + the current default nrg-esports.png). Tweak the boundaries to the
 * real logo history, then drop nrg-esports@2016.png ... and nrg-esports.png:
 *   "nrg-esports": [
 *     { key: "2016", until: "S2" },      // first logo, through 2016
 *     { key: "2017", until: "S6" },      // 2017 logo, through 2018
 *     { key: "2019", until: "S8" },      // 2019 logo, through 2019
 *     { key: "2020", until: "2022-23" }, // 2020 logo, through 2023
 *   ],                                   // 2024+ logo = default nrg-esports.png
 *
 * (`npm run fetch:assets` can also pull exact Liquipedia files via the
 * "orgFiles" block in data-sources/asset-overrides.json.)
 */
const ORG_LOGO_ERAS = {
  // Big historic orgs that changed identity mid-history. Each entry's `@key`
  // PNG wears the OLDER logo for seasons on/before `until`; the default
  // <orgId>.png is always the CURRENT logo. Era PNGs are pulled via the
  // "orgFiles" overrides (exact Liquipedia File: titles) or dropped by hand;
  // missing era files fall back to the default, so nothing breaks meanwhile.
  // (Liquipedia file titles for each key live in data-sources/asset-overrides.json.)
  //
  // NRG ran five logos across its S2→2026 RLCS span: the 2016 "NRG eSports",
  // the 2017, 2019 and 2020 marks, and the 2024 rebrand (the default file).
  "nrg-esports": [
    { key: "2016", until: "S2" },
    { key: "2017", until: "S6" },
    { key: "2019", until: "S8" },
    { key: "2020", until: "2022-23" },
  ],
  // Dignitas wore its 2018 logo at the S5 title; current is the 2025 rebrand.
  dignitas: [{ key: "2018", until: "S9" }],
  // Spacestation won 2021-22 Worlds under its 2021 logo; rebranded in 2023.
  "spacestation-gaming": [{ key: "2021", until: "2021-22" }],
  // Team Vitality's earlier bee (through the 2019 Renault era) vs the modern crest.
  "team-vitality": [{ key: "2018", until: "S8" }],
};

function orgIdOf(name, region) {
  const slug = slugOf(name);
  const id = ORG_ALIAS[slug] ?? slug;
  return REGION_SPLIT_ORGS.has(id) ? `${id}-${region.toLowerCase()}` : id;
}

// ---------------------------------------------------------------------------
// Parse teams.md
// ---------------------------------------------------------------------------

const lines = src.split(/\r?\n/);
let currentRegion = null;
const rawTeams = [];
let block = null;

for (const line of lines) {
  const regionMatch = line.match(/^###\s+([A-Z]+)\s*$/);
  if (regionMatch) currentRegion = regionMatch[1];

  if (line.startsWith("```team:")) {
    block = { region: currentRegion, teamLine: line.replace(/^```team:\s*/, "").trim(), rows: [] };
    continue;
  }
  if (block) {
    if (line.startsWith("```")) {
      rawTeams.push(block);
      block = null;
    } else if (line.trim()) {
      block.rows.push(line.trim());
    }
  }
}

function parsePersonEntry(value) {
  // "Nick With Spaces 87" → { nick, overall }; "-" → null; "A 57 / B 56" → first.
  const first = value.split("/")[0].trim();
  if (!first || first === "-") return null;
  const match = first.match(/^(.*\S)\s+(\d{2})$/);
  if (!match) throw new Error(`Cannot parse person entry: "${value}"`);
  return { nick: match[1].trim(), overall: Number(match[2]) };
}

const teams = rawTeams.map((raw) => {
  const parts = raw.teamLine.split("·").map((s) => s.trim());
  const [orgName, seasonKeyRaw] = parts;
  const seasonKey = seasonKeyRaw;
  // v2.0 "recorte" (cut): a SECOND roster of the same org in the same season
  // carries "· recorte: <name>" on the team line; the name joins the lineup id
  // (northern-gaming-s3-maestro) so it can't collide with the first roster.
  // Blocks without the segment keep their ids unchanged.
  const cut =
    parts.find((p) => /^recorte:/i.test(p))?.replace(/^recorte:\s*/i, "").trim() || null;
  const season = SEASONS[seasonKey];
  if (!season) throw new Error(`Unknown season "${seasonKey}" in team "${raw.teamLine}"`);
  if (!raw.region) throw new Error(`Team without region: ${raw.teamLine}`);

  const get = (prefix) =>
    raw.rows.find((r) => r.toLowerCase().startsWith(prefix))?.split(/:(.*)/s)[1]?.trim() ?? "-";

  const players = [1, 2, 3].map((n) => {
    const entry = parsePersonEntry(get(`player ${n}`));
    if (!entry) throw new Error(`Missing player ${n} in ${raw.teamLine}`);
    return entry;
  });

  const sub = parsePersonEntry(get("sub"));
  const coach = parsePersonEntry(get("coach"));

  const orgRaw = get("org");
  const buffMatch = orgRaw.match(/\s(~|\+{1,3})\s*$/);
  const orgBuffLevel = buffMatch ? buffMatch[1] : "~";
  const orgDisplay = buffMatch ? orgRaw.slice(0, buffMatch.index).trim() : orgRaw.trim();
  if (slugOf(orgDisplay) !== slugOf(orgName)) {
    // Org line and team line should agree; trust the team line for display.
  }

  // Flags (v1.2.0): `sam-only` = a REGION-ONLY roster (v2.0: any region, the
  // name is historical; `region-only` is accepted too) — excluded from the
  // general draft and the general opponent field, shown only in its region's
  // Region-only mode; `rare` = easter-egg lineup drawn far less often. `legacy`
  // = a regional landmark roster whose raw overalls sit below the strong/elite
  // cut but that should still headline its region's legacy gauntlet (floors
  // historicalStrength at "strong" below). Flags are comma-separated; unknown
  // flags are ignored.
  const flagRaw = get("flag");
  const samOnly = /\b(sam|region)-only\b/i.test(flagRaw);
  const rareSpawn = /\brare\b/i.test(flagRaw);
  const legacy = /\blegacy\b/i.test(flagRaw);

  return { orgName, orgDisplay: orgDisplay || orgName, season, cut, region: raw.region, players, sub, coach, orgBuffLevel, samOnly, rareSpawn, legacy };
});

// ---------------------------------------------------------------------------
// Registries
// ---------------------------------------------------------------------------

const persons = new Map(); // key → { id, nickname, country?, birthday?, region, lastOrder }
function registerPerson(nick, region, seasonOrder, orgId) {
  const base = personKeyOf(nick);
  // Homonyms (PERSON_ID): same nickname, different people — org first, then region.
  const key = PERSON_ID[`${base}|${orgId}`] ?? PERSON_ID[`${base}|${region}`] ?? base;
  const existing = persons.get(key);
  if (!existing) {
    persons.set(key, {
      id: key,
      nickname: nick,
      country: COUNTRY[key],
      birthday: BIRTHDAY[key],
      region,
      lastOrder: seasonOrder,
    });
  } else if (seasonOrder >= existing.lastOrder) {
    existing.nickname = nick; // latest branding wins (e.g. "jstn.")
    existing.lastOrder = seasonOrder;
  }
  return key;
}

const orgs = new Map(); // slug → { id, name, region, buffLevelMax, lastOrder }
function registerOrg(rawName, region, buffLevel, seasonOrder) {
  const id = orgIdOf(rawName, region);
  const name = NATIONAL_TEAM_NAMES[id] ?? rawName;
  const existing = orgs.get(id);
  const levelIdx = BUFF_SYMBOLS.indexOf(buffLevel);
  if (!existing) {
    orgs.set(id, { id, name, region, buffLevelMax: levelIdx, lastOrder: seasonOrder });
  } else {
    existing.buffLevelMax = Math.max(existing.buffLevelMax, levelIdx);
    if (seasonOrder >= existing.lastOrder) {
      existing.name = name;
      existing.lastOrder = seasonOrder;
    }
  }
  return id;
}

// ---------------------------------------------------------------------------
// Build entities
// ---------------------------------------------------------------------------

const playerCards = [];
const coachCards = [];
const subCards = [];
const lineups = [];

for (const team of teams) {
  const orgId = registerOrg(team.orgDisplay, team.region, team.orgBuffLevel, team.season.order);
  const lineupId = `${orgId}-${team.season.slug}${team.cut ? `-${slugOf(team.cut)}` : ""}`;
  if (lineups.some((l) => l.id === lineupId)) {
    throw new Error(`Duplicate lineup id ${lineupId}`);
  }
  // A national-team season must resolve every team to a national-<iso> org with
  // an English name — a new country needs ORG_ALIAS + NATIONAL_TEAM_NAMES.
  const national = Boolean(team.season.national);
  if (national && !NATIONAL_TEAM_NAMES[orgId]) {
    throw new Error(
      `National team "${team.orgDisplay}" (${team.season.label}) resolved to "${orgId}" — add it to ORG_ALIAS and NATIONAL_TEAM_NAMES`,
    );
  }
  if (!national && orgId.startsWith("national-")) {
    throw new Error(`"${team.orgDisplay}" is a national team outside a national season (${team.season.label})`);
  }

  const playerCardIds = team.players.map((p) => {
    const personId = registerPerson(p.nick, team.region, team.season.order, orgId);
    const cardId = `${personId}-${lineupId}`;
    playerCards.push({
      id: cardId,
      playerId: personId,
      orgId,
      lineupId,
      seasonId: team.season.id,
      overall: p.overall,
      manualAdjustment: 0,
    });
    return cardId;
  });

  let coachId;
  if (team.coach) {
    const personId = registerPerson(team.coach.nick, team.region, team.season.order, orgId);
    coachId = `${personId}-coach-${lineupId}`;
    const person = persons.get(personId);
    coachCards.push({
      id: coachId,
      personId,
      name: team.coach.nick,
      country: person.country,
      region: team.region,
      orgId,
      lineupId,
      seasonId: team.season.id,
      overall: team.coach.overall,
      bonusType: STATS[hash(personId) % STATS.length],
      bonusLevel: team.coach.overall >= 85 ? "++" : team.coach.overall >= 75 ? "+" : "~",
    });
  }

  let subId;
  if (team.sub) {
    const personId = registerPerson(team.sub.nick, team.region, team.season.order, orgId);
    subId = `${personId}-sub-${lineupId}`;
    const person = persons.get(personId);
    subCards.push({
      id: subId,
      personId,
      name: team.sub.nick,
      country: person.country,
      region: team.region,
      orgId,
      lineupId,
      seasonId: team.season.id,
      overall: team.sub.overall,
    });
  }

  const avg = team.players.reduce((s, p) => s + p.overall, 0) / 3;
  const derivedStrength =
    avg >= 91 ? "elite" : avg >= 87 ? "strong" : avg >= 82 ? "solid" : "underdog";
  // A `legacy`-flagged roster is floored at "strong" so the difficulty-based
  // opponent sampler (balance.ts → opponentTierWeights) surfaces it in the
  // legacy gauntlet — without inflating the raw overalls. Never downgrades a
  // naturally-elite lineup. Only weights opponents; never touches the draft pool.
  const historicalStrength =
    team.legacy && derivedStrength !== "elite" ? "strong" : derivedStrength;

  lineups.push({
    id: lineupId,
    name: NATIONAL_TEAM_NAMES[orgId] ?? team.orgDisplay,
    seasonId: team.season.id,
    orgId,
    region: team.region,
    playerCardIds,
    ...(coachId ? { coachId } : {}),
    ...(subId ? { subId } : {}),
    ...(team.samOnly ? { samOnly: true } : {}),
    ...(team.rareSpawn ? { rareSpawn: true } : {}),
    ...(national ? { national: true } : {}),
    orgBuffLevel: team.orgBuffLevel,
    historicalStrength,
  });
}

const playersOut = [...persons.values()]
  .map((p) => ({
    id: p.id,
    nickname: p.nickname,
    ...(p.country ? { country: p.country } : {}),
    ...(p.birthday ? { birthday: p.birthday } : {}),
    region: p.region,
  }))
  .sort((a, b) => a.id.localeCompare(b.id));

const orgsOut = [...orgs.values()]
  .map((o) => ({
    id: o.id,
    name: o.name,
    region: o.region,
    buffType: ORG_BUFF_TYPE[o.id] ?? STATS[hash(o.id) % STATS.length],
    buffLevel: BUFF_SYMBOLS[Math.max(0, o.buffLevelMax)],
    ...(ORG_LOGO_ERAS[o.id]
      ? {
          logoEras: ORG_LOGO_ERAS[o.id].map(({ key, until }) => {
            const season = SEASONS[until];
            if (!season) throw new Error(`ORG_LOGO_ERAS: unknown season "${until}" for ${o.id}`);
            return { key, untilOrder: season.order };
          }),
        }
      : {}),
  }))
  .sort((a, b) => a.id.localeCompare(b.id));

const seasonsOut = Object.values(SEASONS)
  .sort((a, b) => a.order - b.order)
  .map(({ id, label, shortLabel, year, order }) => ({ id, label, shortLabel, year, order }));

// ---------------------------------------------------------------------------
// Special cards (transcribed from data-sources/specials-reference.md v3)
// Their rarity tiers map to the game's visual tiers:
//   legendary → legendary · worlds_mvp → mythic · major_mvp → epic
//   mythic → mythic · moment → rare
// Their cardType maps: legacy → legend · mvp → worlds_mvp/major_mvp · moment.
// Coach cards keep kind:"coach" and use team_attribute_boost.
// ---------------------------------------------------------------------------

/**
 * LEGACY REFERENCE ONLY (since v1.1.0). This catalogue is NO LONGER written to
 * src/data/specialCards.json — that file is now HAND-MAINTAINED (like
 * achievements.json), so `npm run build:data` never overwrites the hand-edited
 * cards. It is kept here only as the original launch-set source. To add or edit
 * a special card, edit src/data/specialCards.json directly, then run
 * `npm run validate:data`. Changes made HERE no longer affect the game.
 *
 * base: [orgSlug, seasonSlug] hint resolving the card the special replaces.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept as reference; specialCards.json is hand-maintained (see note above)
const SPECIALS = [
  // -- Legendary legacy (99s) --
  { id: "sp-kronovi-first-world-champion", p: "kronovi", base: ["ibuypower", "s1"], title: "First World Champion", type: "legend", rarity: "legendary", overall: 99,
    stats: { offense: 96, defense: 91, mechanics: 94, consistency: 97, experience: 99, clutch: 98 },
    fx: { attributes: ["experience", "clutch"], value: 5, description: "+5 experience and clutch." },
    flavor: "Season 1 champion with iBUYPOWER Cosmic and one of the first defining names of competitive Rocket League." },
  { id: "sp-kuxir97-pinch-god", p: "kuxir97", base: ["flipsid3-tactics", "s2"], title: "Pinch God", type: "legend", rarity: "legendary", overall: 99,
    stats: { offense: 96, defense: 94, mechanics: 99, consistency: 97, experience: 99, clutch: 97 },
    fx: { attributes: ["mechanics", "experience"], value: 5, description: "+5 mechanics and experience." },
    flavor: "A Season 2 World Champion and Worlds MVP who helped define early Rocket League mechanics before the modern meta existed." },
  { id: "sp-turbopolsa-four-time-world-champion", p: "turbopolsa", base: ["team-dignitas", "s5"], title: "Four-Time World Champion", type: "legend", rarity: "legendary", overall: 99,
    stats: { offense: 95, defense: 97, mechanics: 94, consistency: 99, experience: 99, clutch: 99 },
    fx: { attributes: ["consistency", "clutch"], value: 5, description: "+5 consistency and clutch." },
    flavor: "Four RLCS World Championships across different teams and regions. The strongest winning résumé in the esport." },
  { id: "sp-kaydop-three-time-world-champion", p: "kaydop", base: ["team-dignitas", "s5"], title: "Three-Time World Champion", type: "legend", rarity: "legendary", overall: 99,
    stats: { offense: 99, defense: 91, mechanics: 95, consistency: 98, experience: 99, clutch: 98 },
    fx: { attributes: ["offense", "clutch"], value: 5, description: "+5 offense and clutch." },
    flavor: "The finishing edge of the Gale Force, Dignitas and Vitality championship eras." },
  { id: "sp-zen-perfect-spring", p: "zen", base: ["team-vitality", "2223"], title: "Perfect Spring", type: "legend", rarity: "legendary", overall: 99,
    stats: { offense: 99, defense: 96, mechanics: 99, consistency: 98, experience: 94, clutch: 99 },
    fx: { attributes: ["mechanics", "clutch"], value: 5, description: "+5 mechanics and clutch." },
    flavor: "Three regionals, the Spring Major and the World Championship in the same debut run. One of the cleanest peaks in RLCS history." },
  { id: "sp-monkeymoon-bds-anchor", p: "m0nkeym00n", base: ["team-bds", "2122"], title: "BDS Anchor", type: "legend", rarity: "legendary", overall: 99,
    stats: { offense: 96, defense: 99, mechanics: 96, consistency: 99, experience: 98, clutch: 97 },
    fx: { attributes: ["defense", "consistency"], value: 5, description: "+5 defense and consistency." },
    flavor: "A defining player of the open era, built on pressure, efficiency and championship-level structure." },
  { id: "sp-vatira-major-champion", p: "vatira", base: ["karmine-corp", "2223"], title: "Major Champion", type: "legend", rarity: "legendary", overall: 99,
    stats: { offense: 96, defense: 99, mechanics: 97, consistency: 98, experience: 97, clutch: 98 },
    fx: { attributes: ["defense", "clutch"], value: 5, description: "+5 defense and clutch." },
    flavor: "One of the most complete LAN players of the open era, with elite defensive reads and multiple Major peaks." },

  // -- Worlds MVP (mythic tier) --
  { id: "sp-0verzero-s1-worlds-mvp", p: "0verzer0", base: ["ibuypower", "s1"], title: "Season 1 World MVP", type: "worlds_mvp", rarity: "mythic", overall: 95,
    stats: { offense: 93, defense: 92, mechanics: 89, consistency: 93, experience: 94, clutch: 98 },
    fx: { attributes: ["clutch"], value: 5, description: "+5 clutch." },
    flavor: "Season 1 World Championship MVP. A substitute story that became part of the early RLCS mythology." },
  { id: "sp-kuxir97-s2-worlds-mvp", p: "kuxir97", base: ["flipsid3-tactics", "s2"], title: "Season 2 World MVP", type: "worlds_mvp", rarity: "mythic", overall: 97,
    stats: { offense: 96, defense: 94, mechanics: 98, consistency: 96, experience: 96, clutch: 97 },
    fx: { attributes: ["mechanics", "clutch"], value: 4, description: "+4 mechanics and clutch." },
    flavor: "Season 2 World Championship MVP with FlipSid3 Tactics." },
  { id: "sp-deevo-s3-worlds-mvp", p: "deevo", base: ["northern-gaming", "s3"], title: "Season 3 World MVP", type: "worlds_mvp", rarity: "mythic", overall: 97,
    stats: { offense: 96, defense: 93, mechanics: 97, consistency: 94, experience: 94, clutch: 97 },
    fx: { attributes: ["mechanics"], value: 5, description: "+5 mechanics." },
    flavor: "Season 3 World Championship MVP. A card focused on early aerial creativity and backboard pressure." },
  { id: "sp-turbopolsa-s4-worlds-mvp", p: "turbopolsa", base: ["gale-force-esports", "s4"], title: "Season 4 World MVP", type: "worlds_mvp", rarity: "mythic", overall: 98,
    stats: { offense: 95, defense: 97, mechanics: 94, consistency: 98, experience: 97, clutch: 99 },
    fx: { attributes: ["consistency", "clutch"], value: 4, description: "+4 consistency and clutch." },
    flavor: "Season 4 World Championship MVP with Gale Force Esports." },
  { id: "sp-kaydop-s5-worlds-mvp", p: "kaydop", base: ["team-dignitas", "s5"], title: "Season 5 World MVP", type: "worlds_mvp", rarity: "mythic", overall: 98,
    stats: { offense: 99, defense: 90, mechanics: 95, consistency: 98, experience: 97, clutch: 98 },
    fx: { attributes: ["offense", "clutch"], value: 4, description: "+4 offense and clutch." },
    flavor: "Season 5 World Championship MVP in one of the most famous Grand Finals in RLCS history." },
  { id: "sp-torment-s6-worlds-mvp", p: "torment", base: ["cloud9", "s6"], title: "Season 6 World MVP", type: "worlds_mvp", rarity: "mythic", overall: 96,
    stats: { offense: 90, defense: 99, mechanics: 92, consistency: 97, experience: 95, clutch: 97 },
    fx: { attributes: ["defense", "consistency"], value: 4, description: "+4 defense and consistency." },
    flavor: "Season 6 World Championship MVP. Cloud9 had the mechanics, but Torment gave the run its defensive base." },
  { id: "sp-scrubkilla-s7-worlds-mvp", p: "scrubkilla", base: ["renault-vitality", "s7"], title: "Season 7 World MVP", type: "worlds_mvp", rarity: "mythic", overall: 96,
    stats: { offense: 96, defense: 93, mechanics: 96, consistency: 94, experience: 91, clutch: 98 },
    fx: { attributes: ["mechanics", "clutch"], value: 4, description: "+4 mechanics and clutch." },
    flavor: "Season 7 World Championship MVP with Renault Vitality." },
  { id: "sp-turbopolsa-s8-worlds-mvp", p: "turbopolsa", base: ["nrg-esports", "s8"], title: "Season 8 World MVP", type: "worlds_mvp", rarity: "mythic", overall: 98,
    stats: { offense: 94, defense: 98, mechanics: 94, consistency: 99, experience: 99, clutch: 99 },
    fx: { attributes: ["experience", "clutch"], value: 4, description: "+4 experience and clutch." },
    flavor: "Season 8 World Championship MVP. The NRG title completed the four-time story." },
  { id: "sp-seikoo-2022-worlds-mvp", p: "seikoo", base: ["team-bds", "2122"], title: "2021-22 World MVP", type: "worlds_mvp", rarity: "mythic", overall: 96,
    stats: { offense: 96, defense: 91, mechanics: 96, consistency: 94, experience: 90, clutch: 97 },
    fx: { attributes: ["offense", "mechanics"], value: 4, description: "+4 offense and mechanics." },
    flavor: "World Championship MVP after joining Team BDS and turning a great roster into a champion." },
  { id: "sp-zen-2023-worlds-mvp", p: "zen", base: ["team-vitality", "2223"], title: "2022-23 World MVP", type: "worlds_mvp", rarity: "mythic", overall: 99,
    stats: { offense: 99, defense: 96, mechanics: 99, consistency: 98, experience: 94, clutch: 99 },
    fx: { attributes: ["mechanics", "clutch"], value: 5, description: "+5 mechanics and clutch." },
    flavor: "The World Championship MVP card for the season where zen completed the perfect debut run." },
  { id: "sp-dralii-2024-worlds-mvp", p: "dralii", base: ["team-bds", "2024"], title: "2024 World MVP", type: "worlds_mvp", rarity: "mythic", overall: 97,
    stats: { offense: 97, defense: 94, mechanics: 98, consistency: 95, experience: 91, clutch: 97 },
    fx: { attributes: ["mechanics", "offense"], value: 4, description: "+4 mechanics and offense." },
    flavor: "A World Championship MVP card for BDS's 2024 title run." },
  { id: "sp-atomic-2025-worlds-mvp", p: "atomic", base: ["nrg-esports", "2025"], title: "2025 World MVP", type: "worlds_mvp", rarity: "mythic", overall: 98,
    stats: { offense: 98, defense: 93, mechanics: 97, consistency: 97, experience: 96, clutch: 98 },
    fx: { attributes: ["offense", "consistency"], value: 4, description: "+4 offense and consistency." },
    flavor: "World Championship MVP card for NRG's 2025 title run." },

  // -- Major MVP (epic tier) --
  { id: "sp-marcby8-fall-major-mvp", p: "marcby8", base: ["team-bds", "x"], title: "Stockholm Major MVP", type: "major_mvp", rarity: "epic", overall: 95,
    stats: { offense: 92, defense: 95, mechanics: 93, consistency: 96, experience: 91, clutch: 94 },
    fx: { attributes: ["defense", "consistency"], value: 4, description: "+4 defense and consistency." },
    flavor: "RLCS 2021-22 Fall Major MVP with Team BDS." },
  { id: "sp-atomic-winter-major-mvp", p: "atomic", base: ["g2-esports", "2122"], title: "LA Winter Major MVP", type: "major_mvp", rarity: "epic", overall: 96,
    stats: { offense: 96, defense: 92, mechanics: 96, consistency: 95, experience: 92, clutch: 97 },
    fx: { attributes: ["offense", "clutch"], value: 4, description: "+4 offense and clutch." },
    flavor: "RLCS 2021-22 Winter Major MVP with G2 Esports." },
  { id: "sp-joyo-spring-major-mvp", p: "joyo", base: ["moist-esports", "2122"], title: "London Spring Major MVP", type: "major_mvp", rarity: "epic", overall: 96,
    stats: { offense: 96, defense: 89, mechanics: 98, consistency: 92, experience: 90, clutch: 97 },
    fx: { attributes: ["mechanics", "clutch"], value: 4, description: "+4 mechanics and clutch." },
    flavor: "RLCS 2021-22 Spring Major MVP. This also covers the Moist/Joyo masterclass from that LAN." },
  { id: "sp-apparentlyjack-fall-major-mvp", p: "apparentlyjack", base: ["gen-g-mobil1-racing", "2223"], title: "Rotterdam Major MVP", type: "major_mvp", rarity: "epic", overall: 96,
    stats: { offense: 94, defense: 95, mechanics: 94, consistency: 97, experience: 92, clutch: 96 },
    fx: { attributes: ["consistency", "clutch"], value: 4, description: "+4 consistency and clutch." },
    flavor: "RLCS 2022-23 Fall Major MVP with Gen.G Mobil1 Racing." },
  { id: "sp-zen-spring-major-mvp", p: "zen", base: ["team-vitality", "2223"], title: "Boston Spring Major MVP", type: "major_mvp", rarity: "epic", overall: 98,
    stats: { offense: 98, defense: 95, mechanics: 99, consistency: 97, experience: 92, clutch: 98 },
    fx: { attributes: ["mechanics", "consistency"], value: 4, description: "+4 mechanics and consistency." },
    flavor: "RLCS 2022-23 Spring Major MVP. The Major that confirmed Vitality's perfect split was real." },
  { id: "sp-itachi-copenhagen-major-mvp", p: "itachi", base: ["gentle-mates-alpine", "2024"], title: "Copenhagen Major MVP", type: "major_mvp", rarity: "epic", overall: 96,
    stats: { offense: 92, defense: 97, mechanics: 94, consistency: 97, experience: 94, clutch: 96 },
    fx: { attributes: ["defense", "consistency"], value: 4, description: "+4 defense and consistency." },
    flavor: "RLCS 2024 Major 1 MVP with Gentle Mates Alpine." },
  { id: "sp-beastmode-london-major-mvp", p: "beastmode", base: ["g2-stride", "2024"], title: "London Major MVP", type: "major_mvp", rarity: "epic", overall: 97,
    stats: { offense: 98, defense: 92, mechanics: 98, consistency: 95, experience: 94, clutch: 98 },
    fx: { attributes: ["offense", "mechanics"], value: 4, description: "+4 offense and mechanics." },
    flavor: "RLCS 2024 Major 2 MVP with G2 Stride." },
  { id: "sp-dralii-birmingham-major-mvp", p: "dralii", base: ["karmine-corp", "2025"], title: "Birmingham Major MVP", type: "major_mvp", rarity: "epic", overall: 97,
    stats: { offense: 97, defense: 94, mechanics: 98, consistency: 96, experience: 91, clutch: 97 },
    fx: { attributes: ["mechanics", "offense"], value: 4, description: "+4 mechanics and offense." },
    flavor: "RLCS 2025 Birmingham Major MVP." },
  { id: "sp-kiileerrz-raleigh-major-mvp", p: "kiileerrz", base: ["team-falcons", "2025"], title: "Raleigh Major MVP", type: "major_mvp", rarity: "epic", overall: 97,
    stats: { offense: 97, defense: 93, mechanics: 98, consistency: 95, experience: 94, clutch: 98 },
    fx: { attributes: ["mechanics", "clutch"], value: 4, description: "+4 mechanics and clutch." },
    flavor: "RLCS 2025 Raleigh Major MVP. Falcons' win gave MENA its first RLCS LAN title." },
  { id: "sp-nass-boston-major-mvp", p: "nass", base: ["gentle-mates-alpine", "2026"], title: "Boston Major MVP", type: "major_mvp", rarity: "epic", overall: 97,
    stats: { offense: 97, defense: 93, mechanics: 98, consistency: 96, experience: 91, clutch: 98 },
    fx: { attributes: ["mechanics", "clutch"], value: 4, description: "+4 mechanics and clutch." },
    flavor: "RLCS 2026 Boston Major MVP with Gentle Mates Alpine." },
  { id: "sp-vatira-paris-major-mvp", p: "vatira", base: ["karmine-corp", "2026"], title: "Paris Major MVP", type: "major_mvp", rarity: "epic", overall: 98,
    stats: { offense: 96, defense: 99, mechanics: 97, consistency: 98, experience: 98, clutch: 98 },
    fx: { attributes: ["defense", "clutch"], value: 4, description: "+4 defense and clutch." },
    flavor: "RLCS 2026 Paris Major MVP with Karmine Corp." },

  // -- Moments & legacy (mythic / rare tiers) --
  { id: "sp-jstn-this-is-rocket-league", p: "jstn", base: ["nrg-esports", "s5"], title: "This Is Rocket League", type: "moment", rarity: "mythic", overall: 96,
    stats: { offense: 96, defense: 88, mechanics: 96, consistency: 90, experience: 94, clutch: 99 },
    fx: { attributes: ["clutch"], value: 5, description: "+5 clutch." },
    flavor: "Season 5 Grand Final. Zero seconds on the clock, the ball still live, and one of the most famous calls in esports history." },
  { id: "sp-squishy-ceiling-shot", p: "squishymuffinz", base: ["cloud9", "s4"], title: "Ceiling Shot", type: "moment", rarity: "mythic", overall: 95,
    stats: { offense: 94, defense: 88, mechanics: 99, consistency: 91, experience: 93, clutch: 95 },
    fx: { attributes: ["mechanics"], value: 5, description: "+5 mechanics." },
    flavor: "A famous early ceiling shot that became a marker for where Rocket League mechanics were heading." },
  { id: "sp-0verzero-air-dribble", p: "0verzer0", base: ["ibuypower", "s1"], title: "Air Dribble", type: "moment", rarity: "rare", overall: 93,
    stats: { offense: 92, defense: 88, mechanics: 94, consistency: 88, experience: 92, clutch: 96 },
    fx: { attributes: ["mechanics", "clutch"], value: 3, description: "+3 mechanics and clutch." },
    flavor: "A Season 1-era aerial dribble highlight from iBUYPOWER Cosmic, kept as a moment card rather than another MVP card." },
  { id: "sp-al0t-redirect", p: "al0t", base: ["complexity-gaming", "s5"], title: "Redirect", type: "moment", rarity: "rare", overall: 91,
    stats: { offense: 93, defense: 84, mechanics: 94, consistency: 86, experience: 88, clutch: 91 },
    fx: { attributes: ["offense", "mechanics"], value: 3, description: "+3 offense and mechanics." },
    flavor: "A community-favorite redirect highlight. Useful as a mechanics/offense moment without inflating him into the top tier." },
  { id: "sp-zen-mr-physics", p: "zen", base: ["team-vitality", "2223"], title: "Mr. Physics", type: "moment", rarity: "mythic", overall: 98,
    stats: { offense: 98, defense: 95, mechanics: 99, consistency: 97, experience: 92, clutch: 98 },
    fx: { attributes: ["mechanics"], value: 5, description: "+5 mechanics." },
    flavor: "A mechanics-first zen moment card, based on the community perception of his physics-defying touches and reads." },
  { id: "sp-joyo-moist-masterclass", p: "joyo", base: ["moist-esports", "2122"], title: "Moist Masterclass", type: "moment", rarity: "mythic", overall: 95,
    stats: { offense: 95, defense: 88, mechanics: 98, consistency: 91, experience: 90, clutch: 96 },
    fx: { attributes: ["mechanics", "offense"], value: 4, description: "+4 mechanics and offense." },
    flavor: "A separate Joyo moment card for the 2022 Spring Major run. The official MVP version is also in the album." },
  { id: "sp-yanxnz-moist-game-seven-hat-trick", p: "yanxnz", base: ["furia", "2122"], title: "Moist Game 7 Hat Trick", type: "moment", rarity: "mythic", overall: 97,
    stats: { offense: 97, defense: 87, mechanics: 97, consistency: 90, experience: 89, clutch: 99 },
    fx: { attributes: ["clutch"], value: 5, description: "+5 clutch." },
    flavor: "FURIA vs Moist at the 2021-22 World Championship. A defining SAM moment on the world stage." },
  { id: "sp-yanxnz-gamers8-champion", p: "yanxnz", base: ["furia", "2122"], title: "Gamers8 Champion", type: "moment", rarity: "mythic", overall: 95,
    stats: { offense: 96, defense: 85, mechanics: 97, consistency: 90, experience: 89, clutch: 96 },
    fx: { attributes: ["offense", "mechanics"], value: 4, description: "+4 offense and mechanics." },
    flavor: "FURIA's Gamers8 2022 win was one of the biggest international statements by a Brazilian Rocket League roster." },
  { id: "sp-fairy-peak-vitality-control", p: "fairypeak", base: ["renault-vitality", "s8"], title: "Vitality Control", type: "legend", rarity: "mythic", overall: 94,
    stats: { offense: 91, defense: 96, mechanics: 93, consistency: 97, experience: 98, clutch: 94 },
    fx: { attributes: ["defense", "consistency"], value: 4, description: "+4 defense and consistency." },
    flavor: "A legacy card for Fairy Peak!'s control, longevity and importance to the Vitality identity." },
  { id: "sp-firstkiller-rogue-era", p: "firstkiller", base: ["rogue", "x"], title: "Rogue Era", type: "moment", rarity: "mythic", overall: 94,
    stats: { offense: 96, defense: 88, mechanics: 98, consistency: 88, experience: 89, clutch: 94 },
    fx: { attributes: ["offense", "mechanics"], value: 4, description: "+4 offense and mechanics." },
    flavor: "A card for the early Firstkiller period, when his individual pressure could reshape entire series." },
  { id: "sp-seikoo-endpoint-breakout", p: "seikoo", base: ["team-bds", "2122"], title: "Endpoint Breakout", type: "moment", rarity: "mythic", overall: 94,
    stats: { offense: 95, defense: 88, mechanics: 96, consistency: 92, experience: 86, clutch: 94 },
    fx: { attributes: ["offense", "mechanics"], value: 4, description: "+4 offense and mechanics." },
    flavor: "Before the Worlds MVP card, there was the Endpoint breakout." },
  { id: "sp-trk511-mena-arrival", p: "trk511", base: ["team-falcons", "2122"], title: "MENA Arrival", type: "moment", rarity: "mythic", overall: 94,
    stats: { offense: 94, defense: 91, mechanics: 96, consistency: 93, experience: 92, clutch: 95 },
    fx: { attributes: ["mechanics", "clutch"], value: 4, description: "+4 mechanics and clutch." },
    flavor: "A Falcons/Sandrock-era card for MENA becoming a real international contender." },
  { id: "sp-drippay-oce-breakthrough", p: "drippay", base: ["chiefs-esc", "s4"], title: "OCE Breakthrough", type: "moment", rarity: "rare", overall: 91,
    stats: { offense: 93, defense: 85, mechanics: 91, consistency: 89, experience: 90, clutch: 94 },
    fx: { attributes: ["offense", "clutch"], value: 3, description: "+3 offense and clutch." },
    flavor: "A card for the first OCE era that showed the region could create LAN threats and individual stars." },
  { id: "sp-torsos-longevity", p: "torsos", base: ["chiefs-esports-club", "s5"], title: "Longevity", type: "legend", rarity: "rare", overall: 88,
    stats: { offense: 84, defense: 88, mechanics: 84, consistency: 91, experience: 96, clutch: 88 },
    fx: { attributes: ["experience", "consistency"], value: 3, description: "+3 experience and consistency." },
    flavor: "A long-career OCE card. Stronger than his base card, but intentionally below the global superstar tier." },
  { id: "sp-cjcj-oce-captain", p: "cjcj", base: ["renegades", "2122"], title: "OCE Captain", type: "legend", rarity: "rare", overall: 86,
    stats: { offense: 81, defense: 85, mechanics: 80, consistency: 89, experience: 95, clutch: 86 },
    fx: { attributes: ["experience", "consistency"], value: 3, description: "+3 experience and consistency." },
    flavor: "A lower-overall special card for leadership, region identity and career presence." },
  { id: "sp-chausettes-dreamhack-valencia", p: "chausette45", base: ["psg-esports", "s7"], title: "Valencia Peak", type: "moment", rarity: "rare", overall: 92,
    stats: { offense: 94, defense: 89, mechanics: 94, consistency: 90, experience: 91, clutch: 94 },
    fx: { attributes: ["offense", "mechanics"], value: 3, description: "+3 offense and mechanics." },
    flavor: "Not an RLCS MVP card, but a strong non-RLCS LAN peak worth keeping as optional flavor." },
  { id: "sp-garrettg-longevity", p: "garrettg", base: ["nrg-esports", "2122"], title: "Longevity", type: "legend", rarity: "mythic", overall: 95,
    stats: { offense: 93, defense: 93, mechanics: 92, consistency: 99, experience: 99, clutch: 94 },
    fx: { attributes: ["experience", "consistency"], value: 4, description: "+4 experience and consistency." },
    flavor: "A career legacy card for one of the defining names of North American Rocket League." },

  // -- Coach specials (team_attribute_boost) --
  { id: "sp-coach-ferra-perfect-vitality", p: "ferra", kind: "coach", base: ["team-vitality", "2223"], title: "Perfect Vitality", type: "coach", rarity: "legendary", overall: 99,
    fx: { team: true, attributes: ["consistency", "clutch"], value: 5, description: "+5 team consistency and clutch." },
    flavor: "Vitality's 2023 run gives Ferra the premium coach card." },
  { id: "sp-coach-stl-gamers8-furia", p: "stl", kind: "coach", base: ["furia", "x"], title: "Gamers8 FURIA", type: "coach", rarity: "mythic", overall: 94,
    fx: { team: true, attributes: ["offense", "clutch"], value: 4, description: "+4 team offense and clutch." },
    flavor: "FURIA's Gamers8 2022 title was a landmark for Brazilian Rocket League. STL gets a coach card for that run." },
  { id: "sp-coach-satthew-na-superteam", p: "satthew", kind: "coach", base: ["nrg-esports", "2025"], title: "NA Superteam", type: "coach", rarity: "mythic", overall: 95,
    fx: { team: true, attributes: ["consistency"], value: 4, description: "+4 team consistency." },
    flavor: "A coach card for managing elite NA rosters and keeping high-talent lineups stable." },
  { id: "sp-coach-mew-bds-worlds", p: "mew", kind: "coach", base: ["team-bds", "2122"], title: "BDS Reset", type: "coach", rarity: "mythic", overall: 94,
    fx: { team: true, attributes: ["defense", "consistency"], value: 4, description: "+4 team defense and consistency." },
    flavor: "A BDS Worlds preparation card focused on structure and bracket adaptation." },
  { id: "sp-coach-sizz-nrg-madrid", p: "sizz", kind: "coach", base: ["nrg-esports", "s8"], title: "Madrid NRG", type: "coach", rarity: "rare", overall: 91,
    fx: { team: true, attributes: ["clutch"], value: 3, description: "+3 team clutch." },
    flavor: "NRG's Season 8 title run earns Sizz a mentality-focused coach card." },
  { id: "sp-coach-eversax-kc-structure", p: "eversax", kind: "coach", base: ["karmine-corp", "2223"], title: "Karmine Structure", type: "coach", rarity: "mythic", overall: 94,
    fx: { team: true, attributes: ["defense", "consistency"], value: 4, description: "+4 team defense and consistency." },
    flavor: "A Karmine Corp structure card built around controlling elite attacking talent." },
  { id: "sp-coach-snaski-gentle-mates", p: "snaski", kind: "coach", base: ["oxygen-esports", "2024"], title: "Gentle Mates", type: "coach", rarity: "rare", overall: 91,
    fx: { team: true, attributes: ["consistency"], value: 3, description: "+3 team consistency." },
    flavor: "A fundamentals-focused coach card for Gentle Mates' LAN structure." },
];

const cardById = new Map(playerCards.map((c) => [c.id, c]));
const coachByIdMap = new Map(coachCards.map((c) => [c.id, c]));

// specialCards.json is HAND-MAINTAINED (since v1.1.0). It is NOT regenerated
// from the SPECIALS catalogue above, so `npm run build:data` never clobbers the
// hand-edited cards. We still LOAD the real file here to (a) re-validate that
// every base card id resolves against the freshly generated player/coach cards
// (so a typo is caught at build time, exactly like the load-time check in
// src/data/index.ts) and (b) keep public/cards/specials/README.md listing the
// real card filenames.
const existingSpecials = JSON.parse(
  readFileSync(join(root, "src", "data", "specialCards.json"), "utf8"),
);
for (const sp of existingSpecials) {
  const kind = sp.kind ?? "player";
  const baseOk = kind === "coach" ? coachByIdMap.has(sp.baseCardId) : cardById.has(sp.baseCardId);
  if (!baseOk) {
    throw new Error(
      `specialCards.json: "${sp.id}" -> base ${kind} card "${sp.baseCardId}" not found. ` +
        `Edit src/data/specialCards.json so baseCardId matches a real card id.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Write outputs
// ---------------------------------------------------------------------------

const dataDir = join(root, "src", "data");
const writeJson = (file, value) =>
  writeFileSync(join(dataDir, file), JSON.stringify(value, null, 2) + "\n");

writeJson("seasons.json", seasonsOut);
writeJson("players.json", playersOut);
writeJson("orgs.json", orgsOut);
writeJson("playerCards.json", playerCards);
writeJson("coaches.json", coachCards);
writeJson("subs.json", subCards);
writeJson("lineups.json", lineups);
// specialCards.json intentionally NOT written — hand-maintained since v1.1.0.

// National-team special ids (v2.0): src/data/index.ts DERIVES one special per
// card of a national lineup (`nt-<base card id>`: players, then coach, then
// sub). The light catalog (src/data/catalog.ts) needs the ids without loading
// the dataset (rc.26, #60), so the same list is written here;
// integrity.test.ts asserts it matches the load-time derivation.
writeJson(
  "nationalSpecialIds.json",
  lineups
    .filter((l) => l.national)
    .flatMap((l) => [...l.playerCardIds, ...(l.coachId ? [l.coachId] : []), ...(l.subId ? [l.subId] : [])])
    .map((id) => `nt-${id}`),
);

// Asset manifests — drop-in image filenames.
mkdirSync(join(root, "public", "orgs"), { recursive: true });
writeFileSync(
  join(root, "public", "orgs", "README.md"),
  `# Organization logos\n\nDrop one PNG per org here (square, transparent, ≥256px). Missing files fall\nback to a monogram placeholder. \`<orgId>@<era>.png\` files are era variants\n(rebrands — see ORG_LOGO_ERAS in scripts/build-dataset.mjs); they fall back\nto the default org logo. Generated from data-sources/teams.md — run\n\`npm run build:data\` after editing it.\n\n\`\`\`\n${orgsOut
    .flatMap((o) => [
      `${o.id}.png`,
      ...(o.logoEras ?? []).map((e) => `${o.id}@${e.key}.png`),
    ])
    .join("\n")}\n\`\`\`\n`,
);
mkdirSync(join(root, "public", "cards", "specials"), { recursive: true });
writeFileSync(
  join(root, "public", "cards", "specials", "README.md"),
  `# Special card photos\n\nDrop one image per special card here (portrait crop, face in the top half,\n≥480×680px). Missing files fall back to stylized art. Generated from the\nspecials catalogue — run \`npm run build:data\` after editing it.\n\n\`\`\`\n${existingSpecials.map((s) => `${s.id}.png`).join("\n")}\n\`\`\`\n`,
);

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const strengthCount = lineups.reduce((acc, l) => {
  acc[l.historicalStrength] = (acc[l.historicalStrength] ?? 0) + 1;
  return acc;
}, {});

console.log("Dataset built:");
console.log(`  seasons:      ${seasonsOut.length}`);
console.log(`  players:      ${playersOut.length}`);
console.log(`  player cards: ${playerCards.length}`);
console.log(`  coaches:      ${coachCards.length}`);
console.log(`  subs:         ${subCards.length}`);
console.log(`  orgs:         ${orgsOut.length}`);
console.log(`  lineups:      ${lineups.length}  (${Object.entries(strengthCount).map(([k, v]) => `${k} ${v}`).join(" · ")})`);
console.log(`  specials:     ${existingSpecials.length} (hand-maintained)`);
const noCountry = playersOut.filter((p) => !p.country).length;
console.log(`  players without country (chemistry skips them): ${noCountry}`);
