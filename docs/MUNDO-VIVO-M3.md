# Mundo vivo M3: curva de dificuldade por região (20/11)

"Até T5" = `seasonIndex` 0–4, como no PostHog. Engine e `balance.ts` intactos.

## 1. Bot `strong` recalibrado

O bot (`careerArcBot.ts`) funda com Prospects, conta o potencial dos jovens no mercado (margem 3), renova o núcleo, compra suporte só com 10 semanas de folha em caixa e não gasta nada opcional com o Backer aberto. Sonda: `REGIONCURVE=1` (`careerRegionCurve.probe.test.ts`, `scripts/region-curve-summary.mjs`).

| Final regional até T5 | Real | Bot |
|---|---|---|
| EU Normal | 1% | 0% |
| NA Normal | 35% | 31% |
| SAM Normal | 67% | 60% |
| Menores Normal | 69% | 90% |
| EU Easy / Hard | 19% / 0% | 13% / 0% |

Overall 89–92 no T6; falência em 1 de 210 carreiras. Nas regiões menores o bot joga acima da média real. Ruído: ±11 pontos (16 seeds).

## 2. Medição (Normal, medianas)

| Região | Top 4 regional no T3 | Usuário no T3 | Caixa no T5 | Overall no T6 | Final até T5 / T7 / T9 |
|---|---|---|---|---|---|
| SSA | 82,4 | 80,3 | 153k | 89,2 | 100 / 100 / 100% |
| APAC | 81,2 | 81,9 | 188k | 90,5 | 90 / 100 / 100% |
| OCE | 84,2 | 79,6 | 98k | 88,7 | 70 / 90 / 90% |
| MENA | 87,3 | 81,5 | 132k | 91,5 | 100 / 100 / 100% |
| SAM | 88,0 | 80,7 | 80k | 89,8 | 60 / 70 / 90% |
| NA | 92,9 | 82,1 | 39k | 86,9 | 31 / 44 / 44% |
| **EU** | **95,2** | 79,9 | **12k** | **80,6** | **0 / 0 / 0%** |

Hard até T5: EU 0, NA 20, SAM 20%. Easy: EU 13, NA 69, SAM 90%.

## 3. Causa

1. **Na largada, todas as regiões são iguais.**
   - O orçamento não muda por região (`balance.ts:2128`, `economy.ts:1256`).
   - Os fundadores de EU e NA têm offset 0 (`balance.ts:2637`).
   - Todo usuário chega a cerca de 80 no T3.
2. **O campo é natural.** O top 4 real da EU fica em 95–96 do S0 ao S8, enquanto o da SAM vai de 87 a 93 (`worldSim.ts:813`).
3. **Outlier: o primeiro degrau.**
   - Resultado traz prêmio e reputação, e a reputação libera o teto `71 + 0,4×rep` (`economy.ts:718`, `balance.ts:2961`).
   - Com −15 pontos no T3, a EU nunca dispara essa bola de neve. O caixa fica em 12k e o elenco para em 80–85.
4. **A Easy não escala a distância.** O rival fica só 1 ponto mais fraco que na Normal (−1,6 contra −0,6, `balance.ts:4293/4300`).
5. **A alavanca já existe:** `CAREER_REGION_FIELD.shift` (`balance.ts:2627`, aplicada em `worldSim.ts:1636`), que vale só na qualificatória e na regional. Hoje está em 0 para EU e NA.

Fica como está, porque é natural: Major, Worlds, o topo regional depois do T6 e a ordem EU > NA > SAM.

## 4. Proposta

```ts
// CAREER_REGION_FIELD
earlyShift: { NA: -1.25, EU: -5, SAM: 0, MENA: 0, OCE: 0, APAC: 0, SSA: 0 },
earlyShiftScaleByDifficulty: { easy: 1.2, normal: 1, hard: 0 },
earlyShiftFade: { fullThrough: 4, goneAt: 7 }, // seasonIndex, linear
```

Em `worldSim.ts:1636`, somar `earlyShift × escala × fade(def.seasonIndex)` ao `sceneShift`: cerca de 5 linhas. O valor vai em `difficultyShift`, então os ratings reais e o seeding não mudam. `BALANCE_VERSION` 38 → 39.

Medido com o fade emulado na sonda (`RC_SHIFT`, `RC_FADE`), 16 seeds:

| Final até T5 / T7 / T9 | Hoje | Proposta |
|---|---|---|
| EU Normal | 0 / 0 / 0% | **25** / 31 / 38% |
| NA Normal | 31 / 44 / 44% | **50** / 56 / 56% |
| EU Easy (−6) | 13 / 19 / 19% | **75** / 81 / 100% (+50) |
| NA Easy (−1,8 medido) | 69% | 75% |

Outras regiões e Hard: iguais por construção. A ordem se mantém: EU 25 < NA 50 < SAM 60; na Easy, EU 75 < SAM 90.

Rejeitados:
- dose sem fade: no S6+, a regional da EU ficava mais fraca que a da SAM;
- NA −1,5 (56%) e NA −2 (90%).

**Save:** nada novo é gravado. Um save na EU antes do T8 sente a mudança a partir da próxima regional.

## 5. Riscos

- **Parede no T6–T8.** O campo da EU volta a 95 e o bot fica em 87 (31 → 38% entre o T7 e o T9). Alternativa: fade até o T10.
- **Major e Worlds não mudam.**
- **Hard segue em 0% na EU.** Fica para o Miguel decidir.
- **O bot joga bem.** Para o jogador médio da EU, espere cerca de 25%.
- **Ruído.** Confirmar com 30 seeds depois de implementar.
