# Mundo vivo M3: rampa regional no início para EU e NA (v2.1.0-dev.8, R138)

A rampa fica atrás de `FEATURES.worldLife`, a mesma flag do M1 e do M2. Desligada, tudo roda como na v2.0.35. Código: `earlyRegionShift` (`worldSim.ts`); números: `CAREER_REGION_FIELD.earlyShift*`. "Até T5" quer dizer `seasonIndex` 0–4, a convenção do PostHog.

## Causa (diagnóstico de 20/11)

- **A largada é igual em toda região.** Orçamento e fundadores são os mesmos, e todo usuário chega a cerca de 80 no T3.
- **O campo da EU já começa no topo.** O top 4 real da EU fica em 95–96 desde o S0. O da SAM sobe de 87 para 93.
- **O primeiro resultado nunca vem na EU.** O usuário fica 15 pontos atrás no T3. Sem resultado não entra prêmio nem reputação, e sem isso não dá para contratar. O caixa fica em 12k e o elenco para em 80–85.
- **A Easy não fecha a distância.** Ela tira só 1 ponto do rival.

Medido com o bot `strong` calibrado. Por região (até T5): EU 0% contra 1% real, NA 31% contra 35%, SAM 60% contra 67%.

## Decisão (Miguel, 20/11)

```ts
earlyShift: { NA: -1.5, EU: -5, SAM: 0, MENA: 0, OCE: 0, APAC: 0, SSA: 0 },
earlyShiftScaleByDifficulty: { easy: 1, normal: 1, hard: 0 },
earlyShiftFade: { fullThrough: 4, goneAt: 9 }, // linear: do T5 ao T10
```

- O ajuste soma no rival da IA, mas só na qualificatória e na regional. Ele vai no `difficultyShift`, então o rating dos jogadores e o seeding não mudam.
- Major e Worlds não leem o ajuste.
- A Hard fica como está.
- `BALANCE_VERSION` vai para 39.

## Medição (flag ligada, bot `strong`, 30 seeds)

Final regional até T5 / T7 / T9, Normal:

| | Hoje | Fim no T8 (`goneAt` 7) | **Fim no T10 (9)** | Fim no T11 (10) |
|---|---|---|---|---|
| EU | 3 / 3 / 3% | 23 / 30 / 37 | **23 / 37 / 57** | 23 / 37 / 53 |
| NA −1,25 | 23 / 33 / 37% | 37 / 47 / 47 | 37 / 47 / 47 | 37 / 43 / 47 |
| **NA −1,5** | | | **43 / 57 / 60** | |
| SAM (sem rampa) | 57 / 60 / 67% | igual | igual | igual |

Usuário menos o top 4 da regional, EU, S5 → S8:

| Fim no T8 | Fim no T10 | Fim no T11 |
|---|---|---|
| −5,4 → −6,1 → −6,9 → −5,8 (**parede**) | −4,6 → −4,9 → −2,7 → −1,7 | −4,3 → −4,5 → −3,3 → −0,8 |

Easy, fim no T10, até T5 / T7 / T9:

| | Hoje | ×1,2 | ×1,1 | **×1,0** |
|---|---|---|---|---|
| EU | 10 / 17 / 23% | 80 / 90 / 100 | 77 / 93 / 97 | **50 / 77 / 93** |
| NA | 60 / 73 / 77% | 73 / 80 / 83 | 87 / 93 / 93 | **90 / 93 / 93**\* |
| SAM | 97 / 97 / 100% | igual | igual | igual |

\*Medido em −1,25; a decisão usa −1,5.

As outras regiões e a Hard não mudam por construção (dose 0, coberta por teste). Final até T5 com a flag ligada (18–20 seeds): Normal APAC 94, MENA 80, OCE 94, SSA 100%; Easy 100% em todas.

## Escolha

- **Fim no T10 (`goneAt` 9).** É o menor fim sem parede: a distância da EU encolhe a cada temporada. Fim no T11 não ganha nada a mais.
- **NA −1,5.** Com −1,25 a NA não chega a 40%. Com −1,5 ela fica acima da EU e abaixo da SAM em todo marco.
- **Easy ×1,0.** Com ×1,2 ou ×1,1, a EU fica mais fácil que a NA na Easy (80 contra 73 no T5; 97 contra 93 no T9).

| Meta | Resultado |
|---|---|
| EU Normal ≥ 20% até T5 | 23% ✓ |
| NA Normal ≥ 40% até T5 | 43% ✓ |
| Easy EU ≥ Normal + 20 | 50% (+27) ✓ |
| EU < NA < SAM | 23 < 43 < 57 · 37 < 57 < 60 · 57 < 60 < 67 ✓ |

Pela meta, um empate entre EU e NA na Easy no T9 (93 = 93) é aceito, e EU e NA ficam abaixo da SAM.

## Guardas

| Guarda | Resultado |
|---|---|
| Ratings e seeding | `difficultyShift` só; teste `earlyRegionShift.test.ts` |
| Major e Worlds | não leem o ajuste (`tiers` sem major/worlds, coberto por teste) |
| Draft | suíte completa verde, com o golden test |
| Soft lock | 0 achados: EU e NA × Easy/Normal/Hard × autopilot/tuned/strong, 9 temporadas, flag ligada |
| Falências | 0 em 750 carreiras de medição |

**Save:** nada é gravado. Um save na EU ou na NA antes do T10 sente a rampa a partir da próxima regional.

**Riscos.**
- Valores medidos com um bot bom. Para o jogador médio, a EU deve ficar perto dos 23%.
- Ruído de cerca de ±9 pontos por célula.
- NA Easy em −1,5 foi interpolada.
