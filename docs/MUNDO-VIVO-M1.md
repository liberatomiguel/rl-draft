# Mundo vivo M1 (v2.1.0-dev.2, R139)

Atrás de `FEATURES.worldLife` (`NEXT_PUBLIC_WORLD_LIFE=1`). Com a flag desligada tudo fica igual à v2.0.35. Ligada, as regras valem só nas temporadas infinitas (S6+). Código: `engine/career/worldLife.ts`; números: `CAREER_WORLD_LIFE`.

## Diagnóstico (20/11)

1. **As orgs não renovavam o elenco.** Quando acaba o passe de âncora (`market.ts:692`), elas contratam só pelo overall atual (`bestRegionalFa`). Os melhores jovens ficavam livres: 2,8 dos 6 no S8.
2. **A cena local não tinha teto.** Ela seguia o rating do usuário mais 1,5 por temporada (`worldSim.ts:1117`). Com a flag desligada, os Locais têm de 0,4 a 1,4 vagas no Worlds entre S6 e S12.
3. **O preenchimento do R130 não é a causa.** Há 17,6 orgs por região, e ele não dispara.

## O que entrou

- **Olheiros.** Na virada de temporada, uma org de prestígio ≥ 1 (chance 0,8) contrata o melhor jovem livre da região como **reserva**: até 21 anos, potencial ≥ 85 e overall ≥ o do titular mais fraco − 5. Com − 3, como no exemplo do Miguel, o alcance era de só 0,6 reserva por região. O reserva vira titular só quando supera o titular mais fraco, e esse titular vai para o banco e continua na org. Um banco cheio só abre vaga liberando um veterano de 25+.
- **Stack local.** Um Local que jogou um Major ou o Worlds é contratado na virada, por região: pela org nova, senão pela mais fraca.
- **Rotatividade.** Uma org de prestígio ≤ 1 fora do top 12 por 2 temporadas dá a vaga a uma org nova, com os mesmos jogadores (1 por região e temporada).
- **Teto Local:** mediana da região − 2, fixado no início da temporada.
- **Treinadores envelhecem e se aposentam.**
  - Chance de aposentadoria: 8 % a partir dos 40, até 100 % aos 52.
  - Uma org de IA fora do top 10 troca de treinador com 50 % de chance depois de 2 temporadas.
  - Um treinador de IA que se aposenta dá lugar a um sucessor no máximo 2 pontos pior. Ex-pros aposentados entram primeiro.
  - O treinador do usuário anuncia a última temporada no Inbox e sai só na virada seguinte, nunca no meio da temporada. Depois disso não volta à lista de candidatos.
- **Save:** só campos opcionais (`reserveIds`, `coachAge`, `coachSince`, `lowSeasons`, `coach.age`, `coach.retiresAfterSeason`, `retiredCoachIds`, `competition.localCap`). O contrato de persistência não muda.

## Medição (flag ON contra OFF)

10 carreiras por lado, Normal, política tuned, em NA, EU, SAM, MENA e APAC, 2 seeds, 13 temporadas (`careerWorldLife.probe.test.ts`). **S0–S5 são idênticas** entre ON e OFF.

| | OFF | ON |
|---|---|---|
| Worlds S10–S12, por evento: real / nova / Local | 15,2 / 0 / 0,6 | 15,1 / 0,4 / 0,0 |
| Overall top-4, S7 → S12 (pior temporada) | 88,8 → 87,4 (87,0) | 89,1 → 87,8 (87,8) |
| Idade top-4 no S12 | 22,8 | 22,5 |
| Reservas por região | 0 | 2,7–4,2 |
| Treinadores novos de IA por região e temporada | 0 | ~2,2 (≈13 %) |
| Treinador do usuário que se aposenta (6 carreiras) | 0 | 2 (anúncio, depois saída) |

O overall top-4 com a flag ON fica **acima** do OFF em todas as temporadas (de +0,2 a +0,8). Toda promoção só aumenta o trio, então os olheiros nunca derrubam o overall.

**Endgame.** O bot `strong` (novo) não passa de 89,8 e quebrou em 2 de 10 carreiras, então o endgame foi medido por replay: um time do usuário com rating fixo no Worlds real da temporada, 100 repetições.

| % de título, time 97 | S8 | S10 | S12 | Topo do campo S6 → S12 |
|---|---|---|---|---|
| OFF Normal | 10,1 | 32,4 | 54,1 | 98,4 → 95,3 |
| ON Normal | 11,8 | 43,0 | 53,7 | 98,4 → 95,2 |

O M1 deixa o campo mais fundo (o 8º colocado ganha de +0,3 a +0,7), mas **não endurece o topo**. Para um time dominante, o fim fica igual ou até um pouco mais fácil no S9–S11.

A causa real da facilidade no fim é outra: o topo do campo cai cerca de 3 pontos em 6 temporadas, com a flag ligada ou não. Isso é a parte "o mundo cresce" do M2: estrelas de IA que chegam ao potencial e supertimes.

## Metas do Miguel (20/11)

- **1 e 2 (S5):** não mudam por construção, porque S0–S5 são idênticas.
- **4:** no mesmo rating, a Hard é sempre mais difícil que a Normal (S10, time 97: 34,9 % contra 43,0 %). A Hard real que vence mais no 93+ deve ser um efeito de quem escolhe jogar Hard.
- **5 (≤ 30–35 %): o M1 não resolve.** O próximo passo é segurar o topo do campo.
- **3 e 6–9:** esta sonda não mede.

`BALANCE_VERSION` 37 → 38: o teste de fingerprint exige a subida a cada mudança no `balance.ts`.
