# Etapa 1 (v2.1 Matchday + Mundo vivo): estado

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

## Fatia 1 (`v2.1.0-dev.1`)

Série em passos sem mudar resultado: `startSeries` / `playNextGame` /
`finishSeries` em `engine/match.ts`; `SeriesState` é JSON puro. `seriesSeed`
em `career/seeds.ts`, testado, **não ligado** (ligar move as outras séries da
rodada). Trava: o digest de `match.steps.test.ts`.

## Fatia 2 (`v2.1.0-dev.3`, atrás de `FEATURES.matchdayStyles`, desligada)

`career/styles.ts` (cinco estilos, natural + encaixe pelos atributos),
`career/traits.ts` (0–2 traços por nome + sal), confronto e traços em
`match.ts`, `CAREER_MATCHDAY` em `balance.ts`. Só `assembleTournamentTeam`
com `rollRange` (carreira) preenche `style`/`traits`. LAN não ligado.

**Medição** (bots autopilot/tuned/professional, sem a política "strong" do M1,
que não está neste ramo). Flag desligada = baseline, carreira por carreira.

| | Desligada | Ligada |
|---|--:|--:|
| Motor: favorito +2 / +5 / +6 | 75,2 / 96,0 / 98,2% | 74,9 / 95,9 / 98,2% |
| Carreira ±2: Normal / Hard / Easy | 59,4 / 56,2 / 76,1% | 59,1 / 57,3 / 76,1% |
| Carreira ≥ +6: Normal / Hard | 99,8 / 99,5% | 99,9 / 100% |
| Final regional até T5, NA e EU (N/E/H) | 0/6 em tudo | 0/6 em tudo |
| Título regional, rating 84–87: N / H | 17 / 7% | 8 / 13% |
| Worlds por participação (endgame N) | 1 de 12 | 0 de 11 |
| Soft lock / falência N / falência H | 0 / 0 / 4 de 42 | 0 / 1 / 5 de 42 |

Guardas duras de pé (Draft intacto, +6 ≥ 98%, +2 ≥ 73%, 0 soft lock, âncoras).
Zebra de +5: ~4% no motor, abaixo da faixa 5–8%; os tetos não precisam baixar.
Metas 1 e 2 (EU/NA) não se movem: o confronto é aleatório em relação ao
rating e não é a alavanca. Meta 4 está dentro do ruído (amostras de 16–37
temporadas). Meta 5 vale (0–8%), mas os bots quase nunca ganham o Worlds.

## Fatia 3 precisa saber

- Plano escolhe `TeamStyle.played`; o embalo substitui o hook de comportamento
  em `traitBounce`. Teto somado ±1,2 já é aplicado em `gameSide`.
- `package.json`/`SITE.version`: 2.0.35 em `main`, 2.1.0-rc.2 no branch de
  integração; `BALANCE_VERSION` 39 nele.

## Fatia 4, decidida (opção B, R137)

Súmula com 2 a 4 momentos-chave por jogo, todos tirados da súmula; sem
narração lance a lance e sem barra de embalo.
