# Mundo vivo M1: diagnóstico (20/11, v2.0.35)

Sonda `careerWorldLife.probe.test.ts` (`WORLDLIFE=1`): 16 carreiras Normal, em NA, EU, SAM e APAC, com 2 seeds e as políticas autopilot e tuned, por 13 temporadas. Médias das 7 regiões:

| Temp. | Idade top-4 | Ovr top-4 | Jovens top-6 livres | Local no Worlds |
|---|---|---|---|---|
| S2 | 20,2 | 84,6 | 0,1 | 2,1 |
| S7 | 22,5 | **88,7** | 1,8 | 0,8 |
| S8 | 23,0 | 88,3 | **2,8** | 1,0 |
| S12 | 22,8 | 87,4 | 1,4 | 0,8 |

## Causa

1. **A hipótese do Miguel se confirma: as orgs não renovam o elenco.** Nas temporadas infinitas acaba o passe de âncora (`market.ts:692`). O que resta contrata pelo overall atual (`bestRegionalFa`, `market.ts:525`, usado em 738 e 757), e o potencial não conta. Os melhores jovens ficam livres e o top-4 envelhece e cai depois do S7. A aposentadoria entre 24 e 29 anos (`balance.ts:2073`) esvazia o topo.
2. **A cena local sobe sem teto.** Na região do usuário, o rating Local é `min(usuário, origem + 1,5/temporada) + [-1,4]` (`worldSim.ts:1117-1150`, `careerFlow.ts:1464`). Para um usuário forte com origem 72, o teto chega a 84 no S8 e a 90 no S12. Isso põe os 8 Locais no nível do top-4 (87–88), e eles tomam vagas no Worlds. Os bots não chegaram ao Worlds, então esse caminho foi **calculado, não jogado**.
3. **O R130 não é a causa.** A partir do S6 há 17,6 orgs por região, e o preenchimento (`worldSim.ts:1299`) não dispara.

## Proposta (aguarda aprovação)

- **Olheiros:** na pré-temporada infinita, orgs de prestígio ≥ 2 contratam o melhor jovem livre por overall projetado. Ele entra no lugar do titular mais velho.
- **Stack:** um Local que chega a um Major ou ao Worlds é contratado pela org mais fraca da região ("stack X assinou com Y"). Vira três jogadores `fic:` e sai da cena local.
- **Rotatividade:** 1 org por região e temporada, fora do top 12 há 2 temporadas, dá lugar a uma org nova.
- **Local fica local:** teto da âncora = mediana da região − 2.

Valores para `balance.ts`:
`CAREER_WORLD.scouting = { prestigeMin: 2, chance: 0.6, maxAge: 21, minPotential: 85, projectionSeasons: 2 }`,
`stackSigning = { tiers: ["major","worlds"] }`,
`orgTurnover = { perRegionPerSeason: 1, outsideTop: 12, seasons: 2 }`,
`CAREER_UNOFFICIAL.localAnchorBelowMedian = 2`.

Tudo vale só a partir de `CAREER_SEASONS.length`. A linha do tempo e as diferenças regionais ficam intactas (top-4 do S5+: EU 91,4, SSA 86,3).

**Save:** ids `fic:` e `WorldOrgState` comuns, mais os campos opcionais `world.orgSince?` e `world.stackSignings?`. Persist 3 e saveVersion 5 não mudam.

## Dificuldade

- Os olheiros devolvem ao top-4 o pico do S7, cerca de **+1 a +1,5 de overall** do S8 em diante. Major e Worlds ficam mais duros nessa medida.
- O teto Local tira de 3 a 8 pontos dos Locais de um usuário forte a partir do S8: qualificatórios mais fáceis, Worlds disputado entre orgs.
- S0–S5 não mudam: a âncora fica entre 71 e 77, abaixo do teto.

A baseline (`BALANCE-BASELINE-v2.0.35.md`) e os dados reais (`ANALISE-POSTHOG-2026-11-20.md`) ainda não existem. A baseline é só referência; as metas vêm dos jogadores. Conferir:

- na baseline: taxa de Worlds e de título no S7+, e séries perdidas por time 100+;
- no PostHog: carreiras que chegam ao S7, abandono depois do Worlds e temporadas jogadas.

Gate: as orgs continuam no Worlds depois de 10 temporadas, e um time 100+ ainda perde séries?

## M2

Os olheiros cobrem a parte "o mundo cresce", cerca de um terço do M2. Tirar as suas estrelas e jogar contra o seu estilo continuam no M2.
