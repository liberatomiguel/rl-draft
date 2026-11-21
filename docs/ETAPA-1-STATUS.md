# Etapa 1 (v2.1 Matchday + Mundo vivo): estado

Spec: `MATCHDAY-SPEC.md`. Decisões: `ROAD-TO-WORLDS-DECISIONS.md` R137–R139.
Metas: `ANALISE-POSTHOG-2026-11-20.md`; referência: `BALANCE-BASELINE-v2.0.35.md`.
`package.json`/`SITE.version` seguem 2.0.35; `BALANCE_VERSION` 39.

## Feito

- **Fatia 1** (`dev.1`): série em passos; trava em `match.steps.test.ts`.
- **Fatia 2** (`dev.3`, `FEATURES.matchdayStyles`): estilos, confronto, traços.
- **Fatia 3** (`dev.5`, `FEATURES.matchdayDecisions`, desligada): plano, pausas, embalo no lugar do bounce, "deixar com o coach", modos `prefs.matchdayMode` (rápido por padrão) e `matchdayStopAt`. Série do usuário em `seriesSeed`, salva em `activeEvent.userSeries`. Código: `engine/career/matchday.ts`, `matchdaySeries.ts`, `store/careerFlow.ts`.
- **Fatia 4** (`dev.9`, `FEATURES.matchdayBoxScore`, desligada): súmula, nota 0–10, momentos-chave e estatísticas da temporada (opção B, R137; decisão R140). Código: `engine/career/boxScore.ts`, `content/momentText.ts`, `store/careerFlow.ts` (`accumulateBoxStats`). Só apresentação: não muda resultado; o mundo simulado não chama a súmula (tempo de simulação por temporada inalterado). `BALANCE_VERSION` 40 só pelo fingerprint das constantes novas.

## Branch de integração e staging (20/11)

**`claude/etapa1-integration-3eae43` = `2.1.0-rc.2`** (aprovado pelo Miguel
em 20/11): a nova identidade na quinta passada (`design/broadcast-pilot` +
`4b4ecd6`) + `main` v2.0.35 + as fatias 1 e 2 do Matchday + baseline +
análise PostHog + M1 (diagnóstico e implementação, R139) + analytics da
Etapa 1. Testes, lint, typecheck e build verdes. Não publicado: espera o OK
do Miguel para o push. O A7 (tab bar mobile da carreira, do Miguel) ainda não
está aqui.

**Flags da Etapa 1:** `FEATURES.matchdayStyles` e `FEATURES.worldLife`
ficam **ligadas só no build de staging** (`STAGING_BUILD` em `balance.ts`:
`next build` + `NEXT_PUBLIC_NOINDEX=1`, sem `NEXT_PUBLIC_PLAYTEST`; a mesma
regra do analytics). Produção, playtest, dev e testes: desligadas
(`stagingFlags.test.ts`). Nada novo para configurar no painel. `BALANCE_VERSION`
39 (as duas fatias tinham ido a 38 cada uma).

**Atenção: `design/broadcast-pilot` está atrás de `staging`.** A quinta
passada (`4b4ecd6`) só existe em `origin/staging`; este branch já a tem.
Qualquer trabalho novo de identidade deve partir deste branch ou de
`4b4ecd6`, não de `design/broadcast-pilot`. Conhecido a 320 px (igual ao
staging): wordmark da Home 25 px largo demais, rótulos dos quadros do HQ e
do evento colados. Fica para a passada mobile / A7.

**Worktree novo:** rode `npm ci` antes de buildar. Sem `node_modules`
próprio, o Next usa o do checkout principal e o build quebra com um panic do
Turbopack ("Missing content ... StaticOutputAsset").

**Trazer um branch novo** (fatia 3, M2...), um por vez, no worktree deste
branch:

1. `git status` limpo; `git log --oneline -1 refs/heads/<branch>` para ver o
   que entra. Use sempre `refs/heads/<branch>` (uma tag de mesmo nome venceria).
2. `git merge --no-ff refs/heads/<branch>`. Conflitos: só os trechos em
   conflito. Tela/estilo fica com a nova identidade (`DESIGN.md`: sem travessão,
   pesos, materiais); comportamento, copy e dados ficam com o branch. Números
   de DESIGN-DECISIONS e R não podem repetir: o maior número vence, renumere o
   mais novo e corrija as referências. CHANGELOG e STATUS guardam as duas
   histórias.
3. Depois de cada merge: `npm test 2>&1 | tail -20`, `npm run lint`,
   `npm run typecheck`. Se o branch mexe em motor/balance, rode a bateria do
   baseline (`BALANCE-BASELINE-v2.0.35.md`) e compare.
4. No fim: `npm run build` (inclui o postexport), uma olhada no preview deste
   worktree (entrada `npm --prefix <worktree>` em outra porta; confira a versão
   no log; pare todo servidor), versão `2.1.0-rc.N+1` em `package.json` e
   `SITE.version`, entrada no CHANGELOG, commit.

**Publicar em `staging`** (`docs/DEPLOY-CLOUDFLARE.md`, "Cloud staging").
**Não rodar antes do gate e do OK do Miguel.**

1. Ver o que está em staging agora: `git fetch origin` e
   `git log --oneline -3 origin/staging` (em 20/11: `cfefe9d`,
   `v2.0.33-design.1`). Este branch tem o conteúdo dele (`4b4ecd6`), mas não o
   commit `cfefe9d` em si (o merge de staging com main v2.0.28), então o push
   não é fast-forward. Confirme com
   `git diff --stat cfefe9d HEAD` que nada de staging se perde (só deve haver
   coisas novas) e que `origin/staging` ainda é `cfefe9d`; se mudou, pergunte
   ao Miguel.
2. Com o OK do Miguel:
   `git push --force-with-lease=staging:cfefe9d origin HEAD:staging`
   (troque `cfefe9d` pelo sha visto no passo 1). Alternativa sem force:
   `git merge -s ours cfefe9d` neste branch antes do push (registra staging
   como ancestral sem mudar arquivos).
3. O projeto Workers Builds **`rocket-draft-staging`** (branch de produção
   `staging`) builda sozinho: `npm run build`, depois
   `npx wrangler deploy --env staging`. As variáveis `NEXT_PUBLIC_CAREER_MODE=1`
   e `NEXT_PUBLIC_NOINDEX=1` vêm das configurações desse build, não do repo
   nem do `.env.local`. O `NOINDEX=1` também liga as flags da Etapa 1; não
   adicione `NEXT_PUBLIC_PLAYTEST` nesse projeto, ou elas desligam. Staging
   nunca manda analytics.
4. Conferir https://staging.rocketdraft.app: rodapé com `2.1.0-rc.2`,
   `robots.txt` com `Disallow: /`, Home, HQ da carreira, um evento, 320 px.
   A fatia 2 não tem tela (só motor): o sinal é a carreira jogar normal. O
   M1 só age a partir da primeira temporada infinita, e aparece no Inbox e
   nas notícias (prospecto contratado, org nova, técnico que se aposenta).
5. Produção não muda com este push: `rocketdraft.app` builda de `main`, e
   num build de produção as duas flags ficam desligadas.
6. Nunca fazer deploy local (`npm run deploy` lê o `.env.local` com as chaves
   do Supabase) e nunca enviar este branch para `main`.

Spec: `MATCHDAY-SPEC.md`. Decisões: `ROAD-TO-WORLDS-DECISIONS.md`
R137 (20/11) e R138 (fatia 2). Metas: `ANALISE-POSTHOG-2026-11-20.md`;
referência simulada: `BALANCE-BASELINE-v2.0.35.md`.

## Medição da fatia 3 (bots; dumps em `matchday-f3-dumps/` nas notas)

Flag desligada = baseline carreira por carreira (14/14).

| | v2.0.35 | Ligada |
|---|--:|--:|
| Motor +2 / +5 / +6 | 75,5 / 96,1 / 98,4% | 75,6 / 96,1 / 98,4% |
| Carreira ±2 N / H / E | 59,4 / 56,2 / 76,1% | 59,7 / 58,6 / 77,0% |
| Carreira ≥ +6 N / H | 99,8 / 99,5% | 99,8 / 99,9% |
| Soft lock; falência N / H | 0; 0 / 4 de 42 | 0; 1 / 5 de 42 |

Zebra de +5: 3,9%, ainda abaixo de 5–8%. Final regional até T5 segue 0/6 em NA, EU e SAM.

**Rápido × personalizado** (vitória do usuário, 20 mil séries por célula, Normal = Hard):

| Gap | Bom manual | Coach médio (72) | Coach 0,7 | Sem coach | Antigo |
|---|--:|--:|--:|--:|--:|
| −2 | 30,4% | 27,9% | 29,3% | 24,0% | 25,1% |
| 0 | 55,7% | 53,3% | 54,8% | 49,4% | 49,7% |
| +2 | 80,4% | 78,2% | 79,6% | 74,9% | 74,9% |

O coach médio custa 2–2,5 pp contra o bom manual; sem coach, 5,5–6,4 pp. Pedaços do manual em série igual: timeout +2,3, ajuste +1,8, estilo +1,3, marcação +1,1, kickoff ~0 pp.

## Para o Miguel decidir

- Sem coach custa ~6 pp: aceitar, ou dar ao time sem coach uma qualidade mínima (ex.: 0,2).
- Decidir também deixa a série igual mais fácil que hoje: +3,6 pp com o coach médio, +6 com o bom manual (a IA não planeja).

## Fatia 5 precisa saber

**Súmula (fatia 4):**
- `buildSeriesBoxScore(series, roundKey, {a: teams[teamAId], b: teams[teamBId]})` devolve `games[]` (`players.a/b[]` com gols, assistências, chutes, defesas, demos, pontos, nota; `moments[]`; `mvp` do jogo), `totals` (com `avgRating`) e o `mvp` da série (maior pontuação do vencedor). Use o `key` da rodada do `eventPlayback` ("sw:2" / "po:0"): é o mesmo que alimenta as estatísticas salvas, então a tela mostra os números que entram nelas. Chame só ao abrir a série; é determinístico.
- Texto do momento: `momentText(useCareerCopy(), moment, teams[side].playerNames[moment.playerIdx])`. O `clock` é o do `matchTimeline` (restante na regulamentar, jogado na prorrogação), então o momento encaixa na linha do tempo do Match Center.
- Estatísticas do elenco: `save.boxStats` (`SeasonBoxStats[]`, mais nova primeiro, no máximo duas temporadas; chave = id do jogador, ou o nome se não achar). Média = `avgRatingOf(linha)`. Só a série do usuário entra, ao fim do evento: o evento em curso ainda não está lá.
- Com a flag desligada nada é gerado nem salvo; a tela esconde a súmula nesse caso (`FEATURES.matchdayBoxScore`).
- Troca no meio da série (fatia 3): não conferi como o reserva aparece em `scorers`/`playerNames`. A súmula lê os `playerNames` do time ao fim do evento e atribui por índice; se a troca mudar o índice, olhar isso antes de mostrar nomes.

**Telas e modos:**

- Telas: pré-série (`shownStyle`, `playmakerIndex`, traços; sugestão de `coachPlanFor`), pausa e a opção (rótulos `matchdayMode.*` prontos).
- Com o personalizado, `playEventRound`/`simEvent` param numa série aberta (`pendingUserSeriesOf`); a tela usa `setSeriesPlan`, `playSeriesGame`, `seriesTimeout`, `seriesAdjust`, `seriesSub`, `delegateSeries` e depois `playEventRound`. O autoplay e o "Avançar" precisam tratar essa parada.
- Decidir se o reserva que entra na troca recebe XP (`fieldedIds` não muda hoje).
