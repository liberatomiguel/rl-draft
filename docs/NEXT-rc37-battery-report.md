# Próxima sessão — relatório final da bateria rc.37

Cole o bloco abaixo num chat novo (contexto pequeno = barato) quando a bateria terminar.

```text
Rocket Draft — fechar a bateria rc.37 (relatório, recomendações F6, explicação).

Worktree: C:\Users\Miguel\CLAUDE\rocket-draft\.claude\worktrees\rc37-integration (branch claude/rc37-integration).
Leia só: AGENTS.md, docs/HANDOFF-rc37-integration.md, docs/NEXT-rc37-battery-report.md (este arquivo)
e C:\Users\Miguel\CLAUDE\rc37-battery\feedback-facts.md. Não explore o repo; não abra o CSV/JSON inteiros.

1. Conferir o fim: cada C:\Users\Miguel\CLAUDE\rc37-battery\run1\progress-N.json com done = planned
   (1229/1229/1228/1228) e "exit=" em C:\Users\Miguel\CLAUDE\rc37-battery\logs\shard-N.log.
   Shard parado antes (PC dormiu/reiniciou)? Relançar SÓ ele com o mesmo comando (retoma sozinho):
   HUMAN_AUDIT=1 HUMAN_MODE=matrix HUMAN_SHARDS=4 HUMAN_SHARD=N HUMAN_DIR=C:/Users/Miguel/CLAUDE/rc37-battery/run1
   node node_modules/vitest/vitest.mjs run src/store/auditHuman.test.ts   (em background, a partir do worktree)
2. Gerar: node src/store/auditHumanSummaryReport.mjs --input C:\Users\Miguel\CLAUDE\rc37-battery\run1
   --out C:\Users\Miguel\CLAUDE\rc37-battery\report\rc37 --baseline
   C:\Users\Miguel\Documents\Codex\2026-11-05\rocket-draft-frentes-f4a-ferramenta-da-6\outputs\F4a-baseline-summary.json
3. Ler o rc37.md por seções (grep "^## " e ler faixas).
4. Escrever docs/BATTERY-rc37-2026-11.md (PT-BR, compacto): cobertura executada e limitações; por célula
   (região × dificuldade × elenco) e por perfil: funil vs progressão-alvo, distribuição dos marcos,
   exposição/insucessos, finanças (falências e causas, tempo no negativo, −4/−8 semanas, crédito,
   venda emergencial), caixa S1–3 e p90 dos dominantes, folha × receitas no endgame (S6–S10, S11–S20),
   compras e benefício pós-cap, pares de Worlds, química, renovações, reputação, preleções;
   comparação com a baseline 04/11. Depois: recomendações F6 sustentadas pelos números e cada feedback
   do staging (feedback-facts.md) com o dado que confirma ou refuta.
   Proibido nesta etapa: aplicar ajustes F6, implementar F5, push/deploy, mexer em dados/assets.
5. Atualizar docs/STATUS.md e o §5 de docs/HANDOFF-rc37-integration.md; commit local (mensagem vX.Y.Z,
   trailer Co-Authored-By).
6. Explicar ao Miguel em linguagem simples e em detalhes tudo o que foi feito e descoberto.
```

## O que já se sabe (05–06/11, antes do fim)

- Integração: F1 → F2 → F3 → F4a (+ contrato F5 só doc) sobre o staging rc.36.15; venda de emergência
  na trava de revenda da F1 (R99); BALANCE_VERSION 14; 1630 testes verdes. Commits 84ac30c…85a3df5.
- Plano da bateria: 4.914 controles S10 (39 perfis distintos; style-consistency e briefing-adaptive =
  coachUpgrades), tiers A/B (14 perfis base, 2 seeds, pares Worlds +0,5/+1 bifurcados no 1º Worlds;
  A também S20 pós-título) e C/D (coortes de um fator). Antes eram 30.996 carreiras.
- Probes: renovação de um 90/98 sai por 1,3% do preço de mercado (1,4% / 1,2% nas seguintes) — o teto de
  salto sobre o salário antigo manda. Química: trio sem país/região em comum fica em 67% para sempre.
- Parcial (99 carreiras, só Easy): Regional cedo (38% no 1º split, 63% até o 2º); Major tarde (56% até
  S10); Worlds 45% e título 16% até S10; Worlds +1 reduz títulos (34% → 23%), +0,5 não muda;
  4 registros S11–S20 abaixo de −$1M; reputação: 17% dos Worlds perdem rep (provável meta da season
  no fechamento — confirmar); qualifier sempre "swiss_exit"; psicóloga +3 consistência/+3 clutch e 0 rating.
- Fatos do código para cada feedback: C:\Users\Miguel\CLAUDE\rc37-battery\feedback-facts.md.
