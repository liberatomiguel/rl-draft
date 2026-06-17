// =============================================================================
// Overall-review tool — apply a community review CSV to teams.md, or export the
// current dataset as a fresh review CSV. Source of truth stays data-sources/teams.md.
//
//   APPLY (dry-run by default — reports, writes nothing):
//     node scripts/apply-overall-review.mjs <review.csv>
//   APPLY for real (writes teams.md):
//     node scripts/apply-overall-review.mjs <review.csv> --apply
//   EXPORT a fresh baseline CSV from the current dataset:
//     node scripts/apply-overall-review.mjs --export <out.csv>
//
// After --apply ALWAYS run:  npm run build:data && npm run validate:data && npm test
//
// CSV format (header row, comma-separated — the same one this tool exports):
//   Função,Jogador,Time,Temporada,Ano,Região,Pool,OVR atual,OVR sugerido,Sugestão de line/time,Ref (id)
//   · Função  = "Player 1" | "Player 2" | "Player 3" | "Sub" | "Coach"
//   · OVR sugerido = new overall to apply (blank = no change)
//   · Sugestão de line/time = put "Legacy" to flag the lineup for the legacy
//     gauntlet (floors historicalStrength at "strong"); free-text notes are
//     reported but NOT auto-applied (add/remove players, subs or coaches by hand).
//   · Ref (id) = the generated card id (informational; matching is by Time+season+role)
//
// UTF-8 safe: this tool uses Node fs only — NEVER PowerShell -replace (mojibake).
// =============================================================================
import fs from "node:fs";

const MD = "data-sources/teams.md";

// Season label/key/id/year — mirrors SEASONS in scripts/build-dataset.mjs.
// Add a row here if a new season is added there.
const SEASONS = [
  { key: "S1", id: "rlcs-s1", label: "RLCS Season 1", year: "2016", order: 1 },
  { key: "S2", id: "rlcs-s2", label: "RLCS Season 2", year: "2016", order: 2 },
  { key: "S3", id: "rlcs-s3", label: "RLCS Season 3", year: "2017", order: 3 },
  { key: "S4", id: "rlcs-s4", label: "RLCS Season 4", year: "2017", order: 4 },
  { key: "S5", id: "rlcs-s5", label: "RLCS Season 5", year: "2018", order: 5 },
  { key: "S6", id: "rlcs-s6", label: "RLCS Season 6", year: "2018", order: 6 },
  { key: "S7", id: "rlcs-s7", label: "RLCS Season 7", year: "2019", order: 7 },
  { key: "S8", id: "rlcs-s8", label: "RLCS Season 8", year: "2019", order: 8 },
  { key: "S9", id: "rlcs-s9", label: "RLCS Season 9", year: "2020", order: 9 },
  { key: "RLCS X", id: "rlcs-x", label: "RLCS X", year: "2020-21", order: 10 },
  { key: "2021-22", id: "rlcs-2021-22", label: "RLCS 2021-22", year: "2021-22", order: 11 },
  { key: "2022-23", id: "rlcs-2022-23", label: "RLCS 2022-23", year: "2022-23", order: 12 },
  { key: "2024", id: "rlcs-2024", label: "RLCS 2024", year: "2024", order: 13 },
  { key: "2025", id: "rlcs-2025", label: "RLCS 2025", year: "2025", order: 14 },
  { key: "2026", id: "rlcs-2026", label: "RLCS 2026", year: "2026", order: 15 },
];
const KEY_BY_LABEL = new Map(SEASONS.map((s) => [s.label, s.key]));
const SEASON_BY_ID = new Map(SEASONS.map((s) => [s.id, s]));

const HEADER =
  "Função,Jogador,Time,Temporada,Ano,Região,Pool,OVR atual,OVR sugerido,Sugestão de line/time,Ref (id)";

// --- shared: parse teams.md into blocks (with line indices) ---
function parseBlocks(lines) {
  let region = null, block = null;
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^###\s+(\S+)/);
    if (h) { region = h[1]; continue; }
    const t = lines[i].match(/^```team:\s*(.*)$/);
    if (t) {
      const [org, key] = t[1].split("·").map((s) => s.trim());
      block = { org, key, region, rowIdx: [], orgIdx: -1, flagIdx: -1 };
      continue;
    }
    if (block) {
      if (lines[i].startsWith("```")) { blocks.push(block); block = null; }
      else if (lines[i].trim()) {
        block.rowIdx.push(i);
        const low = lines[i].trim().toLowerCase();
        if (low.startsWith("org:")) block.orgIdx = i;
        if (low.startsWith("flag")) block.flagIdx = i;
      }
    }
  }
  return blocks;
}

const roleToPrefix = (func) => {
  const m = func.match(/^Player\s*([123])$/i);
  if (m) return `player ${m[1]}`;
  const f = func.trim().toLowerCase();
  return f === "sub" ? "sub" : f === "coach" ? "coach" : null;
};

// =============================== EXPORT MODE ===============================
function exportCsv(outPath) {
  const lineups = JSON.parse(fs.readFileSync("src/data/lineups.json", "utf8"));
  const players = new Map(JSON.parse(fs.readFileSync("src/data/players.json", "utf8")).map((p) => [p.id, p]));
  const pcById = new Map(JSON.parse(fs.readFileSync("src/data/playerCards.json", "utf8")).map((c) => [c.id, c]));
  const subById = new Map(JSON.parse(fs.readFileSync("src/data/subs.json", "utf8")).map((c) => [c.id, c]));
  const coachById = new Map(JSON.parse(fs.readFileSync("src/data/coaches.json", "utf8")).map((c) => [c.id, c]));

  // legacy flag lives in teams.md — map (name|key) -> legacy?
  const md = fs.readFileSync(MD, "utf8").split("\n");
  const blocks = parseBlocks(md);
  const legacyByKey = new Map();
  for (const b of blocks) {
    const flag = b.flagIdx >= 0 ? md[b.flagIdx] : "";
    legacyByKey.set(`${b.org}|${b.key}`, /\blegacy\b/i.test(flag));
  }

  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [HEADER];
  // review-friendly order: by region, then chronological, worlds before regional
  const ordered = [...lineups].sort((a, b) => {
    if (a.region !== b.region) return a.region < b.region ? -1 : 1;
    const oa = SEASON_BY_ID.get(a.seasonId)?.order ?? 0, ob = SEASON_BY_ID.get(b.seasonId)?.order ?? 0;
    if (oa !== ob) return oa - ob;
    return (a.samOnly ? 1 : 0) - (b.samOnly ? 1 : 0);
  });
  for (const l of ordered) {
    const s = SEASON_BY_ID.get(l.seasonId);
    const pool = l.samOnly ? "SAM-only" : "";
    const legacy = legacyByKey.get(`${l.name}|${s?.key}`) ? "Legacy" : "";
    const row = (func, nick, ovr, ref) =>
      [func, nick, l.name, s?.label ?? l.seasonId, s?.year ?? "", l.region, pool, ovr, "", legacy, ref]
        .map(esc).join(",");
    l.playerCardIds.forEach((id, i) => {
      const c = pcById.get(id);
      rows.push(row(`Player ${i + 1}`, players.get(c.playerId)?.nickname ?? c.playerId, c.overall, id));
    });
    if (l.subId) { const c = subById.get(l.subId); rows.push(row("Sub", c.name, c.overall, l.subId)); }
    if (l.coachId) { const c = coachById.get(l.coachId); rows.push(row("Coach", c.name, c.overall, l.coachId)); }
  }
  fs.writeFileSync(outPath, rows.join("\n") + "\n", "utf8");
  console.log(`Exported ${rows.length - 1} rows → ${outPath}`);
}

// =============================== APPLY MODE ===============================
function applyCsv(csvPath, write) {
  const original = fs.readFileSync(MD, "utf8");
  const lines = original.split("\n");
  const blocks = parseBlocks(lines);
  const byKey = new Map(blocks.map((b) => [`${b.org.toLowerCase()}|${b.key}`, b]));

  const rows = fs.readFileSync(csvPath, "utf8").split(/\r?\n/).filter(Boolean);
  rows.shift();

  const ovrEdits = [], legacyBlocks = new Map();
  const drift = [], unmatched = [], notes = [];
  for (const ln of rows) {
    const c = ln.split(",");
    const [func, jog, time, temp, , , , ovrA, ovrS, sug, ref] = c;
    const key = `${time.toLowerCase()}|${KEY_BY_LABEL.get(temp) ?? temp}`;
    const b = byKey.get(key);
    if (!b) { if ((ovrS && ovrS.trim()) || (sug && /legacy/i.test(sug))) unmatched.push(`${ref || time} (${func})`); continue; }
    if (sug && /\blegacy\b/i.test(sug)) legacyBlocks.set(`${b.org}|${b.key}`, b);
    else if (sug && sug.trim()) notes.push(`${ref}: ${sug.trim()}`);
    if (!ovrS || !ovrS.trim()) continue;
    const prefix = roleToPrefix(func);
    const idx = b.rowIdx.find((i) => lines[i].trim().toLowerCase().startsWith(prefix + ":") || lines[i].trim().toLowerCase().startsWith(prefix + " "));
    if (idx == null) { unmatched.push(`${ref} (no ${func} line)`); continue; }
    const m = lines[idx].match(/^(.*\S)\s+(\d{2})(\s*)$/);
    if (!m) { unmatched.push(`${ref} (unparsable line)`); continue; }
    const cur = Number(m[2]);
    if (ovrA && Number(ovrA) !== cur) drift.push(`${ref}: CSV-atual=${ovrA} file=${cur}`);
    if (Number(ovrS) === cur) continue;
    ovrEdits.push({ idx, newNum: ovrS.trim(), label: `${b.org} ${b.key} | ${func} ${jog}: ${cur}→${ovrS.trim()}` });
  }

  // apply overalls in place
  for (const e of ovrEdits) lines[e.idx] = lines[e.idx].replace(/(\d{2})(\s*)$/, `${e.newNum}$2`);
  // apply legacy flags (append to flag line, or insert one after org line)
  const legacyApplied = [];
  const inserts = [];
  for (const b of legacyBlocks.values()) {
    if (b.flagIdx >= 0) {
      if (/\blegacy\b/i.test(lines[b.flagIdx])) continue;
      lines[b.flagIdx] = lines[b.flagIdx].replace(/(flag\s*:\s*.*\S)\s*$/i, "$1, legacy");
      legacyApplied.push(`${b.org} ${b.key} (flag += legacy)`);
    } else if (b.orgIdx >= 0) {
      inserts.push({ after: b.orgIdx, text: "flag: legacy" });
      legacyApplied.push(`${b.org} ${b.key} (new flag: legacy)`);
    }
  }
  // apply inserts back-to-front so indices stay valid
  let out = lines;
  if (inserts.length) {
    inserts.sort((a, b) => b.after - a.after);
    for (const ins of inserts) out = [...out.slice(0, ins.after + 1), ins.text, ...out.slice(ins.after + 1)];
  }

  // ---- report ----
  console.log(`overall changes:  ${ovrEdits.length}`);
  console.log(`legacy flags:     ${legacyApplied.length}`);
  if (notes.length) { console.log(`\nfree-text notes (apply by hand):`); notes.forEach((n) => console.log("  " + n)); }
  if (unmatched.length) { console.log(`\nUNMATCHED actionable rows (${unmatched.length}):`); unmatched.forEach((u) => console.log("  " + u)); }
  if (drift.length) {
    console.log(`\n⚠ OVR-atual DRIFT vs teams.md (${drift.length}) — the CSV's "current" disagrees with the file:`);
    drift.forEach((d) => console.log("  " + d));
    console.log("  Resolve before applying (rebuild teams.md, or trust the CSV with --force).");
  }
  ovrEdits.slice(0, 12).forEach((e) => console.log("  " + e.label));
  if (ovrEdits.length > 12) console.log(`  … and ${ovrEdits.length - 12} more`);

  if (!write) { console.log(`\nDRY-RUN — nothing written. Re-run with --apply to write teams.md.`); return; }
  if (drift.length && !process.argv.includes("--force")) {
    console.error(`\nRefusing to write: OVR-atual drift detected. Re-run with --force to override.`);
    process.exit(1);
  }
  fs.writeFileSync(MD, out.join("\n"), "utf8");
  console.log(`\n✓ teams.md written. Now run: npm run build:data && npm run validate:data && npm test`);
}

// --- entry ---
const argv = process.argv.slice(2);
const exportIdx = argv.indexOf("--export");
if (exportIdx >= 0) {
  const out = argv[exportIdx + 1];
  if (!out) { console.error("usage: --export <out.csv>"); process.exit(1); }
  exportCsv(out);
} else {
  const csv = argv.find((a) => !a.startsWith("--"));
  if (!csv) { console.error("usage: apply-overall-review.mjs <review.csv> [--apply]"); process.exit(1); }
  applyCsv(csv, argv.includes("--apply"));
}
