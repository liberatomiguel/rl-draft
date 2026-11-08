import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { challenges, coachById, orgById, playerById, playerCardById, specialCardById, subById } from "@/data";
import { exploreChallenge, replayChallenge, type ChallengeAction } from "./testing/challengeReplay";
import { displayTeamOverall } from "./rating";
import solutionsJson from "./__fixtures__/challenge-solutions.json";
import { CHALLENGE_TEXT_PT } from "@/content/copy.challenges.pt";

it.skipIf(!process.env.CH_REPORT)("export spoiler solutions and exact result metrics", () => {
  const solutions = solutionsJson as Record<string, { seed: number; actions: ChallengeAction[] }>;
  let doc = "# Soluções verificadas — rc.36.16\n\n**Spoilers:** um caminho de três estrelas para cada desafio. Todas as ações são escolhas e rerolls disponíveis na interface. O RNG continua do draft até a última série; nenhuma partida usa seed externo. Os testes reproduzem estes caminhos pelo motor e pelo store, incluindo recarga e recompensas únicas.\n\nAs soluções demonstram possibilidade, não medem a taxa de sucesso de jogadores humanos. Os desafios mantêm margem para estratégias diferentes.\n\n";
  const metrics: Record<string, unknown> = {};
  for (const ch of challenges) {
    const solution = solutions[ch.id];
    const r = replayChallenge(ch, solution.actions);
    if (r.mask !== 7) throw new Error(ch.id);
    const overall = displayTeamOverall(r.user.rating);
    doc += `## ${CHALLENGE_TEXT_PT[ch.id].title}\n\nID: ${ch.id} · Seed: ${ch.seed} · Formato: ${ch.kind ?? "boss"} · ${ch.tier}\n\n`;
    solution.actions.forEach((a, i) => {
      let label;
      if (a.kind === "reroll") label = "Reroll pago";
      else if (a.kind === "freeReroll") label = "Reroll gratuito: a oferta não tem carta disponível";
      else {
        const card = playerCardById.get(a.refId);
        const name = card ? playerById.get(card.playerId)?.nickname : coachById.get(a.refId)?.name ?? subById.get(a.refId)?.name ?? orgById.get(a.refId)?.name;
        label = `Escolha ${name ?? a.refId} → ${a.slot}${a.specialId ? ` (especial: ${specialCardById.get(a.specialId)?.title ?? a.specialId})` : ""}`;
      }
      doc += `${i+1}. ${label}.\n`;
    });
    const scores = r.all.map(s => s.score.join("–"));
    doc += `\nResultado: **3/3 estrelas** · Overall ${overall} · Química ${r.user.chemistry.percent}%${scores.length ? ` · Séries: ${scores.join(", ")}` : " · Sem partida"}.\n\n`;
    metrics[ch.id] = { seed: ch.seed, overall, chemistry: r.user.chemistry.percent, scores, actions: solution.actions.length, mask: r.mask };
  }
  writeFileSync("docs/CHALLENGE-SOLUTIONS-rc36-16.md", doc.trimEnd() + "\n");
  writeFileSync(process.env.CH_METRICS ?? "../../work/challenge-proof-metrics.json", JSON.stringify(metrics, null, 2));
});

it.skipIf(!process.env.CH_AUDIT)("authoring: legal fixed-seed paths, real post-draft RNG", () => {
  const out: Record<string, unknown> = {};
  const samples = Number(process.env.CH_SAMPLES ?? 600);
  for (const ch of challenges.filter(c => !process.env.CH_IDS || process.env.CH_IDS.split(",").includes(c.id))) {
    const counts = [0, 0, 0, 0];
    const solutions: Record<string, unknown> = {};
    const overalls: Record<string, number> = {};
    for (let i = 1; i <= samples; i++) {
      const result = exploreChallenge(ch, i);
      if (!result) continue;
      const overall = displayTeamOverall(result.user.rating);
      overalls[overall] = (overalls[overall] ?? 0) + 1;
      for (let bit = 0; bit < 3; bit++) if (result.mask & (1 << bit)) {
        counts[bit]++;
        solutions[bit] ??= result.actions;
      }
      if (result.mask === 7) { counts[3]++; solutions.all ??= result.actions; }
    }
    out[ch.id] = { counts, samples, solutions, overalls };
    console.log(ch.id, counts);
    if (process.env.CH_OUT) writeFileSync(process.env.CH_OUT, JSON.stringify(out, null, 2));
  }
}, 600_000);
