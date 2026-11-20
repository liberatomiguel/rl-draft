# Etapa 1 (v2.1 Matchday + Mundo vivo): estado

## Branch de integração e staging (20/11)

**`claude/etapa1-integration-3eae43` = `2.1.0-rc.1`**, a nova identidade
(`design/broadcast-pilot`) + `main` v2.0.35 + fatia 1 do Matchday
(`claude/matchday-f1-fd2597`) + baseline (`claude/balance-baseline-d2d477`) +
análise PostHog (`claude/posthog-analysis-d77555`) + diagnóstico M1
(`claude/recursing-chatelet-8a8b84`). Testes, lint, typecheck e build verdes.
Não publicado: espera o gate da Etapa 1 e o OK do Miguel. O A7 (tab bar
mobile da carreira, do Miguel) ainda não está aqui.

**Trazer os branches que faltam** (`matchday-f2`, implementação do M1,
analytics), um por vez, nesta ordem, no worktree deste branch:

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
   `git log --oneline -3 origin/staging` (hoje: `v2.0.33-design.1`, a nova
   identidade). Confirmar que o branch de integração contém esse commit
   (`git merge-base --is-ancestor origin/staging HEAD`); se não, perguntar ao
   Miguel antes de sobrescrever.
2. `git push origin HEAD:staging` (use `--force-with-lease=staging:<sha visto
   no passo 1>` só se o passo 1 mostrou que não é ancestral e o Miguel
   aprovou).
3. O projeto Workers Builds **`rocket-draft-staging`** (branch de produção
   `staging`) builda sozinho: `npm run build`, depois
   `npx wrangler deploy --env staging`. As variáveis `NEXT_PUBLIC_CAREER_MODE=1`
   e `NEXT_PUBLIC_NOINDEX=1` vêm das configurações desse build, não do repo
   nem do `.env.local`. Staging nunca manda analytics.
4. Conferir https://staging.rocketdraft.app: rodapé com `2.1.0-rc.N`,
   `robots.txt` com `Disallow: /`, Home, HQ da carreira, um evento, 320 px.
5. Nunca fazer deploy local (`npm run deploy` lê o `.env.local` com as chaves
   do Supabase) e nunca enviar este branch para `main`.

Só o estado atual. Spec: `MATCHDAY-SPEC.md`. Decisões do Miguel de 20/11:
`ROAD-TO-WORLDS-DECISIONS.md` R137. Medição: `ANALISE-POSTHOG-2026-11-20.md`
(dados reais, define as metas) e `BALANCE-BASELINE-v2.0.35.md` (referência
simulada, rodar de novo a cada fatia).

## Fatia 1, entregue (commit `v2.1.0-dev.1`, só motor)

Série em passos sem mudar nenhum resultado. `engine/match.ts`:

```ts
startSeries(teamA, teamB, options: SeriesOptions, rng): SeriesState
isSeriesOver(state): boolean
playNextGame(state, teamA, teamB, rng): SeriesState   // novo estado; não muta
finishSeries(state, teamA, teamB): SeriesResult       // não sorteia nada
simulateSeries(...)                                   // laço sobre os três
```

`SeriesState` é JSON puro: ids dos times, options, target, formA/formB,
winsA/winsB, lastWinner, maxDeficitA/B, games. Os times entram de novo em cada
passo, na mesma ordem (lança erro se não baterem).

`engine/career/seeds.ts`:
`seriesSeed(careerSeed, eventStream, roundKey, teamAId, teamBId)`, stream
`ser:{eventStream}:{roundKey}:{teamAId}:{teamBId}`. Testado, **não ligado**.

Prova: `match.steps.test.ts` compara um digest de 6.000 séries variadas (e do
cursor do RNG) com o motor da v2.0.35, também com salvar e recarregar entre os
jogos. Golden e balance intactos.

## O que a fatia 2 precisa saber

- Modificadores novos (estilo, plano, traços, embalo) entram em `gameSide` /
  `playNextGame` como campos opcionais de `TournamentTeam`: campo ausente =
  caminho antigo. O digest de `match.steps.test.ts` tem que continuar igual com
  a flag desligada; é a trava do Draft.
- Ligar `seriesSeed` tira a série do usuário do RNG da rodada e muda as outras
  séries daquela rodada: isso move resultados, então vai atrás de flag em
  `FEATURES` e com a bateria do baseline.
- `package.json`/`SITE.version`: 2.0.35 em `main`; 2.1.0-rc.1 no branch de integração (abaixo).
- Nada de save, copy ou tela ainda.

## Fatia 4, decidida (opção B, 20/11; R137)

Súmula (gols, assistências, defesas, chutes, demolições, pontuação, nota 0–10,
MVP pelos números, estatísticas da temporada no elenco) mais 2 a 4 momentos-chave
por jogo, só quando há algo notável (gol na prorrogação, virada de 0–2,
hat-trick). Todo momento sai da súmula. Sem narração lance a lance, sem barra
de embalo.
